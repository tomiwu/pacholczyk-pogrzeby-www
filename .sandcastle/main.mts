// Sandcastle loop: implement -> review -> check -> PR -> wait for Tomasz (no merge).
// Generalized from the crap4s and automations loops.
//
// For each iteration, the host does these steps:
//   1. Select the open issue with the "Sandcastle" label that has no open
//      "Blocked by #N" issue. Take the highest priority label, then the lowest number.
//   2. Create a sandbox on the branch "sandcastle/issue-<N>-<time>".
//   3. Run the implementer agent, then the reviewer agent.
//   4. Run the checks from .sandcastle/checks.json in the sandbox.
//   5. If a check fails, run the fixer agent. Retry up to MAX_FIX_ATTEMPTS.
//   6. Push the branch, open a PR, wait for CI. Never merge: label needs-validation.
// See the policy block at the end of this file (idle polling, webhook events).
// The agent is always Claude Code on the local machine. Do not use cloud agents.
//
// Loop policy (tomiwu 2026-11-13, review of the Lydia Hallie talk; helpers in loop-policy.mts):
//  1. A Claude limit ("resets 6:30pm (UTC)"): skip the other Claude models (one shared limit),
//     pause until the parsed reset on the wall clock (a suspended box does not freeze the wait).
//  2. Claude Code reads the committed .claude/settings.json: a Stop hook (exit 2 until there is a
//     commit, a clean tree, a ## Verification section, and .claude/hooks/fast-checks.sh passes).
//     Active only with LOOP_STOP_GATE=1 (this loop sets it). One forced retry (stop_hook_active).
//  3. idleTimeoutSeconds 1800 for every agent run.
//  4. Optional early host check after the implementer, before the reviewer: "earlyHostCheck" in
//     .sandcastle/checks.json (for example a cross-compile that the sandbox image cannot run).
//  5. permissions.deny in .claude/settings.json (works with --dangerously-skip-permissions).
//  6. Short prompts: only facts that the code does not show; inline issue limit 15 KB.
//  7. The reviewer checks the acceptance criteria first and lists bugs. REVIEW_MODEL.
//  8. ## Verification = the command and the pasted tail of its real output; before/after numbers.
//  9. Effort per phase (EFFORT_<PHASE>; a format/lint-only fixer uses low).
//  Status file STATUS_FILE (JSON: phase, model, issue, startedAt, lastOutputAt).
//
// Usage:
//   MAX_ITERATIONS=10 npx tsx .sandcastle/main.mts
//   DRY_RUN=1 npx tsx .sandcastle/main.mts      (print the next issue, run no agent)
//   SKIP_ISSUES=12,14 npx tsx .sandcastle/main.mts

import * as sandcastle from "@ai-hero/sandcastle";
import { podman } from "@ai-hero/sandcastle/sandboxes/podman";
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CLAUDE_LIMIT,
  effortFor,
  limitWait,
  modelOfLabel,
  nextAgentAfterStall,
  phaseOfName,
  sleepUntil,
  writeStatus,
} from "./loop-policy.mts";

const MAX_ITERATIONS = Number(process.env.MAX_ITERATIONS ?? "10");
const MAX_FIX_ATTEMPTS = Number(process.env.MAX_FIX_ATTEMPTS ?? "3");
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";
const AUTO_MERGE = process.env.AUTO_MERGE === "1"; // default off: open a PR, do not merge
const BASE_BRANCH = process.env.BASE_BRANCH ?? "main";
// Optional second Claude model. A Claude limit skips it (the limit is shared).
const CLAUDE_FALLBACK_MODEL = process.env.CLAUDE_FALLBACK_MODEL ?? "";
const REVIEW_MODEL = process.env.REVIEW_MODEL ?? CLAUDE_MODEL;
const PAUSE_MINUTES = Number(process.env.PAUSE_MINUTES ?? "30");
const MAX_PAUSES = Number(process.env.MAX_PAUSES ?? "12");
const LIMIT_MAX_HOURS = Number(process.env.LIMIT_MAX_HOURS ?? "6");

// Project-specific settings. Edit .sandcastle/checks.json, not this file.
interface Config {
  setup: string;
  checks: [string, string][];
  earlyHostCheck?: string;
}
const CONFIG: Config = JSON.parse(
  readFileSync(".sandcastle/checks.json", "utf8"),
);
const CHECK_NAMES = CONFIG.checks.map(([, cmd]) => `\`${cmd}\``).join(", ");

type RunOptions = Omit<Parameters<sandcastle.Sandbox["run"]>[0], "agent">;

const STALL =
  /usage limit|rate limit|limit reached|hit your (?:[\w-]+ )?limit|quota|credit balance|overloaded|not logged in|authentication required/i;
const MODELS = [
  CLAUDE_MODEL,
  ...(CLAUDE_FALLBACK_MODEL && CLAUDE_FALLBACK_MODEL !== CLAUDE_MODEL
    ? [CLAUDE_FALLBACK_MODEL]
    : []),
];
const LABELS = MODELS.map((m) => `Claude Code (${m})`);
let agentIndex = 0;
let pauses = 0;
let currentIssue: number | null = null;
const PROJECT_NAME =
  process.env.PROJECT ?? process.cwd().split("/").pop() ?? "project";
const STATUS_FILE =
  process.env.STATUS_FILE ?? `/tmp/${PROJECT_NAME}-loop.status.json`;

function newestLog(name?: string): string | undefined {
  try {
    const dir = ".sandcastle/logs";
    return readdirSync(dir)
      .filter((f) => name && f.endsWith(`-${name}.log`))
      .map((f) => join(dir, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  } catch {
    return undefined;
  }
}

function logTail(name?: string): string {
  const f = newestLog(name);
  try {
    return f ? readFileSync(f, "utf8").slice(-4000) : "";
  } catch {
    return "";
  }
}

function saveStatus(
  phase: string,
  note: string,
  startedAt: string,
  lastOutputAt: string | null,
): void {
  const label = LABELS[agentIndex];
  writeStatus(STATUS_FILE, {
    phase,
    model: modelOfLabel(label),
    agent: label,
    issue: currentIssue,
    startedAt,
    lastOutputAt,
    pid: process.pid,
    note,
  });
}

// Run one agent phase. A stall changes to the next model; a Claude limit skips the other Claude
// models and pauses until the parsed reset time on the wall clock, then retries.
async function runPhase(
  sandbox: sandcastle.Sandbox,
  options: RunOptions & { checkLog?: string },
) {
  const { checkLog = "", ...runOptions } = options;
  const name = options.name ?? "phase";
  const baseSha = (await sandbox.exec("git rev-parse HEAD")).stdout.trim();
  for (;;) {
    const effort = effortFor(phaseOfName(name, checkLog));
    const model = name === "reviewer" ? REVIEW_MODEL : MODELS[agentIndex];
    const env = {
      LOOP_STOP_GATE: "1",
      LOOP_PHASE: name,
      LOOP_BASE_SHA: baseSha,
    };
    const startedAt = new Date().toISOString();
    saveStatus(name, `${model}, effort ${effort}`, startedAt, null);
    const beat = setInterval(() => {
      const f = newestLog(name);
      try {
        if (f)
          saveStatus(
            name,
            `${model}, effort ${effort}`,
            startedAt,
            new Date(statSync(f).mtimeMs).toISOString(),
          );
      } catch {
        /* next beat */
      }
    }, 30_000);
    let failure = "";
    try {
      const result = await sandbox.run({
        idleTimeoutSeconds: 1800,
        ...runOptions,
        agent: sandcastle.claudeCode(model, { effort, env }),
      });
      if (result.commits.length || !STALL.test(logTail(name))) return result;
      failure = `stall text in the agent log: ${logTail(name).slice(-300)}`;
    } catch (error) {
      failure = `${error} ${logTail(name).slice(-600)}`;
      if (!STALL.test(failure)) throw error;
    } finally {
      clearInterval(beat);
    }
    console.log(
      `Claude Code (${model}) stalled in ${name}: ${failure.slice(0, 300)}`,
    );
    const next = nextAgentAfterStall(LABELS, agentIndex, failure);
    if (next >= 0) {
      agentIndex = next;
      continue;
    }
    if (pauses >= MAX_PAUSES)
      throw new Error(
        `All models stalled ${MAX_PAUSES + 1} times. Last error: ${failure.slice(0, 300)}`,
      );
    pauses++;
    const w = CLAUDE_LIMIT.test(failure)
      ? limitWait(failure, Date.now(), PAUSE_MINUTES, LIMIT_MAX_HOURS)
      : {
          untilMs: Date.now() + PAUSE_MINUTES * 60_000,
          reason: `fixed pause ${PAUSE_MINUTES} min`,
        };
    console.log(
      `Pause until ${new Date(w.untilMs).toISOString()} on the wall clock (${w.reason}, pause ${pauses}/${MAX_PAUSES}).`,
    );
    saveStatus("pause", w.reason, new Date().toISOString(), null);
    await sleepUntil(w.untilMs);
    agentIndex = 0;
  }
}

// Optional host check after the implementer (rule 4). Empty: no check.
function earlyHostCheck(worktree: string): { ok: boolean; log: string } {
  if (!CONFIG.earlyHostCheck) return { ok: true, log: "" };
  const r = spawnSync(
    "bash",
    [
      "-c",
      `${CONFIG.earlyHostCheck} 2>&1 | tail -n 120; exit \${PIPESTATUS[0]}`,
    ],
    {
      cwd: worktree,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 45 * 60_000,
    },
  );
  console.log(`Early host check: exit ${r.status ?? "none"}.`);
  return {
    ok: r.status === 0,
    log: `## early host check (\`${CONFIG.earlyHostCheck}\`)\n${r.stdout ?? ""}${r.stderr ?? ""}`,
  };
}

// Rule 8: without a Verification section with a command and its real output, add a visible note.
function withVerification(log: string): string {
  return log.includes("## Verification")
    ? log
    : `${log}\n\n## Verification\n\n**Missing: no commit has a Verification section with a command and its real output. A reviewer must add it before the merge.**`;
}

const LABEL = "Sandcastle";
// Issues to skip, for example issues that must change .github/ (GH_TOKEN has no Workflows permission).
const SKIP = new Set(
  (process.env.SKIP_ISSUES ?? "").split(",").filter(Boolean).map(Number),
);

const hooks = {
  sandbox: {
    onSandboxReady: [{ command: `${CONFIG.setup} || true` }],
  },
};

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

interface Issue {
  number: number;
  title: string;
  body: string;
  labels: { name: string }[];
}

// Priority from labels. An issue without a priority label is medium.
const PRIORITY: Record<string, number> = {
  "priority: critical": 0,
  "priority: high": 1,
  "priority: medium": 2,
  "priority: low": 3,
};
function priority(issue: Issue): number {
  const values = issue.labels
    .map((l) => PRIORITY[l.name])
    .filter((v) => v !== undefined);
  return values.length ? Math.min(...values) : PRIORITY["priority: medium"];
}

function nextIssue(merged: Set<number>): Issue | undefined {
  const open: Issue[] = JSON.parse(
    sh("gh", [
      "issue",
      "list",
      "--state",
      "open",
      "--label",
      LABEL,
      "--limit",
      "100",
      "--json",
      "number,title,body,labels",
    ]),
  );
  const openNumbers = new Set(
    open.map((i) => i.number).filter((n) => !merged.has(n)),
  );
  open.splice(
    0,
    open.length,
    ...open.filter((i) => !merged.has(i.number) && !SKIP.has(i.number)),
  );
  const ready = open.filter((i) => {
    const blockers = [
      ...i.body.matchAll(/Blocked by\s+((?:#\d+[\s,and]*)+)/gi),
    ].flatMap((m) => [...m[1].matchAll(/#(\d+)/g)].map((n) => Number(n[1])));
    return blockers.every((b) => !openNumbers.has(b));
  });
  // Highest priority first, then lowest number. The loop reads the labels again before each iteration.
  ready.sort((a, b) => priority(a) - priority(b) || a.number - b.number);
  if (open.length && !ready.length) console.log("All open issues are blocked.");
  // The issue list can be stale just after a merge. Check the state of the issue again.
  return ready.find(
    (i) =>
      sh("gh", [
        "issue",
        "view",
        String(i.number),
        "--json",
        "state",
        "--jq",
        ".state",
      ]) === "OPEN",
  );
}

// Collect the last lines of the log of each failed CI job of a PR.
function failedCiLog(url: string): string {
  const sha = spawnSync(
    "gh",
    ["pr", "view", url, "--json", "headRefOid", "--jq", ".headRefOid"],
    { encoding: "utf8" },
  ).stdout.trim();
  const ids = spawnSync(
    "gh",
    [
      "run",
      "list",
      "--commit",
      sha,
      "--json",
      "databaseId,conclusion",
      "--jq",
      '.[] | select(.conclusion == "failure") | .databaseId',
    ],
    { encoding: "utf8" },
  )
    .stdout.trim()
    .split("\n")
    .filter(Boolean);
  return ids
    .map((id) => {
      const raw = spawnSync("gh", ["run", "view", id, "--log-failed"], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      }).stdout;
      const clean = raw.replace(/\x1b\[[0-9;]*m/g, "").split("\n");
      return `## CI run ${id}\n${clean.slice(-150).join("\n")}`;
    })
    .join("\n");
}

const CHECKS = CONFIG.checks;
const PROJECT =
  process.env.PROJECT ?? process.cwd().split("/").pop() ?? "project";

async function runChecks(
  sandbox: sandcastle.Sandbox,
): Promise<{ ok: boolean; log: string }> {
  let log = "";
  for (const [name, cmd] of CHECKS) {
    const r = await sandbox.exec(
      `(${cmd}) > /tmp/check.log 2>&1; rc=$?; tail -n 150 /tmp/check.log; exit $rc`,
    );
    log += `## ${name} (\`${cmd}\`)\n${r.stdout}\n`;
    if (r.exitCode !== 0) return { ok: false, log };
  }
  return { ok: true, log };
}

if (process.env.DRY_RUN) {
  const issue = nextIssue(new Set());
  console.log(
    issue ? `Next issue: #${issue.number} ${issue.title}` : "No ready issue.",
  );
  process.exit(0);
}

// The token cannot read check rollups. Read the GitHub Actions runs for the PR head commit.
function ciState(url: string): "none" | "pending" | "success" | "failure" {
  const sha = spawnSync(
    "gh",
    ["pr", "view", url, "--json", "headRefOid", "--jq", ".headRefOid"],
    { encoding: "utf8" },
  ).stdout.trim();
  const out = spawnSync(
    "gh",
    ["run", "list", "--commit", sha, "--json", "status,conclusion"],
    { encoding: "utf8" },
  ).stdout;
  let runs: { status: string; conclusion: string }[] = [];
  try {
    runs = JSON.parse(out || "[]");
  } catch {
    return "pending";
  }
  if (runs.length === 0) return "none";
  if (runs.some((r) => r.status !== "completed")) return "pending";
  return runs.every(
    (r) => r.conclusion === "success" || r.conclusion === "skipped",
  )
    ? "success"
    : "failure";
}
async function waitCi(url: string): Promise<boolean> {
  for (let i = 0; i < 120; i++) {
    const st = ciState(url);
    if (st === "success") return true;
    if (st === "failure") return false;
    await sleepUntil(Date.now() + 15_000);
  }
  return false;
}
// ---------------------------------------------------------------------------
// pacholczyk-pogrzeby-www policy (2026-11-26):
// - The loop never merges. A PR with green CI gets the label "needs-validation"
//   and waits for Tomasz. Its issue stays open, so it still blocks its dependents.
// - Events go to LOOP_WEBHOOK_URL with "Authorization: Bearer LOOP_WEBHOOK_KEY".
//   A failed POST never stops the loop.
// - When no issue is ready, the loop posts loop_idle one time and polls again.
//   When no open Sandcastle issue is left, it posts done and stops.
// ---------------------------------------------------------------------------
const WEBHOOK_URL = process.env.LOOP_WEBHOOK_URL ?? "";
const WEBHOOK_KEY = process.env.LOOP_WEBHOOK_KEY ?? "";
const IDLE_POLL_MINUTES = Number(process.env.IDLE_POLL_MINUTES ?? "10");
type LoopEvent = "pr_opened" | "ci_failed" | "loop_idle" | "loop_crashed" | "done";

async function postEvent(
  event: LoopEvent,
  extra: { issue?: number; pr?: string } = {},
): Promise<void> {
  if (!WEBHOOK_URL || !WEBHOOK_KEY) {
    console.log(`Webhook values are missing. Event ${event} is not sent.`);
    return;
  }
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WEBHOOK_KEY}`,
      },
      body: JSON.stringify({
        source: "sandcastle-loop",
        project: PROJECT,
        event,
        ...extra,
        at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    console.log(`Event ${event} sent: HTTP ${res.status}.`);
  } catch (e) {
    console.log(`Event ${event} not sent: ${`${e}`.slice(0, 200)}`);
  }
}

function idleStatus(note: string): void {
  const now = new Date().toISOString();
  currentIssue = null;
  saveStatus("idle", note, now, now);
}

function openSandcastleCount(): number {
  return JSON.parse(
    sh("gh", [
      "issue",
      "list",
      "--state",
      "open",
      "--label",
      LABEL,
      "--limit",
      "100",
      "--json",
      "number",
    ]),
  ).length;
}

function markWaiting(url: string, issueNumber: number, comment: boolean): void {
  spawnSync("gh", ["pr", "edit", url, "--add-label", "needs-validation"], {
    stdio: "inherit",
  });
  if (comment)
    sh("gh", [
      "pr",
      "comment",
      url,
      "--body",
      "Sandcastle finished the local checks and all CI checks are green. The loop does not merge. Tomasz must give his OK before the merge.",
    ]);
  console.log(`PR ${url} for #${issueNumber} waits for Tomasz.`);
}

// waiting: PR is green and waits for Tomasz. failed: the loop cannot finish it.
// Both sets are skipped, but their issues stay open and still block dependents.
const waiting = new Set<number>();
const failed = new Set<number>();

async function waitCiWithFixes(
  url: string,
  branch: string,
  issueNumber: number,
): Promise<boolean> {
  const args = { PROJECT, ISSUE: String(issueNumber), BRANCH: branch };
  for (let attempt = 0; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
    if (await waitCi(url)) return true;
    if (attempt === MAX_FIX_ATTEMPTS) break;
    console.log(`CI failed for ${url}. Fixer attempt ${attempt + 1}.`);
    spawnSync("git", ["fetch", "origin", branch]);
    spawnSync("git", ["branch", "-f", branch, `origin/${branch}`]);
    const fixBox = await sandcastle.createSandbox({
      branch,
      baseBranch: `origin/${BASE_BRANCH}`,
      sandbox: podman({ imageName: "localhost/sandcastle:pacholczyk-pogrzeby-www" }),
      hooks,
    });
    try {
      await runPhase(fixBox, {
        name: `ci-fixer-${attempt + 1}`,
        maxIterations: 1,
        promptFile: "./.sandcastle/fix-prompt.md",
        promptArgs: { ...args, CHECK_LOG: failedCiLog(url).slice(-12000) },
      });
    } finally {
      await fixBox.close();
    }
    sh("git", ["push", "-f", "origin", branch]);
  }
  return false;
}

async function giveUp(issueNumber: number, text: string, pr?: string) {
  failed.add(issueNumber);
  spawnSync("gh", ["issue", "comment", String(issueNumber), "--body", text], {
    stdio: "inherit",
  });
  await postEvent("ci_failed", { issue: issueNumber, ...(pr ? { pr } : {}) });
}

async function mainLoop(): Promise<void> {
  console.log(`Agent: Claude Code (${CLAUDE_MODEL})`);
  console.log(`Review model: ${REVIEW_MODEL}`);
  console.log(`Base branch: ${BASE_BRANCH}`);
  console.log(`AUTO_MERGE is ignored: this loop never merges.`);
  let idlePosted = false;
  let iteration = 0;
  while (iteration < MAX_ITERATIONS) {
    sh("git", ["fetch", "origin", BASE_BRANCH]);
    sh("git", ["checkout", "--detach", `origin/${BASE_BRANCH}`]);
    const skip = new Set<number>([...waiting, ...failed]);
    // nextIssue() treats numbers in its argument as closed. Pass an empty set, filter here,
    // so that waiting and failed issues still block their dependents.
    const issue = nextIssueSkipping(skip);
    if (!issue) {
      if (openSandcastleCount() === 0) {
        console.log("No open Sandcastle issue. Done.");
        await postEvent("done");
        return;
      }
      if (!idlePosted) {
        console.log(
          `No ready issue. Waiting PRs: ${[...waiting].join(",") || "none"}. Failed: ${[...failed].join(",") || "none"}.`,
        );
        await postEvent("loop_idle");
        idlePosted = true;
      }
      // Tomasz can merge a PR or close an issue at any time. Forget the sets and look again.
      waiting.clear();
      idleStatus(`no ready issue; poll every ${IDLE_POLL_MINUTES} min`);
      await sleepUntil(Date.now() + IDLE_POLL_MINUTES * 60_000);
      // failed issues stay failed until a restart of the loop.
      continue;
    }
    idlePosted = false;
    iteration++;
    console.log(
      `\n=== Iteration ${iteration}/${MAX_ITERATIONS}: issue #${issue.number} ${issue.title} ===\n`,
    );
    currentIssue = issue.number;

    const existing = JSON.parse(
      sh("gh", ["pr", "list", "--state", "open", "--json", "url,headRefName"]),
    ).find((p: { headRefName: string }) =>
      p.headRefName.startsWith(`sandcastle/issue-${issue.number}-`),
    );
    const branch: string =
      existing?.headRefName ?? `sandcastle/issue-${issue.number}-${Date.now()}`;
    const args = { PROJECT, ISSUE: String(issue.number), BRANCH: branch };

    if (existing) {
      console.log(`Resume the open PR ${existing.url}.`);
      if (ciState(existing.url) === "success") {
        waiting.add(issue.number);
        markWaiting(existing.url, issue.number, false);
        continue;
      }
      if (await waitCiWithFixes(existing.url, branch, issue.number)) {
        waiting.add(issue.number);
        markWaiting(existing.url, issue.number, true);
      } else {
        await giveUp(
          issue.number,
          `Sandcastle stopped work on this issue. CI fails after ${MAX_FIX_ATTEMPTS} fix attempts. PR: ${existing.url}`,
          existing.url,
        );
      }
      continue;
    }

    let passed = false;
    let commits = 0;
    const sandbox = await sandcastle.createSandbox({
      branch,
      baseBranch: `origin/${BASE_BRANCH}`,
      sandbox: podman({ imageName: "localhost/sandcastle:pacholczyk-pogrzeby-www" }),
      hooks,
    });
    try {
      const implement = await runPhase(sandbox, {
        name: "implementer",
        maxIterations: 1,
        promptFile: "./.sandcastle/implement-prompt.md",
        promptArgs: args,
      });
      commits = implement.commits.length;
      if (commits) {
        await runPhase(sandbox, {
          name: "reviewer",
          maxIterations: 1,
          promptFile: "./.sandcastle/review-prompt.md",
          promptArgs: args,
        });
        for (let attempt = 0; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
          const result = await runChecks(sandbox);
          if (result.ok) {
            passed = true;
            break;
          }
          console.log(`Checks failed for #${issue.number} (attempt ${attempt}).`);
          if (attempt === MAX_FIX_ATTEMPTS) break;
          await runPhase(sandbox, {
            name: `fixer-${attempt + 1}`,
            maxIterations: 1,
            promptFile: "./.sandcastle/fix-prompt.md",
            promptArgs: { ...args, CHECK_LOG: result.log.slice(-12000) },
            checkLog: result.log.slice(-12000),
          });
        }
      }
    } finally {
      await sandbox.close();
    }

    if (!commits) {
      await giveUp(
        issue.number,
        "Sandcastle stopped work on this issue. The implementer made no commit. Read the issue comments for the reason.",
      );
      continue;
    }
    if (!passed) {
      sh("git", ["push", "-f", "origin", branch]);
      await giveUp(
        issue.number,
        `Sandcastle stopped work on this issue. The local checks fail after ${MAX_FIX_ATTEMPTS} fix attempts. Branch: \`${branch}\`.`,
      );
      continue;
    }

    sh("git", ["push", "-f", "origin", branch]);
    const url = sh("gh", [
      "pr",
      "create",
      "--base",
      BASE_BRANCH,
      "--head",
      branch,
      "--title",
      `#${issue.number}: ${issue.title}`,
      "--body",
      `This PR implements #${issue.number}.\n\n${withVerification(sh("git", ["log", "--reverse", "--format=%B", `origin/${BASE_BRANCH}..${branch}`]))}\n\nThe local checks pass: ${CHECK_NAMES}.\n\nThe loop does not merge. Tomasz gives the OK.\n\nCloses #${issue.number}`,
    ]);
    console.log(`Opened ${url}.`);
    await postEvent("pr_opened", { issue: issue.number, pr: url });
    if (await waitCiWithFixes(url, branch, issue.number)) {
      waiting.add(issue.number);
      markWaiting(url, issue.number, true);
    } else {
      await giveUp(
        issue.number,
        `Sandcastle stopped work on this issue. CI fails after ${MAX_FIX_ATTEMPTS} fix attempts. PR: ${url}`,
        url,
      );
    }
  }
  console.log(`MAX_ITERATIONS (${MAX_ITERATIONS}) reached. Stopping.`);
  await postEvent("loop_idle");
}

function nextIssueSkipping(skip: Set<number>): Issue | undefined {
  const saved = [...SKIP];
  for (const n of skip) SKIP.add(n);
  try {
    return nextIssue(new Set());
  } finally {
    SKIP.clear();
    for (const n of saved) SKIP.add(n);
  }
}

try {
  await mainLoop();
} catch (e) {
  console.log(`Loop crashed: ${`${e}`.slice(0, 500)}`);
  await postEvent("loop_crashed", currentIssue ? { issue: currentIssue } : {});
  process.exitCode = 1;
}

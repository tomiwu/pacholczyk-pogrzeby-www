// Unit tests for loop-policy.mts. No network, no git. Run: npx tsx .sandcastle/loop-policy-test.mts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  agentBeforePhase,
  effortFor,
  isFormatOnlyFailure,
  limitWait,
  nextAgentAfterStall,
  parseResetAt,
  phaseOfName,
  sleepUntil,
  writeStatus,
} from "./loop-policy.mts";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) console.log(`ok   ${name}`);
  else {
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
    fails++;
  }
};
const iso = (ms: number | undefined) =>
  ms === undefined ? "undefined" : new Date(ms).toISOString();

// 2026-11-13 09:32 UTC (10:32 CET).
const now = Date.UTC(2026, 10, 13, 9, 32);
const msg = "You've hit your 5-hour limit · resets 1:30pm (UTC)";
check(
  "reset: 1:30pm (UTC) today",
  iso(parseResetAt(msg, now)) === "2026-11-13T13:30:00.000Z",
  iso(parseResetAt(msg, now)),
);
check(
  "reset: 3:30am (UTC) is tomorrow",
  iso(parseResetAt("resets 3:30am (UTC)", now)) === "2026-11-14T03:30:00.000Z",
  iso(parseResetAt("resets 3:30am (UTC)", now)),
);
check(
  "reset: 18:50 Europe/Warsaw (CET, UTC+1)",
  iso(parseResetAt("resets 18:50 (Europe/Warsaw)", now)) ===
    "2026-11-13T17:50:00.000Z",
  iso(parseResetAt("resets 18:50 (Europe/Warsaw)", now)),
);
check(
  "reset: 7pm without a zone is UTC",
  iso(parseResetAt("limit · resets 7pm", now)) === "2026-11-13T19:00:00.000Z",
);
check(
  "reset: 12am is midnight",
  iso(parseResetAt("resets 12am (UTC)", now)) === "2026-11-14T00:00:00.000Z",
);
check(
  "reset: relative 'resets in 2 hours'",
  parseResetAt("It resets in 2 hours.", now) === now + 7_200_000,
);
check(
  "reset: relative 'resets in 1 day'",
  parseResetAt("It resets in 1 day.", now) === now + 86_400_000,
);
check(
  "reset: no time -> undefined",
  parseResetAt("rate limit, try later", now) === undefined,
);
check(
  "reset: a bare number is not a time",
  parseResetAt("the counter resets 3 times", now) === undefined,
);
check(
  "reset: unknown zone -> undefined",
  parseResetAt("resets 6:30pm (Mars/Olympus)", now) === undefined,
);

const w = limitWait(msg, now, 30);
check(
  "wait: until reset + 2 min",
  iso(w.untilMs) === "2026-11-13T13:32:00.000Z",
  iso(w.untilMs),
);
check(
  "wait: no reset -> fixed pause",
  limitWait("overloaded", now, 30).untilMs === now + 30 * 60_000,
);
check(
  "wait: capped at 6 h",
  limitWait("It resets in 3 days.", now, 30).untilMs === now + 6 * 3_600_000,
);

const chain = [
  "Claude Code (claude-opus-5-5)",
  "Claude Code (claude-sonnet-5-5)",
  "Cursor CLI (composer-2.5)",
  "Cursor CLI (cursor-grok-4.5-high)",
];
check(
  "chain: Claude limit on Opus skips Sonnet",
  nextAgentAfterStall(chain, 0, msg) === 2,
);
check(
  "chain: other Opus error -> Sonnet",
  nextAgentAfterStall(chain, 0, "model not found") === 1,
);
check(
  "chain: Composer stall -> Grok",
  nextAgentAfterStall(chain, 2, "usage limit") === 3,
);
check("chain: last agent -> -1", nextAgentAfterStall(chain, 3, "x") === -1);
check(
  "chain: Claude-only chain + limit -> -1 (pause)",
  nextAgentAfterStall(["Claude Code (claude-fable-5-2)"], 0, msg) === -1,
);
check(
  "back to Claude after the reset",
  agentBeforePhase(chain, 2, now - 1, now) === 0,
);
check(
  "stay on Composer before the reset",
  agentBeforePhase(chain, 2, now + 60_000, now) === 2,
);
check(
  "stay on Claude when no limit is known",
  agentBeforePhase(chain, 1, undefined, now) === 1,
);

const fmtLog =
  "== fmt\nDiff in /home/agent/crates/ui/src/lib.rs at line 4:\n-fn a(){}\n+fn a() {}\n";
const clippyLog =
  "error: this `if` has identical blocks\n  = help: for further information visit https://rust-lang.github.io/rust-clippy/master/index.html#if_same_then_else\n  = note: `-D clippy::if-same-then-else` implied by `-D warnings`";
const testLog =
  "test widgets::clothes ... FAILED\ntest result: FAILED. 1 passed; 1 failed";
check("format-only: rustfmt diff", isFormatOnlyFailure(fmtLog));
check("format-only: clippy lint", isFormatOnlyFailure(clippyLog));
check(
  "format-only: failed test is not format-only",
  !isFormatOnlyFailure(`${fmtLog}${testLog}`),
);
check(
  "format-only: compile error is not format-only",
  !isFormatOnlyFailure(
    "error[E0004]: non-exhaustive patterns: `DrawPart::Chrome` not covered",
  ),
);
check("effort: implementer high", effortFor("implementer", {}) === "high");
check("effort: format fixer low", effortFor("fixer-format", {}) === "low");
check(
  "effort: env override",
  effortFor("reviewer", { EFFORT_REVIEWER: "xhigh" }) === "xhigh",
);
check(
  "effort: bad env value ignored",
  effortFor("fixer", { EFFORT_FIXER: "turbo" }) === "medium",
);
check(
  "phase: fixer with fmt log -> fixer-format",
  phaseOfName("fixer-1", fmtLog) === "fixer-format",
);
check(
  "phase: fixer with test log -> fixer",
  phaseOfName("fixer-2", testLog) === "fixer",
);

const dir = mkdtempSync(join(tmpdir(), "loop-policy-"));
const f = join(dir, "status.json");
writeStatus(f, {
  phase: "implementer",
  model: "claude-opus-5-5",
  agent: "Claude Code (claude-opus-5-5)",
  issue: 236,
  startedAt: "x",
  lastOutputAt: null,
  pid: 1,
});
const s = JSON.parse(readFileSync(f, "utf8"));
check(
  "status: JSON with phase, model, issue, startedAt, lastOutputAt",
  s.phase === "implementer" &&
    s.model === "claude-opus-5-5" &&
    s.issue === 236 &&
    "lastOutputAt" in s &&
    typeof s.updatedAt === "string",
);

const t0 = Date.now();
await sleepUntil(t0 + 120, 20);
check("sleepUntil: wall-clock deadline reached", Date.now() - t0 >= 120);
await sleepUntil(t0 - 1000);
check("sleepUntil: past deadline returns at once", Date.now() - t0 < 1000);

if (fails) {
  console.log(`\n${fails} loop-policy test(s) failed.`);
  process.exit(1);
}
console.log("\nAll loop-policy tests passed.");

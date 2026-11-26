// Loop policy helpers (2026-11-13, review of the Lydia Hallie talk, approved by tomiwu).
// Pure functions, plus one atomic status-file writer. Same file in every Sandcastle loop:
// e1003-firmware, automations, e1003-calendar and the project-blueprint template.
// Self-test: `npx tsx .sandcastle/loop-policy-test.mts`.
import { renameSync, writeFileSync } from "node:fs";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type Phase =
  | "implementer"
  | "xtensa-fixer"
  | "reviewer"
  | "fixer"
  | "fixer-format";

// ---------- 1. Limit-reset-aware wall-clock wait ----------

// The Claude subscription limit is shared by all Claude models (Opus, Sonnet, Fable).
// Text of a Claude limit: "You've hit your 5-hour limit · resets 6:30pm (UTC)".
export const CLAUDE_LIMIT =
  /hit your (?:[\w-]+ )?limit|usage limit|limit reached|rate limit|out of (?:extra )?usage/i;

export const isClaudeLabel = (label: string) => /^Claude Code\b/.test(label);

// Offset (ms) of an IANA time zone at a UTC instant. Unknown zone: undefined.
function zoneOffsetMs(utcMs: number, zone: string): number | undefined {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs));
  } catch {
    return undefined;
  }
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return (
    Date.UTC(
      n("year"),
      n("month") - 1,
      n("day"),
      n("hour"),
      n("minute"),
      n("second"),
    ) -
    Math.floor(utcMs / 1000) * 1000
  );
}

// The next instant after nowMs when the wall clock in `zone` shows hour:minute.
function nextWallTime(
  nowMs: number,
  hour: number,
  minute: number,
  zone: string,
): number | undefined {
  const off = zoneOffsetMs(nowMs, zone);
  if (off === undefined) return undefined;
  const local = new Date(nowMs + off);
  let guess =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      hour,
      minute,
    ) - off;
  const off2 = zoneOffsetMs(guess, zone);
  if (off2 !== undefined && off2 !== off) guess += off - off2;
  // A reset time in the past (more than 1 min ago) means the same time tomorrow.
  return guess < nowMs - 60_000 ? guess + 24 * 3600_000 : guess;
}

// Parse the reset time from a limit message. Returns epoch ms, or undefined.
// Formats: "resets 6:30pm (UTC)", "resets 18:30 (Europe/Warsaw)", "resets 7pm", "resets in 2 hours".
export function parseResetAt(text: string, nowMs: number): number | undefined {
  const rel = text.match(/resets? in (\d+) ?(minute|min|hour|hr|day)s?\b/i);
  if (rel) {
    const unit = rel[2].toLowerCase();
    const ms = unit.startsWith("m")
      ? 60_000
      : unit.startsWith("d")
        ? 86_400_000
        : 3_600_000;
    return nowMs + Number(rel[1]) * ms;
  }
  const abs = text.match(
    /resets?(?: at)? (\d{1,2})(?::(\d{2}))?(?: ?(am|pm))?(?: \(([A-Za-z_]+(?:\/[A-Za-z_]+)*)\))?/i,
  );
  if (!abs) return undefined;
  let hour = Number(abs[1]);
  const minute = Number(abs[2] ?? "0");
  const ampm = abs[3]?.toLowerCase();
  if (!abs[2] && !ampm) return undefined;
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return undefined;
  return nextWallTime(nowMs, hour, minute, abs[4] ?? "UTC");
}

export interface LimitWait {
  untilMs: number;
  reason: string;
}

// How long to wait after a Claude limit: until the parsed reset plus a margin, capped.
// No parsed reset: the fixed pause. Always a wall-clock deadline (a box pause does not freeze it).
export function limitWait(
  text: string,
  nowMs: number,
  pauseMinutes: number,
  maxHours = 6,
  marginMinutes = 2,
): LimitWait {
  const reset = parseResetAt(text, nowMs);
  if (reset === undefined)
    return {
      untilMs: nowMs + pauseMinutes * 60_000,
      reason: `no reset time in the message, fixed pause ${pauseMinutes} min`,
    };
  const until = Math.min(
    Math.max(reset, nowMs) + marginMinutes * 60_000,
    nowMs + maxHours * 3600_000,
  );
  return {
    untilMs: until,
    reason: `limit resets ${new Date(reset).toISOString()}`,
  };
}

// Next agent after a stall. A Claude limit skips the other Claude agents (same shared limit).
// Returns -1 when no agent is left (the caller pauses).
export function nextAgentAfterStall(
  labels: string[],
  index: number,
  failureText: string,
): number {
  if (isClaudeLabel(labels[index]) && CLAUDE_LIMIT.test(failureText)) {
    for (let i = index + 1; i < labels.length; i++)
      if (!isClaudeLabel(labels[i])) return i;
    return -1;
  }
  return index + 1 < labels.length ? index + 1 : -1;
}

// Before a phase: go back to the first agent (Claude) when its limit has reset.
export function agentBeforePhase(
  labels: string[],
  index: number,
  claudeResetAtMs: number | undefined,
  nowMs: number,
): number {
  if (claudeResetAtMs === undefined || isClaudeLabel(labels[index]))
    return index;
  return nowMs >= claudeResetAtMs ? 0 : index;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Wall-clock sleep: poll Date.now(), so a suspended box does not extend the wait.
export async function sleepUntil(
  deadlineMs: number,
  pollMs = 5_000,
): Promise<void> {
  for (;;) {
    const left = deadlineMs - Date.now();
    if (left <= 0) return;
    await sleep(Math.min(pollMs, left));
  }
}

// ---------- 9. Effort for each phase ----------

// A check log with only format or clippy failures (no failed test, no compile error).
export function isFormatOnlyFailure(log: string): boolean {
  const formatOrLint =
    /^Diff in |rustfmt|prettier|biome format|clippy::|eslint|^warning: /m.test(
      log,
    );
  const hard =
    /test result: FAILED|panicked at|error\[E\d{4}\]|\bFAILED\b|AssertionError|failures?:|coverage .*(below|less)|CRAP/i.test(
      log,
    );
  return formatOrLint && !hard;
}

const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
// Effort per phase. Env overrides: EFFORT_IMPLEMENTER, EFFORT_REVIEWER, EFFORT_FIXER, EFFORT_FIXER_FORMAT.
export function effortFor(
  phase: Phase,
  env: Record<string, string | undefined> = process.env,
): Effort {
  const defaults: Record<Phase, Effort> = {
    implementer: "high",
    "xtensa-fixer": "medium",
    reviewer: "high",
    fixer: "medium",
    "fixer-format": "low",
  };
  const key = `EFFORT_${phase.toUpperCase().replace(/-/g, "_")}`;
  const v = env[key];
  return v && EFFORTS.has(v) ? (v as Effort) : defaults[phase];
}

export const phaseOfName = (name: string, checkLog = ""): Phase =>
  name === "implementer"
    ? "implementer"
    : name === "reviewer"
      ? "reviewer"
      : name.startsWith("xtensa-fixer")
        ? "xtensa-fixer"
        : isFormatOnlyFailure(checkLog)
          ? "fixer-format"
          : "fixer";

// ---------- Status file (replaces the one-line model file, which stays for old scripts) ----------

export interface LoopStatus {
  phase: string;
  model: string;
  agent: string;
  issue: number | null;
  startedAt: string;
  lastOutputAt: string | null;
  pid: number;
  updatedAt?: string;
  note?: string;
}

// Atomic write (temp file + rename), mode 600. A failed write never stops the loop.
export function writeStatus(file: string, status: LoopStatus): void {
  try {
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(
      tmp,
      `${JSON.stringify({ ...status, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      { mode: 0o600 },
    );
    renameSync(tmp, file);
  } catch (e) {
    console.log(
      `Cannot write the status file ${file}: ${`${e}`.slice(0, 200)}`,
    );
  }
}

export const modelOfLabel = (label: string) =>
  label.match(/\(([^)]+)\)/)?.[1] ?? label;

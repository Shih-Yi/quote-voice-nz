// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// The Stop hook looks at the working tree, so each example gets a throwaway
// git repo and runs the hook from inside it.
const hook = path.resolve(__dirname, "../../.claude/hooks/guard-stop.sh");

let repo: string;

function git(...args: string[]) {
  execFileSync("git", args, { cwd: repo, stdio: "pipe" });
}

function write(rel: string, content: string) {
  const full = path.join(repo, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function runHook(stopHookActive = false) {
  const payload = JSON.stringify({ stop_hook_active: stopHookActive });
  const r = spawnSync(hook, { cwd: repo, input: payload, encoding: "utf8" });
  return { err: r.stderr ?? "", code: r.status };
}

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), "guard-stop-"));
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  write("README.md", "hi\n");
  git("add", ".");
  git("commit", "-qm", "init");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe(".claude/hooks/guard-stop.sh", () => {
  it("passes a clean tree", () => {
    expect(runHook().code).toBe(0);
  });

  it("flags a staged .env.local", () => {
    write(".env.local", "SECRET=1\n");
    git("add", "-f", ".env.local");
    const r = runHook();
    expect(r.code).toBe(2);
    expect(r.err).toContain(".env.local");
  });

  it("flags a staged .pem", () => {
    write("certs/dev.pem", "x\n");
    git("add", "-f", "certs/dev.pem");
    expect(runHook().code).toBe(2);
  });

  // .env.example is documentation and is tracked on purpose.
  it("does not flag .env.example", () => {
    write(".env.example", "SECRET=\n");
    git("add", "-f", ".env.example");
    expect(runHook().code).toBe(0);
  });

  // Fixture strings are split so the hook does not flag this file itself.
  const FOCUSED_TEST = ["it", ".only('x', () => {})\n"].join("");
  const DEBUGGER = ["debug", "ger;\n"].join("");
  const CONSOLE_LOG = ["console", ".log('here')\n"].join("");

  it("flags a focused vitest test", () => {
    write("lib/__tests__/x.test.ts", FOCUSED_TEST);
    const r = runHook();
    expect(r.code).toBe(2);
    expect(r.err).toContain("Focused");
  });

  it("flags a leftover debug breakpoint statement", () => {
    write("lib/x.ts", `export const a = 1;\n${DEBUGGER}`);
    const r = runHook();
    expect(r.code).toBe(2);
    expect(r.err).toContain("debug");
  });

  it("flags a leftover console.log", () => {
    write("app/page.tsx", CONSOLE_LOG);
    expect(runHook().code).toBe(2);
  });

  it("lets a second stop through so the session can end", () => {
    write("lib/x.ts", DEBUGGER);
    expect(runHook(true).code).toBe(0);
  });
});

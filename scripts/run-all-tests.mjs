/**
 * Run every `test:*` script declared in package.json, in order, and report a
 * single pass/fail summary.
 *
 * Why this exists: the repo accumulated 36 standalone test scripts with no way
 * to run them together — so "did I break anything?" meant remembering and
 * typing 36 commands, and in practice meant running the 5 or 6 you happened to
 * remember. A regression in any unlisted one was invisible.
 *
 * Reads the script list from package.json rather than hardcoding it, so a new
 * `test:*` entry is picked up automatically and can't be forgotten here.
 *
 * `test:chat` is excluded by default: it makes a real AI provider call, which
 * costs money/quota and fails on a dead key (this repo's Gemini quota is
 * documented dead) — a network-dependent failure would make this suite look
 * broken when the code is fine. Run it explicitly with `npm run test:chat`.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const EXCLUDED = new Set(["test:chat", "test:all"]);

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
const testScripts = Object.keys(pkg.scripts)
  .filter((name) => name.startsWith("test:") && !EXCLUDED.has(name))
  .sort();

console.log(`Running ${testScripts.length} test suites...\n`);

const failures = [];
const passes = [];

for (const name of testScripts) {
  process.stdout.write(`  ${name.padEnd(32)} `);
  try {
    execSync(`npm run ${name} --silent`, { stdio: "pipe", encoding: "utf-8" });
    console.log("✅");
    passes.push(name);
  } catch (err) {
    console.log("❌");
    // Keep the tail of the output — enough to see the failing assertion
    // without dumping every passing line of a 80-test suite.
    const output = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim().split("\n").slice(-12).join("\n");
    failures.push({ name, output });
  }
}

console.log(`\n${"─".repeat(60)}`);
console.log(`  ${passes.length} passed, ${failures.length} failed, ${testScripts.length} total`);

if (failures.length > 0) {
  for (const f of failures) {
    console.log(`\n${"─".repeat(60)}\n❌ ${f.name}\n${f.output}`);
  }
  process.exitCode = 1;
}

import { test } from "node:test";
import assert from "node:assert";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pruneOldRunDirs, toPlaywrightArgs } from "./run-e2e-utils";

const makeRunDirs = () => {
  const root = mkdtempSync(join(tmpdir(), "e2e-runs-"));
  const runs = join(root, "runs");
  mkdirSync(runs);

  for (const [name, mtime] of [
    ["old", 1_000],
    ["mid", 2_000],
    ["new", 3_000],
  ] as const) {
    const path = join(runs, name);
    mkdirSync(path);
    utimesSync(path, mtime, mtime);
  }

  return { root, runs };
};

test("pruneOldRunDirs keeps the newest runs and deletes the rest", (t) => {
  const { root, runs } = makeRunDirs();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const removed = pruneOldRunDirs(runs, 2);

  assert.deepStrictEqual(removed, [join(runs, "old")]);
  assert.strictEqual(existsSync(join(runs, "old")), false);
  assert.strictEqual(existsSync(join(runs, "mid")), true);
  assert.strictEqual(existsSync(join(runs, "new")), true);
});

test("pruneOldRunDirs removes every run when keep is zero", (t) => {
  const { root, runs } = makeRunDirs();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const removed = pruneOldRunDirs(runs, 0);

  assert.strictEqual(removed.length, 3);
  assert.deepStrictEqual(existsSync(runs), true);
});

test("pruneOldRunDirs tolerates a missing runs directory", () => {
  assert.deepStrictEqual(pruneOldRunDirs(join(tmpdir(), "no-such-e2e-runs"), 5), []);
});

test("toPlaywrightArgs strips runner-only flags", () => {
  assert.deepStrictEqual(toPlaywrightArgs(["--doctor", "tests/a.spec.ts", "--"]), [
    "tests/a.spec.ts",
  ]);
});

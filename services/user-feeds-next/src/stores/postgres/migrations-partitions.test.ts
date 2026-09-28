import { describe, it } from "node:test";
import assert from "node:assert";
import type { Pool } from "pg";
import { ensurePartitionsExist } from "./migrations";

function stubPool(behavior: () => Promise<unknown>): Pool {
  return { query: behavior } as unknown as Pool;
}

describe("ensurePartitionsExist", () => {
  it("does not throw when a partition already exists (duplicate_table)", async () => {
    let calls = 0;
    const pool = stubPool(async () => {
      calls++;
      const err = new Error(
        `relation "delivery_record_partitioned_y2026m10" already exists`
      );
      (err as { code?: string }).code = "42P07";
      throw err;
    });

    await assert.doesNotReject(ensurePartitionsExist(pool));
    assert.ok(calls > 0);
  });

  it("rethrows errors other than duplicate_table", async () => {
    const pool = stubPool(async () => {
      const err = new Error("connection refused");
      (err as { code?: string }).code = "ECONNREFUSED";
      throw err;
    });

    await assert.rejects(ensurePartitionsExist(pool), /connection refused/);
  });

  it("succeeds on a fresh database", async () => {
    const executed: string[] = [];
    const pool = stubPool(async (sql: string) => {
      executed.push(sql);
      return { rows: [] };
    });

    await assert.doesNotReject(ensurePartitionsExist(pool));
    const createStatements = executed.filter((sql) =>
      sql.includes("CREATE TABLE IF NOT EXISTS")
    );
    assert.strictEqual(createStatements.length, 4);
  });
});

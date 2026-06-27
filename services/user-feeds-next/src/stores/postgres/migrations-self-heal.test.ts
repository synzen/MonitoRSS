import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { runMigrations } from "./migrations";
import {
  setupTestDatabase,
  teardownTestDatabase,
  type TestStores,
} from "../../../test/helpers/setup-integration-tests";

let stores: TestStores;

before(async () => {
  stores = await setupTestDatabase();
});

after(async () => {
  await teardownTestDatabase();
});

async function migrationVersions(): Promise<string[]> {
  const { rows } = await stores.pool.query(
    `SELECT version FROM schema_migrations ORDER BY version`
  );
  return rows.map((r: { version: string }) => r.version);
}

describe("runMigrations self-healing", () => {
  beforeEach(async () => {
    await stores.truncate();
  });

  it("does not throw when re-run against a DB whose schema already exists but tracker is empty", async () => {
    // Reproduce the prod drift: the template DB already has the full schema
    // (tables, enum types, partitions) but we wipe the migration tracker so the
    // runner believes every migration is pending.
    await stores.pool.query(`DELETE FROM schema_migrations`);
    assert.deepStrictEqual(await migrationVersions(), []);

    await assert.doesNotReject(runMigrations(stores.pool));
  });

  it("records the baseline migrations as applied after self-healing", async () => {
    await stores.pool.query(`DELETE FROM schema_migrations`);

    await runMigrations(stores.pool);

    const versions = await migrationVersions();
    assert.ok(
      versions.includes("20251206_001"),
      `expected baseline initial_schema recorded, got ${JSON.stringify(versions)}`
    );
    // Migrations newer than the backfilled baseline still run and get recorded.
    assert.ok(
      versions.includes("20251210_001"),
      `expected later migration recorded, got ${JSON.stringify(versions)}`
    );
  });

  it("is a no-op on an already-fully-migrated DB", async () => {
    // Template DB starts fully migrated; running again should change nothing.
    const before = await migrationVersions();
    await runMigrations(stores.pool);
    const after = await migrationVersions();
    assert.deepStrictEqual(after, before);
  });
});

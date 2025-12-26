import { Client, Pool } from "pg";
import { runMigrations, ensurePartitionsExist } from "../../src/stores/postgres";
import { TEMPLATE_DB_NAME, getAdminUri, getTemplateDbUri } from "./test-constants";

async function prepareTemplateDatabase(): Promise<void> {
  // Use simple Client for admin operations (not Pool - less overhead)
  const adminClient = new Client({ connectionString: getAdminUri() });
  await adminClient.connect();

  try {
    // Drop template if exists (for fresh runs)
    await adminClient.query(`DROP DATABASE IF EXISTS ${TEMPLATE_DB_NAME}`);
    // Create template database
    await adminClient.query(`CREATE DATABASE ${TEMPLATE_DB_NAME}`);
  } finally {
    await adminClient.end();
  }

  // Run migrations on template (use Pool here since migrations may use transactions)
  const templatePool = new Pool({ connectionString: getTemplateDbUri(), max: 1 });

  try {
    await runMigrations(templatePool);
    await ensurePartitionsExist(templatePool);
  } finally {
    await templatePool.end();
  }

  console.log("Template database prepared successfully");
}

prepareTemplateDatabase().catch((err) => {
  console.error("Failed to prepare template database:", err);
  process.exit(1);
});

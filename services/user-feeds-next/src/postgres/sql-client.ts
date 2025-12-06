import { SQL } from "bun";

let sqlClient: SQL | null = null;

export function initSqlClient(connectionUri: string): SQL {
  sqlClient = new SQL(connectionUri);
  return sqlClient;
}

export function getSqlClient(): SQL {
  if (!sqlClient) {
    throw new Error("SQL client not initialized");
  }
  return sqlClient;
}

export async function closeSqlClient(): Promise<void> {
  if (sqlClient) {
    await sqlClient.close();
    sqlClient = null;
  }
}

import { randomUUID } from "node:crypto";
import mongoose, { type Connection } from "mongoose";
import { getTestDbUri } from "./test-constants";

let testConnection: Connection | null = null;
let currentDatabaseName: string | null = null;

export async function setupTestDatabase(): Promise<Connection> {
  currentDatabaseName = `test_${randomUUID().replace(/-/g, "")}`;
  const uri = getTestDbUri(currentDatabaseName);

  testConnection = mongoose.createConnection(uri);
  await testConnection.asPromise();

  return testConnection;
}

export async function teardownTestDatabase(): Promise<void> {
  if (testConnection) {
    // Drop the test database before closing
    await testConnection.dropDatabase();
    await testConnection.close();
    testConnection = null;
  }
  currentDatabaseName = null;
}

export function getTestConnection(): Connection {
  if (!testConnection) {
    throw new Error(
      "Test database not initialized. Call setupTestDatabase() first."
    );
  }
  return testConnection;
}

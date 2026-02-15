import mongoose, { type Connection } from "mongoose";
import logger from "./logger";

export async function createMongoConnection(uri: string): Promise<Connection> {
  const connection = mongoose.createConnection(uri, {
    autoIndex: process.env.NODE_ENV !== "production",
  });

  await connection.asPromise();

  const maskedUri = new URL(uri);
  maskedUri.password = "****";
  logger.info(`Connected to MongoDB at ${maskedUri.host}`);

  return connection;
}

export async function closeMongoConnection(
  connection: Connection,
): Promise<void> {
  await connection.close();
  logger.info("MongoDB connection closed");
}

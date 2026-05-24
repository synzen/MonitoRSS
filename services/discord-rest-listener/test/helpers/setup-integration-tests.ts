import { MongoClient } from "mongodb"
import { randomUUID } from "crypto"
import type { ConfigType } from "../../src/schemas/ConfigSchema"

const MONGO_BASE_URI = process.env.DISCORD_REST_LISTENER_MONGO_URI ?? "mongodb://localhost:27017"
const RABBITMQ_URI = process.env.DISCORD_REST_LISTENER_RABBITMQ_URI ?? "amqp://localhost:5672"

export interface TestEnvironment {
  config: ConfigType
  databaseName: string
  clientId: string
  drop: () => Promise<void>
}

function trimTrailingSlash(uri: string): string {
  return uri.endsWith("/") ? uri.slice(0, -1) : uri
}

function buildDatabaseUri(databaseName: string): string {
  const base = trimTrailingSlash(MONGO_BASE_URI.split("?")[0])
  const query = MONGO_BASE_URI.includes("?") ? `?${MONGO_BASE_URI.split("?")[1]}` : ""
  return `${base}/${databaseName}${query}`
}

/**
 * Allocate a fresh Mongo database + unique RabbitMQ client ID for a test file.
 * Returns a config the test can pass to createConsumerApp.
 *
 * Each call mints a unique database name so parallel test files don't collide.
 */
export function setupTestEnvironment(): TestEnvironment {
  const suffix = `${Date.now()}_${randomUUID().slice(0, 8)}`
  const databaseName = `test_drl_${suffix}`
  const clientId = `test-client-${suffix}`

  const config: ConfigType = {
    token: "test-bot-token",
    databaseURI: buildDatabaseUri(databaseName),
    rabbitmqUri: RABBITMQ_URI,
    discordClientId: clientId,
    maxRequestsPerSecond: 100,
  }

  return {
    config,
    databaseName,
    clientId,
    async drop() {
      const adminUri = trimTrailingSlash(MONGO_BASE_URI.split("?")[0])
      const client = new MongoClient(adminUri)
      try {
        await client.connect()
        await client.db(databaseName).dropDatabase()
      } finally {
        await client.close()
      }
    },
  }
}

export function getRabbitMqUri(): string {
  return RABBITMQ_URI
}

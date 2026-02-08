# Migration Plan: backend-api from NestJS to Plain Fastify

## Overview

Create a new `services/backend-api-next` service using plain Fastify, migrating code from `services/backend-api`. This eliminates NestJS pain points (slow DX, obscure bugs, cyclic dependencies) while allowing both services to run in parallel during development.

## CRITICAL: Status Tracking (MANDATORY)

**STATUS UPDATES ARE NON-NEGOTIABLE.** Every implementation plan MUST include a final step to update this document. A task is NOT complete until this document reflects its completion.

### Requirements

1. **Every plan MUST include status update step** — When writing an implementation plan for any task in this migration, the plan MUST explicitly include updating this document as a required step (not optional, not "if time permits")
2. **Update IMMEDIATELY after implementation** — Do not batch updates or defer them. Update this document as soon as the implementation is verified working
3. **Mark with ✅ DONE** — Change task status from ❌ TODO or 🔄 IN PROGRESS to ✅ DONE
4. **Update verification checkboxes** — Check off `[x]` for completed verification items
5. **A task without status update is incomplete** — If you implemented something but didn't update this doc, go back and update it NOW

### Enforcement

Plans that omit the status update step are incomplete plans. The status update is as mandatory as writing tests or running verification commands.

## CRITICAL: No Silent Deviations

**If ANY deviation from this plan is needed during implementation — no matter how small — it MUST be clearly verbalized to the user during the planning phase, BEFORE implementation begins.** This includes changes to file structure, naming, patterns, skipped steps, added steps, or any other departure from what is documented here. Do not silently deviate and explain after the fact.

## Design Decisions

- **Validation**: Fastify JSON Schema (fast, no extra deps, generates OpenAPI docs)
- **Folder structure**: Keep feature-based organization (easier migration, familiar)
- **Exceptions**: Keep exception classes, catch and convert in centralized error handler
- **Testing**: `node:test` with parallel execution (same as user-feeds-next)
- **RabbitMQ**: `rabbitmq-client` (same as user-feeds-next)
- **No barrel exports**: Import directly from source files, not via `index.ts` re-exports
- **Skip user feed tags**: User feed tags are not used in production - skip all related entities, services, and API endpoints

## Test Migration Requirements

**CRITICAL**: When migrating any phase or tier, you MUST check for existing tests and follow TDD principles.

### Before Implementation

1. **Check for existing tests** - Look for `.spec.ts` files in the corresponding NestJS source location
2. **Transfer tests first** - If tests exist, port them to `node:test` format with the same assertions
3. **Add missing test cases** - If important test cases are missing, add them before implementation
4. **Verify tests fail** - Run tests against the new (unimplemented) code - they MUST fail

### TDD Cycle

```
1. Find existing tests (*.spec.ts in backend-api)
2. Port to node:test format in backend-api-next
3. Run tests → must FAIL (red)
4. Implement the code
5. Run tests → must PASS (green)
6. Refactor if needed
```

### Concurrency Requirements

**All `describe` blocks MUST use `{ concurrency: true }` by default** to maintain fast test execution via parallel test runs. Only use `concurrency: false` when tests within a block share mutable state that would cause race conditions (e.g., session manipulation, shared mock server state that changes between tests).

```typescript
// ✅ GOOD - default: concurrent
describe("GET /api/v1/user-feeds/:feedId", { concurrency: true }, () => {
  it("returns 401 without auth", async () => { ... });
  it("returns 404 for missing feed", async () => { ... });
});

// ✅ OK - sequential only when tests share mutable state
describe("Logout with session", { concurrency: false }, () => {
  it("clears session on logout", async () => { ... });
  it("returns 401 after logout", async () => { ... }); // depends on prior logout
});

// ❌ BAD - missing concurrency option (defaults to sequential, slows tests)
describe("GET /api/v1/user-feeds/:feedId", () => { ... });
```

### Why This Matters

- Ensures behavioral parity with the original implementation
- Catches regressions immediately
- Validates that tests are actually testing the right things (if they don't fail before implementation, they're not testing anything meaningful)
- Documents expected behavior before writing code

## No Barrel Exports

**Do NOT use barrel exports (index.ts re-export files).** Import directly from the source file.

```typescript
// ❌ BAD - barrel export
// shared/constants/index.ts
export * from "./discord";
export * from "./discord-permissions";

// importing via barrel
import { DISCORD_API_BASE_URL } from "../../shared/constants";

// ✅ GOOD - direct import
import { DISCORD_API_BASE_URL } from "../../shared/constants/discord";
```

### Why no barrels?

1. **Circular dependency risk** - barrels create hidden import cycles that are hard to debug
2. **Maintenance overhead** - must keep index.ts in sync when adding/removing exports
3. **Harder to trace dependencies** - less obvious what actually depends on what
4. **IDE performance** - slower autocomplete with large re-export files

### What to do

- Import directly from the file that defines what you need
- When creating new modules, do NOT create an index.ts
- If you see existing barrel exports, leave them but don't add to them

## Database Abstraction Principles

**CRITICAL**: The repository pattern must keep interfaces completely database-agnostic. This enables future migration away from MongoDB without changing services.

### Layer Responsibilities

| Layer | Location | Can import Mongoose? | ID type |
|-------|----------|---------------------|---------|
| Entity interfaces | `repositories/interfaces/` | **NO** | `string` |
| Repository interfaces | `repositories/interfaces/` | **NO** | `string` |
| Mongoose implementations | `repositories/mongoose/` | Yes | `ObjectId` internally |
| Services | `features/*/` | **NO** | `string` |

### Rules

1. **Interface files (`interfaces/*.types.ts`) must NEVER import from Mongoose**
   - No `ObjectId`, `Document`, `Model`, or any `mongoose` imports
   - All IDs are `string` type
   - All dates are `Date` type
   - Only plain TypeScript types allowed

2. **Mongoose repositories extend `BaseMongooseRepository` and implement `toEntity()`**
   - Base class enforces the mapping contract via abstract method
   - Each repo explicitly maps its fields (readable, type-safe, debuggable)
   - Shared helpers `objectIdToString()` / `stringToObjectId()` handle conversion

3. **Services only depend on repository interfaces, never Mongoose implementations**

### Base Repository Class

Create `repositories/mongoose/base.mongoose.repository.ts`:

```typescript
import { Types } from "mongoose";

export abstract class BaseMongooseRepository<TEntity, TDoc> {
  protected abstract toEntity(doc: TDoc & { _id: Types.ObjectId }): TEntity;

  // Overloaded: returns string if input is ObjectId, string | undefined if input is ObjectId | undefined
  protected objectIdToString(id: Types.ObjectId): string;
  protected objectIdToString(id: Types.ObjectId | undefined): string | undefined;
  protected objectIdToString(id: Types.ObjectId | undefined): string | undefined {
    return id?.toString();
  }

  // Overloaded: returns ObjectId if input is string, ObjectId | undefined if input is string | undefined
  protected stringToObjectId(id: string): Types.ObjectId;
  protected stringToObjectId(id: string | undefined): Types.ObjectId | undefined;
  protected stringToObjectId(id: string | undefined): Types.ObjectId | undefined {
    return id ? new Types.ObjectId(id) : undefined;
  }
}
```

### Repository Implementation Example

```typescript
// repositories/mongoose/user-feed.mongoose.repository.ts
import { Schema, Types, type Connection, type Model } from "mongoose";
import { BaseMongooseRepository } from "./base.mongoose.repository";
import type { UserFeed, UserFeedRepository, CreateUserFeedInput } from "../interfaces/user-feed.types";

// Schema (internal to this file)
const UserFeedSchema = new Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  legacyFeedId: { type: Schema.Types.ObjectId },
  user: {
    _id: { type: Schema.Types.ObjectId },
    discordUserId: { type: String, required: true },
  },
}, { timestamps: true });

// Internal doc type (not exported)
interface UserFeedDoc {
  title: string;
  url: string;
  legacyFeedId?: Types.ObjectId;
  user: {
    _id?: Types.ObjectId;
    discordUserId: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class UserFeedMongooseRepository
  extends BaseMongooseRepository<UserFeed, UserFeedDoc>
  implements UserFeedRepository
{
  private model: Model<UserFeedDoc>;

  constructor(connection: Connection) {
    super();
    this.model = connection.model<UserFeedDoc>("UserFeed", UserFeedSchema);
  }

  // REQUIRED by base class - TypeScript errors if missing
  protected toEntity(doc: UserFeedDoc & { _id: Types.ObjectId }): UserFeed {
    return {
      id: this.objectIdToString(doc._id),
      title: doc.title,
      url: doc.url,
      legacyFeedId: this.objectIdToString(doc.legacyFeedId),  // handles undefined
      user: {
        id: this.objectIdToString(doc.user._id),  // handles undefined
        discordUserId: doc.user.discordUserId,
      },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async findById(id: string): Promise<UserFeed | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(input: CreateUserFeedInput): Promise<UserFeed> {
    const doc = await this.model.create({
      title: input.title,
      url: input.url,
      legacyFeedId: this.stringToObjectId(input.legacyFeedId),  // handles undefined
      user: {
        discordUserId: input.discordUserId,
      },
    });
    return this.toEntity(doc.toObject());
  }
}
```

### Interface Example

```typescript
// ❌ WRONG - interfaces/user-feed.types.ts
import type { Types } from "mongoose";
export interface IUserFeed {
  _id: Types.ObjectId;  // Couples to MongoDB
}

// ✅ CORRECT - interfaces/user-feed.types.ts
export interface UserFeed {
  id: string;
  title: string;
  url: string;
  legacyFeedId?: string;
  user: {
    id?: string;
    discordUserId: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserFeedInput {
  title: string;
  url: string;
  legacyFeedId?: string;
  discordUserId: string;
}

export interface UserFeedRepository {
  findById(id: string): Promise<UserFeed | null>;
  create(input: CreateUserFeedInput): Promise<UserFeed>;
}
```

### Why This Matters

If we ever migrate to PostgreSQL:
1. Create `repositories/postgres/user-feed.postgres.repository.ts`
2. Implement `UserFeedRepository` interface (no base class needed - Postgres uses string UUIDs natively)
3. Swap implementation in `container.ts`
4. **Zero changes to services or handlers**

## Target Architecture

```
services/backend-api-next/
├── package.json
├── tsconfig.json
├── src/
│   ├── app.ts                # Fastify app setup
│   ├── container.ts          # Explicit dependency wiring
│   ├── config.ts             # Configuration
│   ├── main.ts               # Entry point
│   ├── features/             # Feature-based organization
│   │   ├── discord-auth/
│   │   │   ├── discord-auth.routes.ts
│   │   │   ├── discord-auth.handlers.ts
│   │   │   ├── discord-auth.schemas.ts
│   │   │   ├── discord-auth.service.ts
│   │   │   └── exceptions/
│   │   └── ... (other features)
│   ├── shared/
│   │   ├── schemas/          # Plain Mongoose schemas
│   │   └── exceptions/       # Shared exception classes
│   ├── infra/
│   │   ├── auth.ts           # Auth preHandler hook
│   │   ├── error-handler.ts  # Fastify error handler
│   │   ├── rabbitmq.ts       # rabbitmq-client wrapper
│   │   ├── mongoose.ts       # Connection setup
│   │   └── logger.ts
│   └── events/               # RabbitMQ event handlers
└── test/
```

---

# PHASE 1: Infrastructure Setup

**Goal**: Create the new service skeleton with all infrastructure in place.

**Depends on**: Nothing (can start immediately)

## Tasks

### 1.1 Create service directory and package.json
Create `services/backend-api-next/package.json` with dependencies:
- `fastify` ^5.x
- `@fastify/secure-session`
- `@fastify/compress`
- `@fastify/cookie`
- `@fastify/static`
- `mongoose` ^7.x
- `rabbitmq-client` ^5.x
- `dotenv`
- `tsx` (dev)
- `@types/node` (dev)

### 1.2 Create tsconfig.json
Copy from user-feeds-next and adapt.

### 1.3 Create src/config.ts
Port from `services/backend-api/src/config/config.ts`:
- Remove NestJS `ConfigService` usage
- Export plain config object
- Keep validation logic from `config.validate.ts`

### 1.4 Create src/infra/mongoose.ts

**Important**: Use `mongoose.createConnection()` instead of `mongoose.connect()` to avoid global state. This enables parallel test execution where each test file can have its own isolated database connection.

```typescript
import mongoose, { type Connection } from "mongoose";

export async function createMongoConnection(uri: string): Promise<Connection> {
  const connection = mongoose.createConnection(uri, {
    autoIndex: process.env.NODE_ENV !== "production",
  });
  await connection.asPromise();
  return connection;
}

export async function closeMongoConnection(connection: Connection): Promise<void> {
  await connection.close();
}
```

### 1.5 Create src/infra/rabbitmq.ts
Port from user-feeds-next pattern:
```typescript
import { Connection } from "rabbitmq-client";

export function createRabbitMQ(url: string) {
  const connection = new Connection(url);

  connection.on("error", (err) => {
    logger.error("RabbitMQ connection error", { error: err.stack });
  });

  const publisher = async (queue: string, message: unknown) => {
    const pub = connection.createPublisher({ confirm: true, maxAttempts: 3 });
    await pub.send(queue, message);
    await pub.close();
  };

  const createConsumer = (queue: string, handler: (msg: unknown) => Promise<void>) => {
    return connection.createConsumer(
      { queue, queueOptions: { durable: true }, qos: { prefetchCount: 100 } },
      async (msg) => handler(parseMessageBody(msg.body))
    );
  };

  return { connection, publisher, createConsumer };
}
```

### 1.6 Create src/infra/auth.ts
Port auth logic from guards:
- `requireAuth` - preHandler hook checking session token
- `requireServerPermission` - preHandler checking Discord permissions
- Token refresh logic

Source files:
- [DiscordOAuth2.guard.ts](services/backend-api/src/features/discord-auth/guards/DiscordOAuth2.guard.ts)
- [BaseUserManagesServer.guard.ts](services/backend-api/src/features/discord-auth/guards/BaseUserManagesServer.guard.ts)

### 1.7 Create src/infra/error-handler.ts
Centralized error handler that catches exception classes:
```typescript
export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  // Map exception classes to HTTP responses
  if (error instanceof UnauthorizedException) {
    return reply.status(401).send({ message: error.message });
  }
  // ... handle other exceptions
  logger.error("Unhandled error", { error: error.stack });
  return reply.status(500).send({ message: "Internal Server Error" });
}
```

### 1.8 Create src/app.ts
Fastify app setup with plugins:
```typescript
export async function buildApp(container: Container) {
  const app = Fastify({
    trustProxy: true,
    ajv: { customOptions: { coerceTypes: true, removeAdditional: true } }
  });

  await app.register(fastifySecureSession, { ... });
  await app.register(fastifyCompress);
  await app.register(fastifyCookie);

  app.setErrorHandler(errorHandler);

  // Routes registered in Phase 5
  return app;
}
```

### 1.9 Create src/container.ts (skeleton)
Create container interface and factory skeleton (services added in Phase 3):
```typescript
export interface Container {
  // Will be populated as services are migrated
}

export async function createContainer(mongoConnection: Connection): Promise<Container> {
  return {};
}
```

### 1.10 Create src/main.ts (index.ts)
Entry point:
```typescript
async function main() {
  const config = loadConfig();
  const mongoConnection = await createMongoConnection(config.BACKEND_API_MONGODB_URI);
  const rabbitmq = await createRabbitConnection(config.BACKEND_API_RABBITMQ_BROKER_URL);
  const container = createContainer({ config, mongoConnection, rabbitmq });
  const app = await createApp(container);
  await app.listen({ port: config.BACKEND_API_PORT, host: "0.0.0.0" });

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down...`);
    await app.close();
    await closeRabbitConnection(rabbitmq);
    await closeMongoConnection(mongoConnection);
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
```

### 1.11 Create src/infra/logger.ts
Use `@monitorss/logger` package with Datadog integration:
```typescript
import setupLogger from "@monitorss/logger";

const logger = setupLogger({
  env: process.env.NODE_ENV,
  datadog: process.env.BACKEND_API_DATADOG_API_KEY
    ? { apiKey: process.env.BACKEND_API_DATADOG_API_KEY, service: "monitorss-backend-api-next" }
    : undefined,
  enableDebugLogs: process.env.LOG_LEVEL === "debug",
  disableConsole: !!process.env.BACKEND_API_DATADOG_API_KEY,
});

export default logger;
```

### 1.12 Create Test Infrastructure
Create test helpers for parallel test execution. Each test file gets its own isolated database.

#### test/helpers/test-constants.ts
```typescript
export const DEFAULT_MONGODB_URI = "mongodb://localhost:27017/backendapi_test";

export function getBaseUri(): string {
  return process.env.BACKEND_API_MONGODB_URI || DEFAULT_MONGODB_URI;
}

export function getTestDbUri(dbName: string): string {
  const url = new URL(getBaseUri());
  url.pathname = `/${dbName}`;
  return url.toString();
}
```

#### test/helpers/setup-test-database.ts
```typescript
import mongoose, { type Connection } from "mongoose";
import { getTestDbUri } from "./test-constants";

let testConnection: Connection | null = null;
let currentDatabaseName: string | null = null;

export async function setupTestDatabase(): Promise<Connection> {
  currentDatabaseName = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const uri = getTestDbUri(currentDatabaseName);
  testConnection = mongoose.createConnection(uri);
  await testConnection.asPromise();
  return testConnection;
}

export async function teardownTestDatabase(): Promise<void> {
  if (testConnection) {
    await testConnection.dropDatabase();
    await testConnection.close();
    testConnection = null;
  }
}
```

#### test/helpers/test-context.ts
```typescript
import type { FastifyInstance } from "fastify";
import type { Connection } from "mongoose";
import { createApp } from "../../src/app";
import { createContainer, type Container } from "../../src/container";
import type { Config } from "../../src/config";

export interface TestContext {
  app: FastifyInstance;
  container: Container;
  baseUrl: string;
  fetch(path: string, options?: RequestInit): Promise<Response>;
  close(): Promise<void>;
}

export async function createTestContext(options: { mongoConnection: Connection }): Promise<TestContext> {
  const config = { /* test config with defaults */ } as Config;
  const mockRabbitmq = { /* mock */ } as any;

  const container = createContainer({
    config,
    mongoConnection: options.mongoConnection,
    rabbitmq: mockRabbitmq,
  });

  const app = await createApp(container);
  await app.listen({ port: 0 }); // Random available port

  const address = app.server.address();
  const port = typeof address === "object" ? address?.port : 0;
  const baseUrl = `http://localhost:${port}`;

  return {
    app,
    container,
    baseUrl,
    async fetch(path, options) { return fetch(`${baseUrl}${path}`, options); },
    async close() { await app.close(); },
  };
}
```

#### test/api/health.api.test.ts
First API test - validates infrastructure works:
```typescript
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { setupTestDatabase, teardownTestDatabase } from "../helpers/setup-test-database";
import { createTestContext, type TestContext } from "../helpers/test-context";

describe("Health API", { concurrency: true }, () => {
  let ctx: TestContext;

  before(async () => {
    const mongoConnection = await setupTestDatabase();
    ctx = await createTestContext({ mongoConnection });
  });

  after(async () => {
    await ctx.close();
    await teardownTestDatabase();
  });

  it("GET /api/v1/health returns 200", async () => {
    const response = await ctx.fetch("/api/v1/health");
    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.status, "ok");
  });
});
```

## Verification ✅ PHASE 1 COMPLETE
- [x] `npm install` succeeds
- [x] `npm run build` (tsc) succeeds
- [x] `npm run test:api` passes (requires MongoDB running locally)
- [x] App starts and listens on configured port
- [x] Health check endpoint responds
- [x] Graceful shutdown works (SIGTERM/SIGINT)

---

# PHASE 2: Mongoose Schema Migration + Repository Pattern Setup

**Goal**: Port all Mongoose schemas from `@nestjs/mongoose` decorators to plain Mongoose, and establish the repository pattern structure for future database abstraction.

**Depends on**: Phase 1 complete

## Tasks

### 2.1 Create directory structure
```
src/repositories/
├── interfaces/           # Repository contracts + entity types
│   ├── user.repository.ts
│   ├── user-feed.repository.ts
│   └── index.ts
└── mongoose/             # Mongoose implementations (schema + repository in one file)
    ├── user.mongoose.repository.ts
    ├── user-feed.mongoose.repository.ts
    └── index.ts
```

### 2.2 Repository interface pattern
Each interface file contains the entity type and repository contract:
```typescript
// src/repositories/interfaces/user-feed.repository.ts
export interface UserFeed {
  id: string;
  title: string;
  url: string;
  // ... plain object, no Mongoose types
}

export interface UserFeedRepository {
  // Methods added in Phase 3 as services are migrated
}
```

### 2.3 Mongoose repository pattern
Each Mongoose file contains the schema and repository implementation together:
```typescript
// src/repositories/mongoose/user-feed.mongoose.repository.ts
import { Schema, type Model, type Connection } from "mongoose";
import type { UserFeed, UserFeedRepository } from "../interfaces/user-feed.repository";

// Schema (implementation detail)
const UserFeedSchema = new Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  // ...
}, { timestamps: true });

// Repository
export class UserFeedMongooseRepository implements UserFeedRepository {
  private model: Model<any>;

  constructor(connection: Connection) {
    this.model = connection.model("UserFeed", UserFeedSchema);
  }

  // Methods added in Phase 3 as services are migrated
}
```

### 2.4 Port entities to repository files

| Source Entity | Target |
|---------------|--------|
| `features/users/entities/user.entity.ts` | `repositories/mongoose/user.mongoose.repository.ts` |
| `features/user-feeds/entities/user-feed.entity.ts` | `repositories/mongoose/user-feed.mongoose.repository.ts` |
| `features/user-feeds/entities/user-feed-tag.entity.ts` | ~~SKIP - not used in production~~ |
| `features/feeds/entities/feed.entity.ts` | `repositories/mongoose/feed.mongoose.repository.ts` |
| `features/feeds/entities/feed-embed.entity.ts` | (embedded in feed schema) |
| `features/feeds/entities/feed-subscriber.entity.ts` | `repositories/mongoose/feed-subscriber.mongoose.repository.ts` |
| `features/feeds/entities/feed-filtered-format.entity.ts` | `repositories/mongoose/feed-filtered-format.mongoose.repository.ts` |
| `features/supporters/entities/supporter.entity.ts` | `repositories/mongoose/supporter.mongoose.repository.ts` |
| `features/supporters/entities/patron.entity.ts` | `repositories/mongoose/patron.mongoose.repository.ts` |
| `features/supporters/entities/user-feed-limit-overrides.entity.ts` | `repositories/mongoose/user-feed-limit-override.mongoose.repository.ts` |
| `features/discord-servers/entities/discord-server-profile.entity.ts` | `repositories/mongoose/discord-server-profile.mongoose.repository.ts` |
| `features/feed-connections/entities/*` | `repositories/mongoose/feed-connection.mongoose.repository.ts` |
| FailRecord | `repositories/mongoose/fail-record.mongoose.repository.ts` |
| BannedFeed | `repositories/mongoose/banned-feed.mongoose.repository.ts` |
| FeedSchedule | `repositories/mongoose/feed-schedule.mongoose.repository.ts` |
| MongoMigration | `repositories/mongoose/mongo-migration.mongoose.repository.ts` |
| NotificationDeliveryAttempt | `repositories/mongoose/notification-delivery-attempt.mongoose.repository.ts` |

### 2.5 Create index files
- `src/repositories/interfaces/index.ts` - Export all entity types and repository interfaces
- `src/repositories/mongoose/index.ts` - Export all Mongoose repository implementations

## Verification ✅ PHASE 2 COMPLETE
- [x] All schemas compile without errors
- [x] Entity types match original entities
- [x] Indexes and options preserved
- [x] Repository directory structure in place
- [x] All bare interfaces created
- [x] All empty Mongoose implementations created
- [x] Index files export everything

---

# PHASE 3: Service Migration

**Goal**: Port all services from NestJS `@Injectable` classes to plain classes, using repository interfaces for data access.

**Depends on**: Phase 2 complete (for schemas and repository scaffolding)

## Migration Pattern
For each service:
1. Remove `@Injectable()` decorator
2. Replace `@Inject()` with constructor parameters
3. Replace `ConfigService.get()` with direct config import
4. Replace `@InjectModel()` with repository interface parameter
5. Add required methods to repository interface
6. Implement methods in Mongoose repository
7. Add to container.ts

### Repository method pattern
As you migrate each service, identify what data access it needs and add methods to the repository:

```typescript
// 1. Add method to interface (src/repositories/interfaces/user-feed.repository.ts)
export interface UserFeed {
  id: string;
  title: string;
  url: string;
}

export interface UserFeedRepository {
  findById(id: string): Promise<UserFeed | null>;
  findByUserId(userId: string): Promise<UserFeed[]>;
}

// 2. Implement in Mongoose repository (src/repositories/mongoose/user-feed.mongoose.repository.ts)
export class UserFeedMongooseRepository implements UserFeedRepository {
  private model: Model<any>;

  constructor(connection: Connection) {
    this.model = connection.model("UserFeed", UserFeedSchema);
  }

  async findById(id: string): Promise<UserFeed | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByUserId(userId: string): Promise<UserFeed[]> {
    const docs = await this.model.find({ userId }).lean();
    return docs.map((d) => this.toEntity(d));
  }

  private toEntity(doc: any): UserFeed {
    return {
      id: doc._id.toString(),
      title: doc.title,
      url: doc.url,
    };
  }
}

// 3. Service depends on interface, not Mongoose
export class UserFeedsService {
  constructor(private userFeedRepo: UserFeedRepository) {}
}
```

### Key principles
- Services never import Mongoose types
- Repository methods return plain objects (use `.lean()` + mapping)
- Repository interfaces only contain methods actually needed by services

## Tasks

### 3.1 Tier 1 - External API wrappers (no internal deps) ✅ DONE

| # | Service | Source | Notes |
|---|---------|--------|-------|
| 3.1.1 | DiscordApiService | `services/apis/discord/discord-api.service.ts` | HTTP client for Discord API |
| 3.1.2 | FeedFetcherApiService | `services/feed-fetcher/feed-fetcher.service.ts` | HTTP client for feed-fetcher microservice |
| 3.1.3 | FeedHandlerService | `services/feed-handler/feed-handler.service.ts` | HTTP client for user-feeds microservice |
| 3.1.4 | PaddleService | `features/paddle/paddle.service.ts` | Paddle payment API |
| 3.1.5 | RedditApiService | `services/apis/reddit/reddit-api.service.ts` | Reddit OAuth API |

### 3.2 Tier 2 - SupportersService Dependencies ✅ DONE

| # | Service | Source | Depends On | ~Lines |
|---|---------|--------|------------|--------|
| 3.2.1 | PatronsService | `features/supporters/patrons.service.ts` | Config only | ~220 |
| 3.2.2 | GuildSubscriptionsService | `features/supporters/guild-subscriptions.service.ts` | Config only (external HTTP API) | ~135 |
| 3.2.3 | MessageBrokerService | `features/message-broker/message-broker.service.ts` | RabbitMQ connection | ~17 |

### 3.3 Tier 3 - SupportersService ✅ DONE

Source: `features/supporters/supporters.service.ts`
Depends on: DiscordApiService, PatronsService, GuildSubscriptionsService, Supporter repo, UserFeedLimitOverride repo

| # | Sub-task | Methods | ~Lines |
|---|----------|---------|--------|
| 3.3.1a | Core Benefits ✅ | constructor, getBenefitsOfDiscordUser, getMaxFeedsForDiscordUser, getMaxUserFeedsForDiscordUser, getSupportersOfGuild, isValidSupporterPaddle, serverCanUseCustomPlaceholders | ~500 |
| 3.3.1b | Discord Roles & Server Boost ✅ | syncDiscordSupporterRoles, setGuildTransferredFromPatreon, willRemoveBenefits, getSupporterOfGuild | ~420 |

### 3.4 Tier 4 - Discord Services ✅ DONE

These depend only on DiscordApiService + Config.

| # | Service | Source | Depends On | ~Lines |
|---|---------|--------|------------|--------|
| 3.4.1 | DiscordAuthService ✅ | `features/discord-auth/discord-auth.service.ts` | DiscordApiService, Config | ~300 |
| 3.4.2 | DiscordWebhooksService ✅ | `features/discord-webhooks/discord-webhooks.service.ts` | DiscordApiService, Config | ~150 |
| 3.4.3 | DiscordPermissionsService ✅ | `features/discord-auth/discord-permissions.service.ts` | DiscordApiService, Config | ~190 |

### 3.5 Tier 5 - Services depending on SupportersService ✅ DONE

| # | Service | Source | Depends On | ~Lines |
|---|---------|--------|------------|--------|
| 3.5.1 | UsersService ✅ | `features/users/users.service.ts` | SupportersService, PaddleService, User repo, UserFeed repo, Supporter repo | ~200 |
| 3.5.2 | DiscordUsersService ✅ | `features/discord-users/discord-users.service.ts` | DiscordApiService, SupportersService | ~170 |

### 3.6 Tier 6 - NotificationsService ✅ DONE

| # | Service | Source | Depends On | ~Lines |
|---|---------|--------|------------|--------|
| 3.6.1 | NotificationsService ✅ | `features/notifications/notifications.service.ts` | UsersService, UserFeed repo, NotificationDeliveryAttempt repo, SMTP | ~170 |

### 3.7 Tier 7 - FeedsService ✅ DONE

| # | Service | Source | Depends On | ~Lines |
|---|---------|--------|------------|--------|
| 3.7.1 | FeedsService ✅ | `features/feeds/feeds.service.ts` | DiscordApiService, DiscordAuthService, DiscordPermissionsService, Feed repo, BannedFeed repo | ~280 |

### 3.8 Tier 8 - DiscordServersService ✅ DONE

| # | Service | Source | Depends On | ~Lines |
|---|---------|--------|------------|--------|
| 3.8.1 | DiscordServersService ✅ | `features/discord-servers/discord-servers.service.ts` | DiscordApiService, FeedsService, DiscordPermissionsService, DiscordServerProfile repo | ~200 |

### 3.9 Tier 9 - Repo-only services ✅ DONE

These only depend on repositories.

| # | Service | Source | Depends On | ~Lines |
|---|---------|--------|------------|--------|
| ~~3.9.1~~ | ~~UserFeedTagsService~~ | ~~`features/user-feeds/user-feed-tags.service.ts`~~ | ~~SKIP - not used in production~~ | |
| 3.9.2 | UserFeedConnectionEventsService ✅ | `features/user-feed-connection-events/user-feed-connection-events.service.ts` | UserFeed repo | ~90 |
| 3.9.3 | MongoMigrationsService ✅ | `features/mongo-migrations/mongo-migrations.service.ts` | MongoMigration repo, UserFeed repo, User repo | ~250 |

### 3.10 Tier 10 - UserFeedsService ✅ DONE

Source: `features/user-feeds/user-feeds.service.ts`
Depends on: FeedsService, SupportersService, FeedFetcherApiService, FeedHandlerService, UsersService, UserFeed repo, User repo

| # | Sub-task | Methods | ~Lines |
|---|----------|---------|--------|
| 3.10.1a | Core CRUD & Validation ✅ | constructor, getFeedById, getFeedsByUser, getFeedCountByUser, addFeed, updateFeedById, deleteFeedById, bulkDelete, bulkDisable, bulkEnable, validateFeedUrl, deduplicateFeedUrls, calculateCurrentFeedCountOfDiscordUser | ~600 |
| 3.10.1b | Article Operations + Clone/Copy ✅ | getFeedArticles, getFeedArticleProperties, getFeedRequests, getDeliveryLogs, manuallyRequest, retryFailedFeed, getDeliveryPreview, getDatePreview, clone, copySettings | ~800 |
| 3.10.1c | Feed Limits & Formatting ✅ | formatForHttpResponse, getFeedDailyLimit, enforceUserFeedLimit, enforceAllUserFeedLimits, getEnforceWebhookWrites | ~900 |

### 3.11 Tier 11 - FeedConnectionsDiscordChannelsService ✅ DONE

Source: `features/feed-connections/feed-connections-discord-channels.service.ts`
Depends on: FeedsService, FeedHandlerService, SupportersService, DiscordWebhooksService, DiscordApiService, DiscordAuthService, UsersService, UserFeedConnectionEventsService, UserFeed repo

| # | Sub-task | Methods | ~Lines |
|---|----------|---------|--------|
| 3.11.1a | Connection CRUD ✅ | constructor, createDiscordChannelConnection, updateDiscordChannelConnection, deleteConnection, cloneConnection, copySettings | ~800 |
| 3.11.1b | Preview & Test ✅ | sendTestArticle, sendTestArticleDirect, createPreview, createTemplatePreview | ~900 |

### 3.12 Tier 12 - Services depending on UserFeedsService (PARTIAL)

| # | Service | Source | Depends On | ~Lines |
|---|---------|--------|------------|--------|
| 3.12.1 | UserFeedManagementInvitesService ✅ | `features/user-feed-management-invites/user-feed-management-invites.service.ts` | UserFeedsService, SupportersService, UserFeed repo | ~300 |
| 3.12.2 | PaddleWebhooksService ✅ | `features/supporter-subscriptions/paddle-webhooks.service.ts` | SupportersService, UserFeedsService, PaddleService, Supporter repo, User repo | ~380 |

### 3.13 Tier 13 - SupporterSubscriptionsService

| # | Service | Source | Depends On | ~Lines |
|---|---------|--------|------------|--------|
| 3.13.1 | SupporterSubscriptionsService | `features/supporter-subscriptions/supporter-subscriptions.service.ts` | SupportersService, MessageBrokerService, PaddleService, User repo | ~450 |

### 3.14 Tier 14 - LegacyFeedConversionService (~700 lines)

Source: `features/legacy-feed-conversion/legacy-feed-conversion.service.ts`
Depends on: DiscordApiService, SupportersService, multiple repos (DiscordServerProfile, Feed, FeedSubscriber, FeedFilteredFormat, FailRecord, UserFeed, UserFeedLimitOverride)

| # | Sub-task | Methods | ~Lines |
|---|----------|---------|--------|
| 3.14.1 | Conversion Logic | convertToUserFeed, getUserFeedEquivalent, convertPlaceholders, convertEmbeds, convertRegexFilters, convertRegularFilters, helper methods | ~700 |

### 3.15 Tier 15 - Event Services

These depend on many services and handle RabbitMQ events.

| # | Service | Source | Depends On | ~Lines |
|---|---------|--------|------------|--------|
| 3.15.1 | ScheduleHandlerService | `features/schedule-handler/schedule-handler.service.ts` | SupportersService, UserFeedsService, UsersService, UserFeed repo, User repo, AMQP | ~200 | ✅ DONE |
| 3.15.2 | MessageBrokerEventsService | `features/message-broker-events/message-broker-events.service.ts` | SupportersService, NotificationsService, UserFeed repo, AMQP | ~180 | ✅ DONE |

### 3.16 Update container.ts
Add services to container after each tier completes.

## Dependency Graph Summary

```
Tier 1:  External APIs (no deps)                    ✅ DONE
Tier 2:  PatronsService, GuildSubscriptionsService, ✅ DONE
         MessageBrokerService
Tier 3:  SupportersService                          ✅ DONE
Tier 4:  DiscordAuthService, DiscordWebhooksService ✅ DONE
         DiscordPermissionsService
Tier 5:  UsersService, DiscordUsersService          ✅ DONE
Tier 6:  NotificationsService                       ✅ DONE
Tier 7:  FeedsService                               ✅ DONE
Tier 8:  DiscordServersService                      ✅ DONE
Tier 9:  UserFeedConnectionEventsService,           ✅ DONE
         MongoMigrationsService
Tier 10: UserFeedsService                           ✅ DONE
Tier 11: FeedConnectionsDiscordChannelsService      ✅ DONE
Tier 12: UserFeedManagementInvitesService,          ✅ DONE
         PaddleWebhooksService
Tier 13: SupporterSubscriptionsService              ❌ TODO
Tier 14: LegacyFeedConversionService                ❌ TODO
Tier 15: ScheduleHandlerService,                    ✅ DONE
         MessageBrokerEventsService
```

## Verification (per service)
- [ ] Service compiles without NestJS imports
- [ ] All methods preserved
- [ ] Dependencies injected via constructor

---

# PHASE 4: RabbitMQ Event Handlers

**Goal**: Port RabbitMQ event handlers from `@RabbitSubscribe` to plain consumers.

**Depends on**: Phase 3 complete (for services)

## Tasks

### 4.1 Create src/events/index.ts
Event handler registration function.

### 4.2 Port event handlers

| # | Handler | Queue | Source |
|---|---------|-------|--------|
| 4.2.1 | handleSyncSupporterDiscordRoles | `sync-supporter-discord-roles` | message-broker-events.service.ts |
| 4.2.2 | handleUrlFailing | `url.failing` | message-broker-events.service.ts |
| 4.2.3 | handleUrlFetchCompletedEvent | `url.fetch.completed` | message-broker-events.service.ts |
| 4.2.4 | handleUrlRejectedDisableFeedsEvent | `url.rejected.disable-feeds` | message-broker-events.service.ts |
| 4.2.5 | handleUrlRequestFailureEvent | `url.failed.disable-feeds` | message-broker-events.service.ts |
| 4.2.6 | handleFeedRejectedDisableFeed | `feed.rejected.disable-feed` | message-broker-events.service.ts |
| 4.2.7 | handleRejectedArticleDisableConnection | `feed.rejected-article.disable-connection` | message-broker-events.service.ts |

### 4.3 Register consumers in main.ts
```typescript
const { createConsumer } = createRabbitMQ(config.RABBITMQ_URL);
createConsumer("url.failing", (msg) => container.messageHandler.handleUrlFailing(msg));
// ... etc
```

## Verification ✅ PHASE 4 COMPLETE
- [x] All consumers registered (7 consumers in `MessageBrokerEventsService.initialize()`)
- [x] Messages processed correctly
- [x] Errors handled (ACK on error via `createConsumer` wrapper)

---

# PHASE 5: Endpoint Migration (TDD Approach)

**Goal**: Migrate each endpoint end-to-end: write tests, implement, verify, then move to the next endpoint. This keeps focus on one endpoint at a time rather than context-switching between many.

**Depends on**: Phase 3 (services) complete

**Status**: Not started.

## Approach: Endpoint-by-Endpoint TDD

For each endpoint:
1. **Write API tests** in backend-api-next using `node:test`
2. **Run tests** - must FAIL (no implementation yet)
3. **Implement** routes/handlers/schemas
4. **Run tests** - must PASS
5. **Move to next endpoint**

This ensures:
- Complete focus on one endpoint before moving on
- Immediate feedback loop (test → implement → verify)
- No context-switching between unrelated endpoints
- Clear progress tracking

## CRITICAL: Fastify Route Registration Order

**Unlike NestJS, Fastify route registration order matters!** Routes are matched in registration order, so:

1. **Register specific routes BEFORE parameterized routes**
   - Register `/bot` and `/@me` BEFORE `/:id`
   - Register `/deduplicate-feed-urls` BEFORE `/:feedId`

2. **Example of correct order**:
   ```typescript
   // ✅ CORRECT - specific routes first
   app.get("/discord-users/bot", botHandler);
   app.get("/discord-users/@me", meHandler);
   app.get("/discord-users/@me/auth-status", authStatusHandler);
   app.get("/discord-users/:id", getUserHandler);  // LAST

   // ❌ WRONG - parameterized route first will catch "bot" and "@me"
   app.get("/discord-users/:id", getUserHandler);
   app.get("/discord-users/bot", botHandler);  // Never reached!
   ```

3. **Affected sections**: 5.2 (Discord Users), 5.5 (User Feeds)

## Auth Guard Patterns

The NestJS codebase uses several auth patterns that must be replicated:

| Pattern | NestJS | Fastify Equivalent |
|---------|--------|-------------------|
| Class-level guard | `@UseGuards(DiscordOAuth2Guard)` on controller | `preHandler` hook on route prefix |
| Method-level guard | `@UseGuards(...)` on method | `preHandler` on specific route |
| No guard (public) | No decorator | No preHandler |
| `@DiscordAccessToken()` | Extracts token from session | Custom decorator or inline extraction |

**Note**: Some NestJS controllers use `@DiscordAccessToken()` without explicit `@UseGuards()`. This works because there's likely a global guard. In Fastify, ensure the auth preHandler is applied appropriately.

## Test Infrastructure ✅ ALREADY EXISTS

The test infrastructure is already in place in `services/backend-api-next/test/`:

- **`helpers/test-context.ts`** - `createAppTestContext()` spins up Fastify with isolated test DB, provides `ctx.fetch()` helper
- **`helpers/test-http-server.ts`** - Mock HTTP server for external API calls (Discord, feed fetcher, etc.)
- **`helpers/mock-factories.ts`** - Factory functions for test data
- **`api/health.test.ts`** - Working example of an API test
- **Various `*.harness.ts` files** - Service-specific test helpers

### API Test Pattern

```typescript
// test/api/discord-auth.test.ts
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";

describe("Discord Auth API", { concurrency: true }, () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  after(async () => {
    await ctx.teardown();
  });

  describe("GET /api/v1/discord/users/@me", () => {
    it("returns 401 without auth", async () => {
      const response = await ctx.fetch("/api/v1/discord/users/@me");
      assert.strictEqual(response.status, 401);
    });

    // For authenticated requests, you'll need to set up session cookies
    // or create a helper that injects auth into the request
  });
});
```

## Validation Migration Reference

| class-validator | Fastify JSON Schema |
|-----------------|---------------------|
| `@IsString()` | `{ type: "string" }` |
| `@IsOptional()` | Omit from `required` array |
| `@IsNotEmpty()` | `{ type: "string", minLength: 1 }` |
| `@IsEmail()` | `{ type: "string", format: "email" }` |
| `@IsUrl()` | `{ type: "string", format: "uri" }` |
| `@IsInt()` | `{ type: "integer" }` |
| `@Min(n)` / `@Max(n)` | `{ minimum: n }` / `{ maximum: n }` |
| `@IsArray()` | `{ type: "array" }` |
| `@ValidateNested()` + `@Type()` | Nested schema or `$ref` |
| `@IsEnum(E)` | `{ enum: [values] }` |
| `forbidNonWhitelisted` | `{ additionalProperties: false }` |

## Tasks (Endpoint-by-Endpoint)

Each task follows the TDD cycle: Write tests → Run (FAIL) → Implement → Run (PASS)

### 5.1 Discord Auth Endpoints ✅ DONE

Source: `features/discord-auth/discord-auth.controller.ts`

| # | Endpoint | Description | Status |
|---|----------|-------------|--------|
| 5.1.1 | `GET /api/v1/discord/login` | OAuth redirect (301 to Discord) | ✅ DONE |
| 5.1.2 | `GET /api/v1/discord/login-v2` | OAuth redirect with state & scopes | ✅ DONE |
| 5.1.3 | `GET /api/v1/discord/callback` | OAuth callback, set session | ✅ DONE |
| 5.1.4 | `GET /api/v1/discord/callback-v2` | OAuth callback v2 with state validation | ✅ DONE |
| 5.1.5 | `GET /api/v1/discord/logout` | Revoke token, clear session (204) | ✅ DONE |

Files created:
- `features/discord-auth/discord-auth.routes.ts`
- `features/discord-auth/discord-auth.handlers.ts`
- `features/discord-auth/discord-auth.schemas.ts`
- `test/api/discord-auth.test.ts`

### 5.2 Discord Users Endpoints ✅ DONE

Source: `features/discord-users/discord-users.controller.ts`

**⚠️ ROUTE ORDER**: Register specific routes (`/bot`, `/@me/*`) BEFORE `/:id` to prevent parameter collision.

| # | Endpoint | Description | Auth | Status |
|---|----------|-------------|------|--------|
| 5.2.1 | `GET /api/v1/discord-users/bot` | Get bot info | DiscordOAuth2Guard | ✅ DONE |
| 5.2.2 | `GET /api/v1/discord-users/@me` | Get current user | DiscordOAuth2Guard | ✅ DONE |
| 5.2.3 | `GET /api/v1/discord-users/@me/auth-status` | Check auth status | **None** (public) | ✅ DONE |
| 5.2.4 | `GET /api/v1/discord-users/:id` | Get user by ID (**register LAST**) | DiscordOAuth2Guard | ✅ DONE |

Files created:
- `features/discord-users/discord-users.routes.ts`
- `features/discord-users/discord-users.handlers.ts`
- `test/api/discord-users.test.ts`

### 5.3 Discord Servers Endpoints

Source: `features/discord-servers/discord-servers.controller.ts`

| # | Endpoint | Description | Status |
|---|----------|-------------|--------|
| 5.3.1 | `GET /api/v1/discord-servers/:serverId` | Get server info + profile | ✅ DONE |
| 5.3.2 | `GET /api/v1/discord-servers/:serverId/active-threads` | Get active threads (with parentChannelId query) | ✅ DONE |
| 5.3.3 | `GET /api/v1/discord-servers/:serverId/status` | Get authorization status | ✅ DONE |
| 5.3.4 | `GET /api/v1/discord-servers/:serverId/channels` | Get server channels (no caching — see Deviations) | ✅ DONE |
| 5.3.5 | `GET /api/v1/discord-servers/:serverId/roles` | Get server roles (no caching — see Deviations) | ✅ DONE |
| 5.3.6 | `GET /api/v1/discord-servers/:serverId/members/:memberId` | Get specific member (cached 5min) | ✅ DONE |
| 5.3.7 | `GET /api/v1/discord-servers/:serverId/members` | Search server members | ✅ DONE |

Files to create:
- `features/discord-servers/discord-servers.routes.ts`
- `features/discord-servers/discord-servers.handlers.ts`
- `features/discord-servers/discord-servers.schemas.ts`
- `features/discord-servers/discord-servers.test.ts`

### 5.4 Discord Webhooks Endpoints

Source: `features/discord-webhooks/discord-webhooks.controller.ts`

| # | Endpoint | Description | Status |
|---|----------|-------------|--------|
| 5.4.1 | `GET /api/v1/discord-webhooks/:id` | Get webhook info (cached 60s) | ✅ DONE |

Files to create:
- `features/discord-webhooks/discord-webhooks.routes.ts`
- `features/discord-webhooks/discord-webhooks.handlers.ts`
- `features/discord-webhooks/discord-webhooks.schemas.ts`
- `features/discord-webhooks/discord-webhooks.test.ts`

### 5.5 User Feeds Endpoints

Source: `features/user-feeds/user-feeds.controller.ts`

**⚠️ ROUTE ORDER**: Register static routes (`/deduplicate-feed-urls`, `/url-validation`) and `GET /` BEFORE `/:feedId/*` routes.

**Note**: In NestJS source, routes 5.5.12 and 5.5.13 use `:feed` param name (not `:feedId`). Use consistent naming in Fastify.

| # | Endpoint | Description | Status |
|---|----------|-------------|--------|
| 5.5.1 | `POST /api/v1/user-feeds` | Create new feed | ✅ DONE |
| 5.5.2 | `POST /api/v1/user-feeds/deduplicate-feed-urls` | Deduplicate URLs against existing feeds | ✅ DONE |
| 5.5.3 | `POST /api/v1/user-feeds/url-validation` | Validate feed URL | ✅ DONE |
| 5.5.4 | `PATCH /api/v1/user-feeds` | Bulk operations (delete/disable/enable via op field) | ✅ DONE |
| 5.5.5 | `GET /api/v1/user-feeds/:feedId` | Get feed details | ✅ DONE |
| 5.5.6 | `PATCH /api/v1/user-feeds/:feedId` | Update feed | ✅ DONE |
| 5.5.7 | `DELETE /api/v1/user-feeds/:feedId` | Delete feed (204) | ✅ DONE |
| 5.5.8 | `POST /api/v1/user-feeds/:feedId/clone` | Clone feed | ✅ DONE |
| 5.5.9 | `POST /api/v1/user-feeds/:feedId/test-send` | Send test article to channel | ✅ DONE |
| 5.5.10 | `POST /api/v1/user-feeds/:feedId/date-preview` | Preview date formatting | ✅ DONE |
| 5.5.11 | `GET /api/v1/user-feeds/:feedId/requests` | Get feed request history | ✅ DONE |
| 5.5.12 | `GET /api/v1/user-feeds/:feedId/delivery-logs` | Get delivery logs | ✅ DONE |
| 5.5.13 | `POST /api/v1/user-feeds/:feedId/delivery-preview` | Preview deliveries | ✅ DONE |
| 5.5.14 | `POST /api/v1/user-feeds/:feedId/get-article-properties` | Get article properties | ✅ DONE |
| 5.5.15 | `POST /api/v1/user-feeds/:feedId/get-articles` | Get feed articles | ✅ DONE |
| 5.5.16 | `POST /api/v1/user-feeds/:feedId/manual-request` | Manually trigger feed fetch | ✅ DONE |
| 5.5.17 | `GET /api/v1/user-feeds/:feedId/daily-limit` | Get daily delivery limit | ✅ DONE |
| 5.5.18 | `POST /api/v1/user-feeds/:feedId/copy-settings` | Copy settings to other feeds | ✅ DONE |
| 5.5.19 | `GET /api/v1/user-feeds` | List feeds for user (**register LAST**) | ✅ DONE |

Files to create:
- `features/user-feeds/user-feeds.routes.ts`
- `features/user-feeds/user-feeds.handlers.ts`
- `features/user-feeds/user-feeds.schemas.ts`
- `features/user-feeds/user-feeds.test.ts`

### 5.6 Feed Connections Endpoints

Source: `features/feed-connections/feed-connections-discord-channels.controller.ts`

| # | Endpoint | Description | Status |
|---|----------|-------------|--------|
| 5.6.1 | `POST /api/v1/user-feeds/:feedId/connections/discord-channels` | Create connection | ✅ DONE |
| 5.6.2 | `POST /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId/test` | Send test article | ✅ DONE |
| 5.6.3 | `POST /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId/copy-connection-settings` | Copy settings to other connections | ✅ DONE |
| 5.6.4 | `POST /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId/clone` | Clone connection | ✅ DONE |
| 5.6.5 | `POST /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId/preview` | Create message preview | ✅ DONE |
| 5.6.6 | `POST /api/v1/user-feeds/:feedId/connections/template-preview` | Create template preview (no connectionId) | ✅ DONE |
| 5.6.7 | `PATCH /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId` | Update connection | ✅ DONE |
| 5.6.8 | `DELETE /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId` | Delete connection (204) | ✅ DONE |

Files to create:
- `features/feed-connections/feed-connections.routes.ts`
- `features/feed-connections/feed-connections.handlers.ts`
- `features/feed-connections/feed-connections.schemas.ts`
- `features/feed-connections/feed-connections.test.ts`

### 5.7 Supporter Subscriptions Endpoints

Source: `features/supporter-subscriptions/supporter-subscriptions.controller.ts`

Route prefix: `/subscription-products` (NOT `/subscription`)

**⚠️ AUTH NOTE**: This controller has mixed auth patterns:
- 5.7.1-5.7.2: No auth (public endpoints)
- 5.7.3: Uses `@DiscordAccessToken()` but no explicit guard (extracts token if present)
- 5.7.4-5.7.8: Explicit `@UseGuards(DiscordOAuth2Guard)`

| # | Endpoint | Description | Auth | Status |
|---|----------|-------------|------|--------|
| 5.7.1 | `POST .../paddle-webhook` | Paddle webhook handler | **None** (validates signature) | ✅ DONE |
| 5.7.2 | `GET .../` | Get products & prices (cached 5min) | **None** | ✅ DONE |
| 5.7.3 | `GET .../change-payment-method` | Get payment method change transaction | Auth via decorator (throws if no token) | ✅ DONE |
| 5.7.4 | `POST .../update-preview` | Preview subscription change | DiscordOAuth2Guard | ✅ DONE |
| 5.7.6 | `POST .../update` | Update subscription (204) | DiscordOAuth2Guard | ✅ DONE |
| 5.7.7 | `GET .../cancel` | Cancel subscription (204) | DiscordOAuth2Guard | ✅ DONE |
| 5.7.8 | `GET .../resume` | Resume subscription (204) | DiscordOAuth2Guard | ✅ DONE |

Files to create:
- `features/supporter-subscriptions/supporter-subscriptions.routes.ts`
- `features/supporter-subscriptions/supporter-subscriptions.handlers.ts`
- `features/supporter-subscriptions/supporter-subscriptions.schemas.ts`
- `features/supporter-subscriptions/supporter-subscriptions.test.ts`

### 5.8 User Feed Management Invites Endpoints

Source: `features/user-feed-management-invites/user-feed-management-invites.controller.ts`

Route prefix: `/user-feed-management-invites` (all require auth)

| # | Endpoint | Description | Status |
|---|----------|-------------|--------|
| 5.8.1 | `GET /api/v1/user-feed-management-invites` | Get my pending invites | ❌ TODO |
| 5.8.2 | `GET /api/v1/user-feed-management-invites/pending` | Get pending invite count | ❌ TODO |
| 5.8.3 | `POST /api/v1/user-feed-management-invites/:id/resend` | Resend invite (204) | ❌ TODO |
| 5.8.4 | `POST /api/v1/user-feed-management-invites` | Create invite (feedId in body) | ❌ TODO |
| 5.8.5 | `PATCH /api/v1/user-feed-management-invites/:id` | Update invite (connections) | ❌ TODO |
| 5.8.6 | `PATCH /api/v1/user-feed-management-invites/:id/status` | Update invite status (accept/decline) | ❌ TODO |
| 5.8.7 | `DELETE /api/v1/user-feed-management-invites/:id` | Delete invite (204) | ❌ TODO |

Files to create:
- `features/user-feed-management-invites/invites.routes.ts`
- `features/user-feed-management-invites/invites.handlers.ts`
- `features/user-feed-management-invites/invites.schemas.ts`
- `features/user-feed-management-invites/invites.test.ts`

### 5.9 Users Endpoints

Source: `features/users/users.controller.ts`

**⚠️ AUTH NOTE**: This controller has NO class-level `@UseGuards()` but uses `@DiscordAccessToken()`. Auth enforcement likely comes from a global guard in NestJS. In Fastify, apply auth preHandler explicitly.

| # | Endpoint | Description | Auth | Status |
|---|----------|-------------|------|--------|
| 5.9.1 | `GET /api/v1/users/@me` | Get current user profile (includes subscription, creditBalance, etc.) | Requires auth | ❌ TODO |
| 5.9.2 | `PATCH /api/v1/users/@me` | Update user preferences | Requires auth | ❌ TODO |

Files to create:
- `features/users/users.routes.ts`
- `features/users/users.handlers.ts`
- `features/users/users.schemas.ts`
- `features/users/users.test.ts`

### 5.10 Reddit Login Endpoints

Source: `features/reddit-login/reddit-login.controller.ts`

**⚠️ AUTH NOTE**: This controller has NO class-level `@UseGuards()` but routes 5.10.2 and 5.10.3 use `@DiscordAccessToken()`. In Fastify, apply auth preHandler to those specific routes.

| # | Endpoint | Description | Auth | Status |
|---|----------|-------------|------|--------|
| 5.10.1 | `GET /api/v1/reddit/login` | OAuth redirect to Reddit (303) | **None** | ❌ TODO |
| 5.10.2 | `GET /api/v1/reddit/remove` | Remove Reddit credentials (204) | Requires auth | ❌ TODO |
| 5.10.3 | `GET /api/v1/reddit/callback` | Reddit OAuth callback | Requires auth | ❌ TODO |

Files to create:
- `features/reddit-login/reddit-login.routes.ts`
- `features/reddit-login/reddit-login.handlers.ts`
- `features/reddit-login/reddit-login.test.ts`

### 5.11 Health, Sentry & Error Reports Endpoints

Source: `app.controller.ts`, `error-reports.controller.ts`

| # | Endpoint | Description | Status |
|---|----------|-------------|--------|
| 5.11.1 | `GET /api/v1/health` | Health check | ❌ TODO |
| 5.11.2 | `POST /api/v1/sentry-tunnel` | Sentry error tunnel (no auth) | ❌ TODO |
| 5.11.3 | `POST /api/v1/error-reports` | Create error report (auth required) | ❌ TODO |

Files to create:
- `features/health/health.routes.ts`
- `features/health/health.test.ts`
- `features/error-reports/error-reports.routes.ts`
- `features/error-reports/error-reports.test.ts`

### 5.12 Create route registration
Create `src/routes/index.ts` to register all routes as they are implemented.

### 5.13 Update app.ts to register routes

## Endpoint Summary

| Section | Endpoints | Description |
|---------|-----------|-------------|
| 5.1 Discord Auth | 5 | OAuth flow (login, login-v2, callback, callback-v2, logout) |
| 5.2 Discord Users | 4 | User info, bot info, auth status |
| 5.3 Discord Servers | 7 | Server info, channels, roles, members |
| 5.4 Discord Webhooks | 1 | Get webhook info |
| 5.5 User Feeds | 19 | CRUD, articles, requests, delivery, cloning |
| 5.6 Feed Connections | 8 | Connection CRUD, test, preview, clone |
| 5.7 Subscriptions | 8 | Paddle webhook, products, payment, cancel/resume |
| 5.8 Invites | 7 | Invite CRUD, resend, accept/decline |
| 5.9 Users | 2 | User profile get/update |
| 5.10 Reddit | 3 | Reddit OAuth flow |
| 5.11 Health/Error | 3 | Health, sentry tunnel, error reports |
| **TOTAL** | **67** | |

### Intentionally Skipped Endpoints

The following endpoints are **intentionally not migrated**:

**User Feed Tags** (`user-feed-tags.controller.ts`) - not used in production:
- `GET /api/v1/user-feed-tags` - List tags
- `POST /api/v1/user-feed-tags` - Create tag
- `PATCH /api/v1/user-feed-tags/:id` - Update tag
- `DELETE /api/v1/user-feed-tags/:id` - Delete tag

**Discord Users** - removed from backend-api (unused in frontend):
- `PATCH /api/v1/discord-users/@me/supporter` - Update supporter guild settings
- `GET /api/v1/discord-users/@me/servers` - Get user's Discord servers

**Discord Servers** - removed from backend-api:
- `GET /api/v1/discord-servers/:serverId/feeds` - Get server feeds (deleted)
- `PATCH /api/v1/discord-servers/:serverId` - Update server profile (removed)

## Verification (per endpoint)
- [ ] Tests written and initially FAIL
- [ ] Implementation complete
- [ ] Tests PASS
- [ ] Route paths match original NestJS implementation
- [ ] Auth hooks applied correctly
- [ ] Schema validation matches class-validator behavior
- [ ] Route registration order correct (specific routes before parameterized)

## Adversarial Review ✅ COMPLETED

An adversarial review was performed comparing this plan against all 13 NestJS controllers:

- **Controllers reviewed**: 13
- **Total NestJS endpoints**: 75 (including 4 user-feed-tags + 2 discord-users endpoints)
- **Endpoints in plan**: 67
- **Intentionally skipped**: 8 (4 user-feed-tags + 2 discord-users + 2 discord-servers endpoints - not used in production/frontend)
- **Coverage**: 100% of intended endpoints

### Issues Found and Addressed:
1. ✅ Route ordering warnings added for sections 5.2 and 5.5
2. ✅ Auth guard patterns documented per endpoint
3. ✅ Param naming inconsistency noted (`:feed` vs `:feedId`)
4. ✅ Mixed auth patterns documented for supporter-subscriptions
5. ✅ Intentionally skipped endpoints documented

---

# PHASE 6: Switchover & Cleanup

**Goal**: Validate, deploy, and remove old service.

**Depends on**: Phases 3-5 complete

## Tasks

### 6.1 Full validation
- [ ] All API tests pass in backend-api-next
- [ ] All unit tests pass in backend-api-next
- [ ] OAuth flow works end-to-end
- [ ] RabbitMQ events processed correctly

### 6.2 Parallel deployment
- Deploy backend-api-next alongside backend-api
- Route subset of traffic to new service
- Monitor for errors

### 6.3 Full switchover
- Route all traffic to backend-api-next
- Monitor for issues

### 6.4 Cleanup
- Delete `services/backend-api` directory
- Rename `services/backend-api-next` to `services/backend-api`
- Update docker-compose, CI configs, etc.

---

# Deviations from NestJS Implementation

## 5.3.4 - GET /api/v1/discord-servers/:serverId/channels — No server-side caching

The NestJS controller uses `@UseInterceptors(HttpCacheInterceptor)` with `@CacheTTL(1)` to apply 1-second server-side caching keyed per user (access token + URL). The Fastify backend has no equivalent server-side caching infrastructure (no cache plugin, no in-memory cache layer), so this endpoint is implemented without caching. The 1-second TTL provided negligible benefit, so this is considered low-impact.

## 5.3.5 - GET /api/v1/discord-servers/:serverId/roles — No server-side caching

The NestJS controller uses `@UseInterceptors(HttpCacheInterceptor)` with a 5-minute TTL for per-user caching (access token + URL). The Fastify backend has no equivalent server-side caching infrastructure, so this endpoint is implemented without caching. This is consistent with the channels endpoint (5.3.4) deviation.

## 5.6.7 - PATCH /api/v1/user-feeds/:feedId/connections/discord-channels/:connectionId — BadFormat auto-re-enable embeds check

The NestJS controller checks `if (content || embeds)` to auto-re-enable a connection disabled with `BadFormat` when the user updates content or embeds. Because JavaScript treats an empty array `[]` as truthy, sending `embeds: []` alone would clear the disabled code in NestJS. The Fastify handler checks `if (body.content || body.embeds?.length)`, which requires at least one embed to be present. This is arguably more correct (an empty array is not a meaningful format fix), but is a behavioral difference. The frontend never sends `embeds: []` without actual embed data in this context, so this is low-impact.

## 5.7.2 - GET /api/v1/subscription-products — No server-side caching

The NestJS controller uses `@UseInterceptors(CacheInterceptor)` with `@CacheTTL(60 * 5)` for 5-minute server-side caching. The cache is keyed by access token + URL for authenticated users, or just URL for unauthenticated users. The Fastify backend has no equivalent server-side caching infrastructure, so this endpoint is implemented without caching. This means every request will call Paddle's pricing-preview API. This is consistent with other endpoints (5.3.4, 5.3.5) that also lack caching.

---

# Reference: Validation Migration Checklist

When converting DTOs to JSON Schema, verify:

1. [ ] All `@IsString()`, `@IsNumber()`, etc. mapped to `type`
2. [ ] `@IsOptional()` fields NOT in `required` array
3. [ ] `@IsNotEmpty()` includes `minLength: 1`
4. [ ] `@ValidateNested()` has proper nested schema
5. [ ] `@IsEnum()` lists all enum values
6. [ ] `forbidNonWhitelisted` → `additionalProperties: false`
7. [ ] Test edge cases: empty string, null, undefined, wrong types
8. [ ] Type coercion works (via Ajv `coerceTypes: true`)

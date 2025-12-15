# MonitoRSS Source Tree Analysis

## Repository Structure

```
MonitoRSS/
├── packages/                    # Shared packages
│   └── logger/                  # Custom logging package (@monitorss/logger)
│       └── src/
│
├── services/                    # Microservices
│   ├── backend-api/             # Main API + Control Panel (monolith)
│   │   ├── client/              # React SPA (Control Panel)
│   │   ├── dockerfiles/
│   │   └── src/                 # NestJS API
│   │
│   ├── bot-presence/            # Discord bot presence service
│   │   └── src/
│   │
│   ├── discord-rest-listener/   # Discord REST API handler
│   │   └── src/
│   │
│   ├── feed-requests/           # RSS feed fetching service
│   │   ├── migrations/          # PostgreSQL migrations (MikroORM)
│   │   ├── sql/
│   │   └── src/
│   │
│   ├── user-feeds/              # Feed processing & delivery service
│   │   ├── migrations/          # PostgreSQL migrations (MikroORM)
│   │   └── src/
│   │
│   └── user-feeds-next/         # Next-gen feed service (Bun runtime)
│       ├── scripts/
│       └── src/
│
├── diagrams/                    # Architecture diagrams
├── docs/                        # Generated documentation
│
├── docker-compose.yml           # Production orchestration
├── docker-compose.dev.yml       # Development orchestration
├── docker-compose.base.yml      # Base service definitions
└── .env.example                 # Environment template
```

## Service Details

### backend-api (Monolith)

**Purpose:** Main API gateway, serves Control Panel, handles user-facing operations

```
services/backend-api/
├── client/                      # React Control Panel
│   └── src/
│       ├── components/          # Reusable UI components (~50+)
│       ├── features/            # Feature modules
│       │   ├── auth/            # Authentication
│       │   ├── discordServers/  # Server selection
│       │   ├── discordUser/     # User profile
│       │   ├── discordWebhooks/ # Webhook management
│       │   ├── feed/            # Feed CRUD & configuration
│       │   ├── feedConnections/ # Connection management
│       │   └── subscriptionProducts/  # Premium features
│       ├── pages/               # Route pages
│       ├── hooks/               # Custom React hooks
│       ├── contexts/            # React contexts
│       ├── locales/             # i18n translations
│       ├── mocks/               # MSW mock handlers
│       └── utils/               # Utility functions
│
└── src/                         # NestJS Backend
    ├── common/                  # Shared utilities
    │   ├── constants/
    │   ├── decorators/
    │   ├── errors/
    │   ├── exceptions/
    │   ├── filters/
    │   ├── interceptors/
    │   ├── pipes/
    │   └── validations/
    │
    ├── config/                  # Configuration
    ├── constants/
    │
    ├── features/                # Feature modules
    │   ├── discord-auth/        # OAuth flow
    │   ├── discord-servers/     # Server data
    │   ├── discord-users/       # User data
    │   ├── discord-webhooks/    # Webhook data
    │   ├── feed-connections/    # Connection management
    │   ├── feeds/               # Legacy feed CRUD
    │   ├── legacy-feed-conversion/  # Migration tooling
    │   ├── message-broker/      # RabbitMQ integration
    │   ├── message-broker-events/   # Event handlers
    │   ├── mongo-migrations/    # DB migrations
    │   ├── notifications/       # Email notifications
    │   ├── paddle/              # Payment integration
    │   ├── reddit-login/        # Reddit OAuth
    │   ├── schedule-emitter/    # Scheduled tasks
    │   ├── schedule-handler/    # Task processing
    │   ├── supporter-subscriptions/ # Premium subs
    │   ├── supporters/          # Supporter data
    │   ├── user-feed-connection-events/ # Connection events
    │   ├── user-feed-management-invites/ # Sharing
    │   ├── user-feeds/          # User feed CRUD
    │   └── users/               # User management
    │
    ├── services/                # External service integrations
    │   ├── apis/
    │   │   ├── discord/         # Discord API client
    │   │   └── reddit/          # Reddit API client
    │   ├── feed-fetcher/        # Feed requests client
    │   └── feed-handler/        # User feeds client
    │
    ├── scripts/                 # Standalone scripts
    │   └── migrations/          # Data migrations
    │
    └── utils/                   # Utilities
```

### feed-requests

**Purpose:** Fetches RSS feeds, caches responses, handles rate limiting

```
services/feed-requests/
├── migrations/                  # PostgreSQL migrations (38 files)
├── sql/                         # Raw SQL scripts
└── src/
    ├── cache-storage/           # Redis cache layer
    ├── feed-fetcher/            # Core fetching logic
    │   └── entities/            # Request/Response entities
    ├── feature-flagger/         # Feature flags (Split.io)
    ├── host-rate-limiter/       # Per-host rate limiting
    ├── message-broker/          # RabbitMQ integration
    ├── object-file-storage/     # S3 storage
    └── partitioned-requests-store/  # Distributed storage
```

### user-feeds

**Purpose:** Processes feeds, formats articles, delivers to Discord

```
services/user-feeds/
├── migrations/                  # PostgreSQL migrations (26 files)
└── src/
    ├── article-filters/         # Filter logic
    ├── article-formatter/       # Message formatting
    ├── article-parser/          # Article extraction
    ├── article-rate-limit/      # Delivery throttling
    ├── articles/                # Article management
    │   └── entities/            # Article entities
    ├── cache-storage/           # Redis cache
    ├── delivery/                # Discord delivery
    │   └── mediums/
    │       └── discord/         # Discord-specific delivery
    │           └── services/    # API client, payload builder
    ├── delivery-record/         # Delivery tracking
    ├── feed-event-handler/      # Event processing
    ├── feed-fetcher/            # Feed requests client
    ├── feeds/                   # Feed management
    ├── message-broker/          # RabbitMQ integration
    └── response-hash/           # Deduplication
```

### bot-presence

**Purpose:** Maintains Discord bot online status

```
services/bot-presence/
└── src/
    ├── app-config/              # Configuration
    ├── discord-client/          # Discord.js gateway
    └── message-broker/          # RabbitMQ integration
```

### discord-rest-listener

**Purpose:** Handles Discord REST API rate limiting and requests

```
services/discord-rest-listener/
└── src/
    # Lightweight service for Discord API interactions
```

### user-feeds-next

**Purpose:** Next-generation feed processing (Bun runtime, simplified)

```
services/user-feeds-next/
├── scripts/                     # Migration scripts
└── src/
    ├── feeds/
    │   └── services/            # Feed processing
    ├── http/
    │   └── schemas/             # API schemas (Zod)
    └── shared/
        └── schemas/             # Event schemas
```

## Entry Points

| Service | Entry Point | Command |
|---------|-------------|---------|
| backend-api | `src/main.ts` | `nest start` |
| control-panel | `src/main.tsx` | `vite` |
| bot-presence | `src/main.ts` | `nest start` |
| discord-rest-listener | `src/app.ts` | `node build/app.js` |
| feed-requests | `src/main.ts` | `nest start` |
| user-feeds | `src/main.ts` | `nest start` |
| user-feeds-next | `index.ts` | `bun index.ts` |

## Key Integration Points

1. **backend-api ↔ user-feeds**: HTTP API calls for feed operations
2. **backend-api ↔ feed-requests**: HTTP API calls for feed fetching
3. **All services ↔ RabbitMQ**: Event-driven communication
4. **backend-api ↔ MongoDB**: Primary data store
5. **user-feeds/feed-requests ↔ PostgreSQL**: Transactional data
6. **feed-requests ↔ Redis**: Response caching
7. **discord-rest-listener ↔ Discord API**: Rate-limited Discord calls

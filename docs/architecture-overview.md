# MonitoRSS Architecture Overview

## System Overview

MonitoRSS is a distributed RSS-to-Discord delivery system built on a microservices architecture. It fetches RSS feeds, processes articles, and delivers formatted messages to Discord channels and webhooks.

## Architecture Pattern

**Event-Driven Microservices** with:
- RabbitMQ as central message broker
- Hybrid database approach (MongoDB + PostgreSQL)
- HTTP APIs for external access and some inter-service communication

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │  Control Panel  │  React SPA (Chakra UI)                               │
│   │     (Client)    │  - Feed management UI                                │
│   └────────┬────────┘  - Message builder                                   │
│            │           - Server/channel selection                          │
│            │                                                                │
├────────────┼────────────────────────────────────────────────────────────────┤
│            │                    API GATEWAY                                 │
├────────────┼────────────────────────────────────────────────────────────────┤
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │   Backend API   │  NestJS + Fastify                                    │
│   │   (Monolith)    │  - User authentication (Discord OAuth)               │
│   └────────┬────────┘  - Feed CRUD operations                              │
│            │           - Serves static Control Panel                       │
│            │                                                                │
├────────────┼────────────────────────────────────────────────────────────────┤
│            │                  SERVICE LAYER                                 │
├────────────┼────────────────────────────────────────────────────────────────┤
│            │                                                                │
│   ┌────────┴────────┐          ┌─────────────────┐                         │
│   │                 │   HTTP   │                 │                         │
│   │  feed-requests  │◄─────────│   user-feeds    │                         │
│   │                 │          │   (user-feeds-  │                         │
│   └────────┬────────┘          │      next)      │                         │
│            │                   └────────┬────────┘                         │
│            │                            │                                   │
│   ┌────────┴────────┐          ┌────────┴────────┐                         │
│   │  RSS Sources    │          │  Discord API    │                         │
│   │  (External)     │          │  (via discord-  │                         │
│   └─────────────────┘          │  rest-listener) │                         │
│                                └─────────────────┘                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                            MESSAGE BROKER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         RabbitMQ                                     │  │
│   │  - Schedule events (feed refresh triggers)                          │  │
│   │  - Feed processing events                                           │  │
│   │  - Discord delivery events                                          │  │
│   │  - Connection status events                                         │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────┐    ┌───────────────┐    ┌───────────────┐             │
│   │    MongoDB    │    │  PostgreSQL   │    │     Redis     │             │
│   │               │    │               │    │               │             │
│   │ - Users       │    │ - Delivery    │    │ - Feed cache  │             │
│   │ - Feeds       │    │   records     │    │ - Rate limits │             │
│   │ - Servers     │    │ - Articles    │    │ - Sessions    │             │
│   │ - Connections │    │ - Requests    │    │               │             │
│   │ - Supporters  │    │               │    │               │             │
│   └───────────────┘    └───────────────┘    └───────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Service Responsibilities

### backend-api (Monolith)

**Primary Role:** API gateway and user-facing operations

| Responsibility | Description |
|----------------|-------------|
| Authentication | Discord OAuth flow, session management |
| Feed Management | CRUD for feeds, connections, filters |
| User Management | User profiles, preferences, supporters |
| Server Management | Discord server data, channels, roles |
| Schedule Emitter | Triggers feed refresh events |
| Static Hosting | Serves Control Panel SPA |

**Key Integrations:**
- MongoDB (primary data store)
- RabbitMQ (event publishing)
- user-feeds API (feed operations)
- feed-requests API (feed fetching)
- Discord API (server/channel data)

### feed-requests

**Primary Role:** RSS feed fetching and caching

| Responsibility | Description |
|----------------|-------------|
| Feed Fetching | HTTP requests to RSS sources |
| Response Caching | Redis-based response cache |
| Rate Limiting | Per-host rate limiting |
| Retry Logic | Exponential backoff on failures |
| Request Storage | S3-compatible object storage |

**Key Integrations:**
- PostgreSQL (request/response tracking)
- Redis (response caching)
- RabbitMQ (fetch request events)
- S3/SeaweedFS (response storage)

### user-feeds / user-feeds-next

**Primary Role:** Article processing and Discord delivery

| Responsibility | Description |
|----------------|-------------|
| Article Parsing | Extract articles from feed XML |
| Article Filtering | Apply user-defined filters |
| Message Formatting | Build Discord embeds/content |
| Delivery | Send to Discord channels/webhooks |
| Deduplication | Track delivered articles |
| Rate Limiting | Article delivery throttling |

**Key Integrations:**
- PostgreSQL (delivery records, articles)
- Redis (caching)
- RabbitMQ (processing events)
- discord-rest-listener (Discord API)

### bot-presence

**Primary Role:** Discord bot online status

| Responsibility | Description |
|----------------|-------------|
| Gateway Connection | Discord WebSocket connection |
| Status Management | Online/idle/custom status |
| Heartbeat | Keep bot connection alive |

**Key Integrations:**
- Discord Gateway (WebSocket)
- RabbitMQ (status events)

### discord-rest-listener

**Primary Role:** Discord REST API proxy

| Responsibility | Description |
|----------------|-------------|
| API Calls | Execute Discord REST requests |
| Rate Limiting | Handle Discord rate limits |
| Retry Logic | Automatic retry on rate limit |

**Key Integrations:**
- RabbitMQ (request queue)
- Discord REST API
- MongoDB (rate limit tracking)

## Data Flow: Feed Refresh Cycle

```
1. schedule-emitter publishes "refresh" event to RabbitMQ
                              │
                              ▼
2. feed-requests receives event, fetches RSS, caches response
                              │
                              ▼
3. feed-requests publishes "feed fetched" event to RabbitMQ
                              │
                              ▼
4. backend-api (monolith) receives event, enriches with feed config
                              │
                              ▼
5. backend-api publishes "process feed" event to RabbitMQ
                              │
                              ▼
6. user-feeds receives event, parses articles, applies filters
                              │
                              ▼
7. user-feeds formats messages using connection settings
                              │
                              ▼
8. user-feeds publishes delivery events to RabbitMQ
                              │
                              ▼
9. discord-rest-listener executes Discord API calls
                              │
                              ▼
10. discord-rest-listener publishes delivery result events to RabbitMQ
                              │
                              ▼
11. user-feeds receives results, records delivery status in PostgreSQL
```

## Database Schema Overview

### MongoDB (backend-api)

**Core Collections:**
- `users` - Discord user profiles
- `userfeeds` - Feed configurations
- `feedconnections` - Channel/webhook targets
- `profiles` - Server profiles
- `supporters` - Premium subscriptions

### PostgreSQL (user-feeds)

**Core Tables:**
- `delivery_record` - Article delivery tracking
- `feed_article_field` - Parsed article data
- `feed_retry_record` - Failed delivery retries
- `response_hash` - Deduplication hashes

### PostgreSQL (feed-requests)

**Core Tables:**
- `request` - Feed fetch requests
- `response` - Cached responses

## Security Considerations

- Discord OAuth2 for authentication
- Session-based auth with secure cookies
- API keys between services
- Environment variable secrets
- No direct database exposure

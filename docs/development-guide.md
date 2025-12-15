# MonitoRSS Development Guide

## Prerequisites

- **Docker** & **Docker Compose** (required)
- **Node.js** 20.x (for local development without Docker)
- **Bun** (for user-feeds-next service)
- **Git**

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/synzen/MonitoRSS.git
cd MonitoRSS
```

### 2. Create Environment Files

```bash
# For local development
cp .env.example .env.local

# For production
cp .env.example .env.prod
```

### 3. Configure Discord Application

1. Create a Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Set the following in your `.env.local`:
   - `BOT_PRESENCE_DISCORD_BOT_TOKEN` - Bot token
   - `BACKEND_API_DISCORD_BOT_TOKEN` - Same bot token
   - `BACKEND_API_DISCORD_CLIENT_ID` - Application ID
   - `BACKEND_API_DISCORD_CLIENT_SECRET` - OAuth2 secret
3. Add redirect URI: `http://localhost:8000/api/v1/discord/callback-v2`

## Running the Development Environment

### Start All Services

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Key Services & Ports

| Service | Port | Description |
|---------|------|-------------|
| Control Panel | 8000 | React frontend |
| Backend API | 8000 | NestJS API (same as frontend) |
| MongoDB | 27018 | Database (dev port) |
| PostgreSQL | 5431 | Database (dev port) |
| RabbitMQ | 5672, 15672 | Message broker & management UI |
| Redis | 6379 | Cache |
| feed-requests API | 5000 | Feed fetching service |
| user-feeds API | 5001 | Feed processing service |

### Running Individual Services

```bash
# Backend API only
cd services/backend-api
npm install
npm run start:watch

# Control Panel (frontend)
cd services/backend-api/client
npm install
npm run dev

# Feed Requests
cd services/feed-requests
npm install
npm run start:watch

# User Feeds (legacy)
cd services/user-feeds
npm install
npm run start:watch

# User Feeds Next (Bun)
cd services/user-feeds-next
bun install
bun start
```

## Database Migrations

### PostgreSQL (MikroORM)

```bash
# feed-requests
cd services/feed-requests
npm run migration:up      # Apply migrations
npm run migration:down    # Rollback last migration
npm run migration:create  # Create new migration

# user-feeds
cd services/user-feeds
npm run migration:up
npm run migration:down
npm run migration:create
```

### MongoDB

MongoDB migrations are handled at application startup via the `mongo-migrations` module in backend-api.

## Testing

### Backend API

```bash
cd services/backend-api
npm run test           # Unit tests
npm run test:e2e       # E2E tests
npm run test:cov       # Coverage report
```

### Control Panel

```bash
cd services/backend-api/client
npm run test           # Vitest unit tests
```

### Feed Requests

```bash
cd services/feed-requests
npm run test
```

### User Feeds

```bash
cd services/user-feeds
npm run test
```

## Code Style & Linting

```bash
# Lint
npm run lint

# Format
npm run format
```

All services use:
- ESLint for linting
- Prettier for formatting
- TypeScript strict mode

## Building for Production

### Docker Images

Images are automatically built and pushed to GitHub Container Registry on push to `main`:

- `ghcr.io/synzen/monitorss-monolith:main` (backend-api + client)
- `ghcr.io/synzen/monitorss-user-feeds:main`
- `ghcr.io/synzen/monitorss-feed-requests:main`
- `ghcr.io/synzen/monitorss-bot-presence:main`
- `ghcr.io/synzen/monitorss-discord-rest-listener:main`

### Manual Build

```bash
# Backend API (monolith with client)
cd services/backend-api
npm run build

# Client only
cd services/backend-api/client
npm run build
```

## Environment Variables Reference

### Required Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `BACKEND_API_MONGODB_URI` | backend-api | MongoDB connection string |
| `BACKEND_API_DISCORD_BOT_TOKEN` | backend-api | Discord bot token |
| `BACKEND_API_DISCORD_CLIENT_ID` | backend-api | Discord application ID |
| `BACKEND_API_DISCORD_CLIENT_SECRET` | backend-api | Discord OAuth secret |
| `BACKEND_API_SESSION_SECRET` | backend-api | Session encryption key (64 chars) |
| `BACKEND_API_SESSION_SALT` | backend-api | Session salt (16 chars) |
| `BOT_PRESENCE_DISCORD_BOT_TOKEN` | bot-presence | Discord bot token |
| `USER_FEEDS_DISCORD_API_TOKEN` | user-feeds | Discord bot token |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES` | 10 | Feed refresh interval |
| `BACKEND_API_DEFAULT_MAX_USER_FEEDS` | 10000 | Max feeds per user |
| `FEED_REQUESTS_REQUEST_TIMEOUT_MS` | 15000 | Feed fetch timeout |
| `FEED_REQUESTS_MAX_FAIL_ATTEMPTS` | 11 | Failures before disabling |

## Troubleshooting

### Docker Issues

```bash
# View logs
docker compose -f docker-compose.dev.yml logs -f [service-name]

# Rebuild containers
docker compose -f docker-compose.dev.yml up -d --build

# Reset volumes
docker compose -f docker-compose.dev.yml down -v
```

### MongoDB Replica Set

The development setup uses MongoDB with replica set for transaction support. If MongoDB fails to start:

```bash
# Check replica set status
docker exec -it monitorss-dev-mongo-1 mongosh --eval "rs.status()"
```

### RabbitMQ Management

Access RabbitMQ management UI at `http://localhost:15672` (guest/guest)

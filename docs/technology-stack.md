# MonitoRSS Technology Stack

## Overview

MonitoRSS uses a modern TypeScript-based stack with microservices architecture, event-driven communication, and hybrid database approach.

## Backend Technologies

### Runtime & Frameworks

| Technology | Version | Service(s) | Purpose |
|------------|---------|------------|---------|
| Node.js | 20.x | All (except user-feeds-next) | JavaScript runtime |
| Bun | latest | user-feeds-next | High-performance runtime |
| NestJS | 10-11.x | backend-api, user-feeds, feed-requests, bot-presence | Application framework |
| Fastify | 5.x | backend-api, user-feeds, feed-requests | HTTP server |
| Express | - | bot-presence | HTTP server |

### Languages & Type Safety

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.x | Primary language |
| Zod | 3.x | Runtime validation (user-feeds-next) |
| class-validator | 0.14.x | DTO validation (NestJS) |
| class-transformer | 0.5.x | Object transformation |

### Database & ORM

| Technology | Version | Service(s) | Purpose |
|------------|---------|------------|---------|
| MongoDB | 7.x | backend-api, feed-requests | Document store |
| Mongoose | 6-7.x | backend-api, feed-requests | MongoDB ODM |
| PostgreSQL | 16.x | user-feeds, feed-requests | Relational store |
| MikroORM | 5-6.x | user-feeds, feed-requests | PostgreSQL ORM |

### Message Broker & Caching

| Technology | Version | Purpose |
|------------|---------|---------|
| RabbitMQ | 3.x | Message broker |
| @golevelup/nestjs-rabbitmq | 4-6.x | NestJS RabbitMQ integration |
| Redis | 4.x | Response caching, rate limiting |

### External Integrations

| Technology | Version | Purpose |
|------------|---------|---------|
| @synzen/discord-rest | 0.7.x | Discord REST API client |
| @discordjs/ws | 2.x | Discord gateway (bot-presence) |
| @discordjs/rest | 2.x | Discord REST (bot-presence) |
| feedparser | 2.2.x | RSS/Atom parsing |
| Paddle | - | Payment processing |

### Supporting Libraries

| Library | Purpose |
|---------|---------|
| dayjs | Date/time handling |
| lodash | Utility functions |
| handlebars | Template rendering |
| html-to-text | HTML to plain text conversion |
| undici | HTTP client |
| workerpool | Worker thread pool |

## Frontend Technologies

### Core Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| Vite | 6.x | Build tool & dev server |
| TypeScript | 5.x | Type safety |

### UI & Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| Chakra UI | 2.x | Component library |
| Framer Motion | 5.x | Animations |
| react-icons | 4.x | Icon library |
| react-color | 2.x | Color picker |

### State & Data

| Technology | Version | Purpose |
|------------|---------|---------|
| TanStack Query | 4.x | Server state management |
| TanStack Table | 8.x | Data tables |
| react-hook-form | 7.x | Form handling |
| Yup | 1.x | Form validation |

### Routing & Navigation

| Technology | Version | Purpose |
|------------|---------|---------|
| react-router-dom | 6.x | Client-side routing |

### Internationalization

| Technology | Version | Purpose |
|------------|---------|---------|
| i18next | 21.x | i18n framework |
| react-i18next | 11.x | React bindings |

### UI Features

| Technology | Purpose |
|------------|---------|
| @dnd-kit | Drag and drop |
| react-virtuoso | Virtual scrolling |
| react-select | Enhanced select inputs |
| react-textarea-autosize | Auto-sizing textareas |
| highlight.js | Syntax highlighting |
| simple-markdown | Markdown parsing |
| twemoji | Twitter emoji rendering |

### Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| Vitest | 3.x | Unit testing |
| Testing Library | - | Component testing |
| MSW | 2.x | API mocking |

## Infrastructure

### Containerization

| Technology | Purpose |
|------------|---------|
| Docker | Container runtime |
| Docker Compose | Multi-container orchestration |
| GitHub Container Registry | Image hosting |

### CI/CD

| Technology | Purpose |
|------------|---------|
| GitHub Actions | CI/CD pipelines |
| dorny/paths-filter | Change detection |
| docker/build-push-action | Multi-platform builds |

### Storage

| Technology | Purpose |
|------------|---------|
| AWS S3 / SeaweedFS | Object storage (feed responses) |

### Monitoring & Logging

| Technology | Purpose |
|------------|---------|
| @monitorss/logger | Custom logging package |
| winston | Logging (discord-rest-listener) |
| Sentry | Error tracking (frontend) |
| Split.io | Feature flags |

## Development Tools

### Code Quality

| Tool | Purpose |
|------|---------|
| ESLint | Linting |
| Prettier | Code formatting |
| TypeScript | Type checking |

### Testing

| Tool | Service | Purpose |
|------|---------|---------|
| Jest | backend-api, feed-requests | Unit testing |
| Vitest | client | Unit testing |
| mongodb-memory-server | backend-api | In-memory MongoDB |
| nock | backend-api | HTTP mocking |
| supertest | All backends | HTTP testing |

### Build Tools

| Tool | Service | Purpose |
|------|---------|---------|
| NestJS CLI | NestJS services | Build & scaffolding |
| Vite | client | Frontend build |
| ts-node | All | TypeScript execution |

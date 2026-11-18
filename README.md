# King Legacy Global Event Tracker

Full-Stack Real-Time Event Tracking & Global Public Server Scanner for **Roblox: King Legacy** (Universe ID `1451439645`).

## Verified Roblox Place & World Mapping

| World / Sea | Place ID | Verification Source |
| :--- | :--- | :--- |
| **First Sea** (`FIRST_SEA`) | `4520749081` | `develop.roblox.com/v1/universes/1451439645/places` |
| **Second Sea** (`SECOND_SEA`) | `6381829480` | `develop.roblox.com/v1/universes/1451439645/places` |
| **Third Sea** (`THIRD_SEA`) | `15759515082` | `develop.roblox.com/v1/universes/1451439645/places` |

World detection is strictly deterministic based on Place ID. Server names are never guessed; unknown place IDs resolve to `UNKNOWN`.

---

## Transparency & Detection Architecture

This platform separates **Public Server Discovery** from **In-Game Event Detection**:
1. **Roblox Public Server Discovery (`src/lib/scanner/roblox-discovery.ts`)**: Paginates `https://games.roblox.com/v1/games/{placeId}/servers/Public` with rate limiting and deduplication by `jobId`, recording player count, FPS, ping, and server status (`ACTIVE`, `FULL`, `CLOSED`). Newly discovered servers default to `UNSCANNED` / `UNCHECKED`.
2. **Multi-Provider Detection Engine (`src/lib/scanner/providers.ts`)**:
   - `OFFICIAL_PUBLIC`: Official Roblox Universe updates & deterministic 4-hour Black Market stock schedules.
   - `AUTHORIZED_AGENT`: Signed telemetry from authorized in-game monitoring agents (`POST /api/v1/scanner/agent-ingest`) -> `VERIFIED`.
   - `ADMIN_REPORT`: Admin-approved or manually confirmed reports -> `VERIFIED`.
   - `COMMUNITY_REPORT`: Player submissions (`POST /api/v1/events/report`) -> `REPORTED` (corroboration + moderation workflow).
   - `EXTERNAL_API`: Configurable external partner feed adapter.
   - `TEST_PROVIDER`: Explicitly labeled test/simulation provider (`isTestData: true`, `TEST` UI badge) attaching test events onto real discovered servers for QA & live countdown demonstrations.

Scanner Coverage endpoints (`/api/v1/scanner/coverage`) always expose exact discovered, scanned, verified, and unscanned counts and never claim "ALL SERVERS SCANNED" unless verified.

---

## Features & Views

- **Event Tracking Dashboard**: Dark gaming dashboard with compact event cards, real-time server-synced countdown timers, category/world counters, search by Event or Server Job ID, and sort tabs (`Ending Soonest`, `Just Found`, `Most Recent`, `Most Active`).
- **Global Scanner Dashboard**: 9 real-time metrics, coverage transparency bar, world/status filters, server cards with `View Details`, `Copy Server ID`, `Copy Info`, `Join Server` (`roblox://`), and server event history.
- **Server Browser & Event History**: Full paginated Roblox public server directory and historical detection archive.
- **Real-Time SSE Stream (`/api/v1/stream/global`)**: Live server-time synchronization, instant card updates, and notification delivery.
- **Notifications & Discord Webhooks**: Real-time alerts and Discord Webhook embed testing/delivery.
- **REST API v1 & OpenAPI Docs**: Versioned API (`/api/v1/*`) with rate limiting, Zod validation, API Key auth (`X-API-Key`), and interactive OpenAPI viewer (`/api/v1/openapi`).
- **Admin Dashboard**: Full CRUD for events, server management, scanner job monitoring, detection provider toggles, report moderation (`APPROVE` / `REJECT`), user role management, API Key generation/revocation, and audit logs.

---

## Quick Start (Local Development)

```bash
npm install
npx prisma generate
npm run dev
```

On local execution without external Postgres/Redis running, the app initializes an embedded **PostgreSQL (`PGlite`)** database engine with Prisma's PostgreSQL driver adapter and applies `prisma/migrations/20261116000000_init/migration.sql` automatically, plus an embedded background worker queue.

### Demo Accounts
- **Admin**: `admin@kinglegacy.gg` / `Admin123!`
- **User**: `hunter@kinglegacy.gg` / `Hunter123!`
- **Demo API Key**: `kl_live_demo_key_2026_tracker`

---

## Docker Compose Deployment (PostgreSQL 16 + Redis 7 + BullMQ Worker + Nginx)

```bash
cp .env.example .env
docker compose up --build -d
```

Services started:
- `postgres` (`postgres:16-alpine`)
- `redis` (`redis:7-alpine`)
- `app` (Next.js standalone production server)
- `worker` (Dedicated BullMQ background scanner process)
- `nginx` (Reverse proxy with SSE streaming support on port `80`)

---

## Automated Testing

```bash
# Unit & Integration Tests (Vitest)
npm test

# Production Build
npm run build

# End-to-End Browser Tests (Playwright)
npm run test:e2e
```

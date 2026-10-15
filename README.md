# Rahgir — Campus Event Navigation & Discovery Platform

Monorepo: `client/` (React 18 + TS + Vite + Redux Toolkit + Tailwind + Mapbox GL JS + PWA) and
`server/` (Express + TS + Prisma + SQLite-local/Postgres-prod + Socket.IO + JWT + Swagger).

## Quick start (Windows / no Docker needed)

Prereqs: Node 22+, npm. A Mapbox public token (for the 3D map; app works without it).

```bash
# 1. Backend
cd server
cp .env.example .env        # uses local SQLite file ./prisma/dev.db
npm install
npx prisma db push
npm run db:seed              # 15 venues, ~102 events (past+future, full/cancelled/moved), 6 users, registrations, 3 itineraries, crowd samples
npm run dev                  # :4000

# 2. Frontend (new terminal)
cd client
echo "VITE_MAPBOX_TOKEN=pk.YOUR_TOKEN" > .env   # paste your token
npm install
npm run dev                  # :5173
```

Open http://localhost:5173. Demo logins (password `Password123!`):
`attendee@test.com` · `priya@test.com` · `rahul@test.com` · `organiser@test.com` · `wellness-org@test.com` · `admin@test.com`

## Production (Postgres + Redis via Docker)

```bash
docker compose up -d postgres redis   # or use hosted Postgres/Redis
# server: set DATABASE_URL="postgresql://rahgir:rahgir@localhost:5432/rahgir"
#   and change provider in server/prisma/schema.prisma sqlite -> postgresql
npx prisma migrate dev
```

Env vars: see `.env.example` (root), `server/.env.example`, `client/.env.example`.
Key: `MAPBOX_TOKEN` / `VITE_MAPBOX_TOKEN`, `DATABASE_URL`, `REDIS_URL` (optional — in-memory fallback),
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_ORIGIN`.

## API docs

Swagger UI at `http://localhost:4000/api-docs`. Health at `/api/health`.

## Tests

```bash
cd server && npm test     # jest: geo, conflicts, API basics (9 tests)
cd client && npm test     # vitest: formatting/category utils
```

## Feature map vs spec

- Discovery/filters/list+grid/detail/availability/buffers ✓
- Mapbox 3D map, venue markers by category, click/hover, crowd rings ✓ (needs token)
- Indoor/outdoor hybrid: outdoor via Mapbox Directions/Matrix; indoor modeled per-building and stitched
  (see `server/src/utils/geo.ts` + venue `indoorGraphId`) — extend graphs per building as needed
- Eatery/rest optimization: `includeEateries` in `/routes/optimize` + gap suggestions ✓
- Itinerary CRUD, drag-drop reorder, conflicts, totals/gaps, `.ics` export ✓ (PDF: use browser print)
- Route optimizer with buffers, departure/arrival times, leave reminders ✓
- Realtime Socket.IO (event status, itinerary-affected, crowd) + toasts ✓
- Auth single-table roles (ATTENDEE/ORGANISER/ADMIN), JWT 15m/7d rotation ✓
- Organiser: event CRUD, cancel/restore, crowd publish, broadcast (SMTP/Twilio stub — logs recipients) ✓
- PWA offline (events/venues NetworkFirst + Mapbox SWR) ✓ · AR Preview (camera+compass web approximation) ✓
```

## Load testing

```bash
# 100 concurrent health checks
node -e "Promise.all(Array.from({length:100},()=>fetch('http://localhost:4000/api/health').then(r=>r.status))).then(s=>console.log('ok:',s.filter(x=>x===200).length,'/100'))"
```

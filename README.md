# India Race Calendar

A Phase 1 event discovery application for endurance and fitness events across India. It uses Next.js App Router and TypeScript, PostgreSQL through Prisma ORM, and Tailwind CSS 4. All event and taxonomy lookups are server-side; filters are shareable URL parameters.

> Development listings are illustrative samples marked `isDemo`. They are not verified real races, and no source, registration, or official URLs are fabricated.

## Architecture

- One Next.js application contains server rendered pages, route handlers, and data access.
- PostgreSQL is the source of truth when `DATABASE_URL` is configured.
- Without a database connection, the application uses the same clearly labeled sample event set so the UI can be explored before provisioning Supabase.
- Prisma models Country → State → City, Venue, Organizer, hierarchical EventCategory, Event, and one-to-many EventDistance. Provenance, source verification time, status, and demo flags are retained on each event.
- `src/lib/domain.ts` contains URL slug, filtering, and input validation helpers independent of UI/database code.

## Technology

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma ORM 7, PostgreSQL, Vitest.

## Prerequisites

- Node.js 22.12+ (or a supported current LTS) and npm
- Supabase PostgreSQL database for persistent storage and seeding

## Environment setup

Copy `.env.example` to `.env.local`. Set `DATABASE_URL` to the application PostgreSQL connection string and `DIRECT_URL` to a direct PostgreSQL connection that supports migrations. Supabase pooled connections can be used at runtime; use the direct database host/port for `DIRECT_URL`. Set `NEXT_PUBLIC_SITE_URL` to the canonical site origin (localhost for development). Next.js loads `.env.local` automatically; Prisma CLI and the seed script explicitly load it too.

The Supabase project URL and publishable/anon key are not PostgreSQL connection strings and cannot be used by Prisma. Copy the database connection string from Supabase's **Connect** dialog into `DATABASE_URL` and the direct connection into `DIRECT_URL`. Keep both values private and do not prefix them with `NEXT_PUBLIC_`.

The app can be started without database variables to preview its demo data. Database migrations and seeding require both database URLs.

## Database setup and seed

```bash
npm install
npm run db:migrate
npm run db:seed
```

The seed script adds India and 15 cities, event category parents/children, organizers and venues, plus 40 clearly flagged sample events: 10 Pune, 5 each Mumbai/Bengaluru/Delhi/Hyderabad, and one in each remaining city. Seed records contain no fabricated external URLs and can be safely rerun.

`npm run db:studio` opens Prisma Studio.

## Local development

```bash
npm run dev
```

Open http://localhost:3000. Use the homepage or `/events`; filters are submitted as GET parameters such as `/events?city=pune&category=triathlon&from=2026-12-01`. City pages live under `/cities/[slug]`; category pages under `/categories/[slug]`.

## API

- `GET /api/events` supports `city`, `state`, `category`, `from`, `to`, `search`, `status`, and `distance` parameters.
- `GET /api/events/[slug]`
- `GET /api/cities`
- `GET /api/categories`

Responses expose event and taxonomy fields needed for discovery while omitting database identifiers and creation metadata.

## Checks

```bash
npm run lint
npm test
npm run build
```

Domain tests cover slug generation, category/city/date/search filtering, and event validation.

## Production build and Vercel

```bash
npm run build
npm start
```

Import the repository as a Vercel project, configure `DATABASE_URL`, `DIRECT_URL`, and `NEXT_PUBLIC_SITE_URL`, then deploy. Run migrations as a release step against `DIRECT_URL`; run the seed script only for development/demo databases. No paid third-party services are needed by the code.

## Supabase

Create a PostgreSQL project and copy its connection strings from the database settings. The runtime connection can use the Supabase pooler. `DIRECT_URL` should use the direct database connection for Prisma migrations. Supabase may require SSL; the provider connection string should include its recommended `sslmode` query parameters.

## SEO

Pages define titles/descriptions and canonical metadata where applicable. Event routes have dynamic Open Graph and Twitter metadata. `/sitemap.xml` includes event, city, and category pages; `/robots.txt` allows indexing and excludes `/admin`.

## Phase 2 roadmap

Add ingestion adapters for web/API/RSS sources, provenance and duplicate review flows, verified organizer profiles, user submissions and admin approval, then notifications, maps, and personalized discovery. Keep ingestion writes behind validation and review so the public event model remains the canonical record.

## Current limits

- No authentication, editing interface, ingestion, maps, or notifications.
- Demo records have no live registration/official links and are explicitly marked.
- Pagination is currently capped at 60 results; a production catalog should add cursor pagination.
- No cursor pagination yet; current listings are capped at 60 results.



Database Password
Qaz!@#$75395

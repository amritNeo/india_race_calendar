# India Race Calendar

A race discovery and data management application for endurance and fitness events across India. It uses Next.js App Router and TypeScript, Supabase Auth, PostgreSQL through Prisma ORM, and Tailwind CSS 4. All public event and taxonomy lookups are server-side; filters are shareable URL parameters.

> Development listings are illustrative samples marked `isDemo`. They are not verified real races, and no source, registration, or official URLs are fabricated.

## Architecture

- One Next.js application contains server rendered pages, route handlers, and data access.
- PostgreSQL is the source of truth when `DATABASE_URL` is configured.
- Without a database connection, the application uses the same clearly labeled sample event set so the UI can be explored before provisioning Supabase.
- Prisma models Country → State → City, Venue, Organizer, hierarchical EventCategory, Event, and one-to-many EventDistance. Provenance, source verification time, status, and demo flags are retained on each event.
- `src/lib/domain.ts` contains URL slug, filtering, and input validation helpers independent of UI/database code.
- `src/lib/ingestion/` contains source adapters, deterministic normalization, duplicate detection, and the server-side ingestion runner.
- `EventSource`, `RawEvent`, `EventSourceRecord`, and `IngestionRun` retain source configuration, original payloads, provenance, and execution history. The canonical `Event` is published only after review.

## Technology

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma ORM 7, PostgreSQL, Vitest.

## Prerequisites

- Node.js 22.12+ (or a supported current LTS) and npm
- Supabase PostgreSQL database for persistent storage and seeding

## Environment setup

Copy `.env.example` to `.env.local`. Set `DATABASE_URL` to the application PostgreSQL connection string and `DIRECT_URL` to a direct PostgreSQL connection that supports migrations. Supabase pooled connections can be used at runtime; use the direct database host/port for `DIRECT_URL`. Set `NEXT_PUBLIC_SITE_URL` to the canonical site origin (localhost for development). Next.js loads `.env.local` automatically; Prisma CLI and the seed script explicitly load it too.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for authentication. These values are intended for browser use; never expose database connection strings or Supabase secret/service-role keys. The Supabase URL and publishable key are not PostgreSQL connection strings and cannot be used by Prisma. Copy the database connection string from Supabase's **Connect** dialog into `DATABASE_URL` and the direct connection into `DIRECT_URL`.

The public site can be previewed without database variables using demo event data. Authentication requires the Supabase URL and publishable key, while username/password accounts also require the configured database and the authentication migration.

## Accounts and authentication

The homepage is the account landing page. Users can create an account at `/signup` with a username, email, and password, or sign in at `/login` with their username/email and password, Google, or Strava. Signed-in users are sent to `/dashboard`; signed-out users are redirected to login. Supabase Auth stores sessions in server-managed cookies. A private profile table stores normalized usernames for username login; row-level security is enabled and direct Data API access is revoked.

Apply the authentication migration before enabling signup:

```bash
npx prisma migrate deploy
npx prisma generate
```

In Supabase Auth settings, enable Google and add the app callback URL to allowed redirect URLs: `http://localhost:3000/auth/callback` locally and your production origin plus `/auth/callback` on Vercel. Configure the Google OAuth callback URI shown by Supabase in Google Cloud Console.

For Strava, create an app in [Strava API Settings](https://www.strava.com/settings/api). Add a Supabase Custom OAuth provider with identifier `custom:strava`, using the Strava OAuth authorize endpoint (`https://www.strava.com/oauth/authorize`), token endpoint (`https://www.strava.com/oauth/token`), and the deployed app's user-info endpoint (`https://YOUR_APP_DOMAIN/api/auth/strava-userinfo`). That endpoint calls Strava's athlete profile API and returns the stable `sub` Supabase needs. Configure the callback URL shown for the custom provider in Supabase as Strava's Authorization Callback Domain, enable optional email because Strava does not provide athlete email, and request only the `read` scope. If Strava rejects PKCE parameters, disable PKCE for this provider in Supabase. Also add the app's `/auth/callback` URL to Supabase's allowed redirect URLs.

OAuth remains unavailable until provider credentials and redirect URLs are configured in Supabase, Google Cloud, and Strava.

## Phase 2 migration and ingestion

Apply the additive Prisma migration with `npx prisma migrate deploy` against `DIRECT_URL`. It adds source/provenance/raw-event/run tables, review statuses, city aliases, duplicate decisions, and supporting indexes. It does not reset or replace Phase 1 data. Row-level security is enabled on the application tables without public Data API policies; reads and writes go through the server-side Prisma connection.

The admin workspace is at `/admin`. It has no authentication and is disabled in production. Keep production mutations disabled until real authentication and authorization are added. Local development admin actions require a configured database.

The manual adapter is used for manual event creation. The configurable public JSON feed adapter accepts an HTTPS endpoint returning an array or `{ "events": [...] }`; records are stored raw before normalization and always enter review. The feed is capped at 25 records and 2 MB per run, uses a 12-second request timeout, rejects IP/private hosts and redirects, and never bypasses access restrictions. No external source is preconfigured or claimed as tested. RSS extraction is not implemented.

To create a JSON feed source, use **Admin → Sources**, configure its HTTPS endpoint, enable it, then choose **Run now**. Each item may provide `externalId`, `sourceUrl`, `name` (or `title`), `description`, `startDate` (or `date`), `endDate`, `city`, `category`, `venue`, `organizer`, `registrationUrl`, `officialWebsiteUrl`, and `distances` (`name`, `distanceKm`, `discipline`). Existing city/category taxonomy is used; unmatched locations/categories stay in failed raw review for correction. City aliases can be added while editing an event.

## Phase 3 public website discovery

Create a website source at `/admin/sources/new` and choose `WEB` to crawl public HTML pages. The crawler checks `robots.txt`, consults sitemap files, follows same-host links within the configured depth/page limits, and extracts Schema.org JSON-LD, microdata, OpenGraph, and basic semantic HTML data. Website requests are restricted to public IP addresses, pinned to the validated address, limited by size and timeout, and revalidated on redirects. Disallowed or access-denied runs are recorded as `BLOCKED`; discovered events still enter the existing raw-event normalization and pending-review flow and are never published automatically.

Apply the Phase 3 schema migration with `npx prisma migrate deploy` against `DIRECT_URL` before running website sources. Crawl depth defaults to 2 (maximum 5), and the page limit defaults to 50 (maximum 100).

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

Open http://localhost:3000. The homepage is the account landing page; use `/events` to browse and filter the public race calendar with GET parameters such as `/events?city=pune&category=triathlon&from=2026-12-01`. City pages live under `/cities/[slug]`; category pages under `/categories/[slug]`.

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

## Next phases

Later work can add authenticated production administration, RSS and scheduled crawling, maps, notifications, and optional AI-assisted extraction with human review. Keep the canonical event write path validated and reviewed.

## Current limits

- Admin authorization is separate from athlete login; admin reads/writes remain disabled in production until role-based admin authorization is implemented.
- Demo records have no live registration/official links and are explicitly marked.
- Public event listings are currently capped at 60 results; a production catalog should add cursor pagination.

# Karahi Night

A private karahi preorder reservation app for a small invited gathering. Guests select their dish, quantity, and pickup slot — admin manages orders and users.

Note: the underlying package/folder is still named `pizza-night` (kept internal — see Gotchas) even though the app is branded "Karahi Night".

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/pizza-night run dev` — run the frontend (port 21667)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, React Query, Wouter
- API: Express 5 + express-session (cookie-based sessions)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/users.ts` — users table (name, 4-digit code, active flag)
- `lib/db/src/schema/orders.ts` — orders table (dish choice, quantity, slot, status)
- `artifacts/api-server/src/routes/auth.ts` — login/logout/session routes
- `artifacts/api-server/src/routes/users.ts` — admin user management
- `artifacts/api-server/src/routes/orders.ts` — order placement and management
- `artifacts/api-server/src/routes/summary.ts` — event capacity summary
- `artifacts/pizza-night/src/` — React frontend

## Architecture decisions

- Cookie-based sessions (express-session) — no JWT, simple server-side state
- Session stores role ("user" | "admin") — admin has no userId, users have no password only 4-digit codes
- Capacity enforced on the server: dishes per slot and total capacity are configured per event. Frontend reads EventSummary to constrain the form.
- One order per user — enforced on POST /orders
- Admin password hardcoded as "IamAdmin" (private gathering, no auth needed)

## Product

- Invited guests log in via name dropdown + 4-digit code
- Order karahi dishes (Chicken Karahi 90 DKK / Lamb Karahi 120 DKK / Beef Karahi 100 DKK / Naan 15 DKK by default, editable per event), pick a pickup slot (16:00–19:00)
- Admin logs in with password "IamAdmin" and manages orders, users, capacity, and menu items/prices

## User preferences

- Friendly, homemade feel — not a commercial restaurant app
- No payment integration, no public registration, no email verification
- Prices vary per dish — see default menu above; admin can edit per event
- Theme: "Spice Route" — paprika red-orange primary, turmeric gold accent, warm cream background, espresso brown foreground

## Gotchas

- Run `pnpm run typecheck:libs` after changing DB schema before running API server typecheck
- Users are seeded once at first startup (9 invited users with random 4-digit codes)
- Check admin dashboard to view each user's code

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

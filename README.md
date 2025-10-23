# PorteiroApp Monorepo

Multi-tenant condominium management system with three applications and a shared package library. Features include resident registration, visitor management, intercom voice/video calling (Agora), and admin operations.

## Monorepo Structure

```
porteiroapp/
├── apps/
│   ├── interfone-api/        # Express API (Node 22 native TS/ESM)
│   ├── expo/                 # React Native (Expo) mobile app
│   └── nextjs/               # Next.js 15 web app (App Router)
├── packages/
│   └── common/               # Shared code (Supabase client, hooks, types)
├── tests/                    # Automated API and persistence tests
├── pnpm-workspace.yaml       # Workspace + dependency catalogs
├── package.json              # Root scripts for dev/build/test
└── vercel.json               # Vercel rewrites (if deploying web)
```

### Apps
- **`apps/interfone-api`**
  - Express 5, TypeScript, native Node 22 ESM (no bundler).
  - Handles Agora token generation and call lifecycle, health/status routes.
  - Uses Supabase (PostgreSQL) via `@porteiroapp/common` client.
  - See `apps/interfone-api/README.md` for endpoints and details.

- **`apps/expo` (porteiro-mobile)**
  - Expo Router, React Native 0.81.5 + React 19.
  - Role-based routes under `app/admin`, `app/morador`, `app/porteiro`, `app/visitante`.
  - Uses Agora React Native SDK.

- **`apps/nextjs` (porteiro-site)**
  - Next.js 15 (App Router), Tailwind CSS v4, React 19.

### Shared Package
- **`packages/common`** (`@porteiroapp/common`)
  - Cross-platform Supabase integration (web, RN, server) with unified client.
  - Exports: `/supabase`, `/hooks`, `/calling`.
  - Must be built before apps: `pnpm build:common`.

## Requirements
- **Node**: >= 22.18.0 (native TypeScript + ESM used in API)
- **pnpm**: >= 9.15.0 (enforced via `packageManager`)

Workspace catalogs pin shared versions (see `pnpm-workspace.yaml`), including React 19 under the `react19` catalog.

## Setup

```bash
pnpm install
```

If you change `packages/common`, rebuild it:

```bash
pnpm build:common
```

## Development

- Run all apps in parallel:

```bash
pnpm dev
```

- Run a single app:

```bash
pnpm dev:api     # Express API
pnpm dev:web     # Next.js
pnpm dev:mobile  # Expo
```

API uses Node’s native watcher and TypeScript support (no ts-node/tsx required).

## Build

```bash
pnpm build          # Build apps and packages
pnpm build:api      # API only
pnpm build:web      # Next.js only
pnpm build:mobile   # Expo only
pnpm build:common   # Shared package
```

## Start (Production)

```bash
pnpm start:web   # Next.js
pnpm start:api   # API
```

## Testing

Automated tests live in `tests/` and target API endpoints and database persistence.

- From repo root (delegates to `@porteiroapp/tests`):

```bash
pnpm test            # All tests
pnpm test:unit       # Unit/basic
pnpm test:advanced   # Advanced scenarios
pnpm test:persistence
```

- Directly in `tests/` (Node built-in test runner): see `tests/README.md` and `tests/package.json`.

> Note: Tests expect the API on `http://localhost:3001`. Set `PORT=3001` in `apps/interfone-api/.env` when running tests.

## Environment Variables

Create `.env` files per app using the included examples.

- **API** `apps/interfone-api/.env.example`:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, `AGORA_TOKEN_TTL_SECONDS`
  - `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` (optional WhatsApp)
  - `PORT` (use `3001` for tests), `JWT_SECRET`, `ALLOWED_ORIGINS`
  - Additional optional providers (Twilio, push) documented in the example.

- **Mobile** `apps/expo/.env.example`:
  - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`
  - `API_BASE_URL` (points to interfone-api)

- **Web** (`apps/nextjs`): see `apps/nextjs/env.d.ts` for typed envs
  - Server: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - Client: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Optional: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_AGORA_APP_ID`

Never commit secrets. Use `.env.local`/`.env` files and your deployment provider’s secret manager.

## Architecture Overview

- **API (`apps/interfone-api`)**
  - Clean Express structure: `src/controllers`, `src/routes`, `src/services`.
  - Health at `/` and `/api/status`.
  - Supabase client is created via `@porteiroapp/common` server factory.

- **Mobile (`apps/expo`)**
  - Expo Router with per-role layouts under `app/*/_layout.tsx`.
  - Agora for RTC features.

- **Web (`apps/nextjs`)**
  - App Router under `src/app/`, components in `src/components/`, utilities in `src/lib/`.

- **Shared Supabase (`packages/common`)**
  - `SupabaseClientFactory` creates platform-aware clients for RN/web/server.
  - `UnifiedSupabaseClient` adds retry/timeout and platform-specific settings.
  - See `packages/common/supabase/README.md` for usage and advanced features.

## Deployment

- A `vercel.json` is present at root for rewrites. If deploying the web app, configure Vercel (or your platform) from `apps/nextjs`.
- The API can run on any Node 22 environment; ensure required env vars are set.
- Mobile app deployment follows Expo/EAS workflows.

## Troubleshooting

- **Node version**: Ensure Node >= 22.18.0. Native TS/ESM is required by the API.
- **Build order**: Rebuild `@porteiroapp/common` after changes.
- **Ports**: Tests expect `interfone-api` on `3001`. Update `.env` accordingly.
- **CORS**: Configure `ALLOWED_ORIGINS` in API `.env` for your clients.

## Useful Scripts (root `package.json`)

```json
{
  "dev": "pnpm --parallel --filter \"./apps/**\" dev",
  "build": "pnpm --recursive --filter \"./apps/**\" --filter \"./packages/**\" build",
  "test": "pnpm --filter @porteiroapp/tests test:all",
  "typecheck": "pnpm --recursive --filter \"./apps/**\" --filter \"./packages/**\" typecheck"
}
```

---

For deeper details, see:
- `CLAUDE.md` for an architecture summary and workflows
- `docs/agora-voice-plan.md` for Agora Voice integration plan, implementation details, and security measures
- `apps/interfone-api/README.md` for API endpoints
- `packages/common/README.md` and `packages/common/supabase/README.md` for shared Supabase usage
- `tests/README.md` for test suites and execution

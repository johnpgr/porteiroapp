# Repository Guidelines

## Project Structure & Module Organization
Core apps sit under `apps/`: `interfone-api` (Express 5 + native TS/ESM), `nextjs` (Next.js 15 App Router + Tailwind 4), and `expo` (Expo Router mobile). Shared Supabase clients, hooks, and Agora helpers stay in `packages/common`; rebuild them with `pnpm build:common` after edits so downstream apps pick up changes. Automated API/persistence suites reside in `tests/src`, while deployment and infra files (`supabase/`, `vercel.json`, `docs/`) live at the repo root for quick reference.

## Build, Test, and Development Commands
`pnpm install` hydrates the workspace (Node >=22.18). `pnpm dev` runs every app after compiling `@porteiroapp/common`; scope via `pnpm dev:web`, `dev:mobile`, or `dev:api`. Use `pnpm build` for a full compile or targeted `build:*` scripts for single surfaces. Quality gates: `pnpm lint`, `pnpm typecheck`, `pnpm test` (delegates to `@porteiroapp/tests`). When tooling misbehaves, run `pnpm clean && pnpm install`.

## Coding Style & Naming Conventions
Projects are TypeScript-first with ESM imports and two-space indentation (see `apps/interfone-api/src`). API routes/services keep kebab-case filenames such as `call.routes.ts`, while React components in `apps/nextjs/src/components` and `apps/expo/app` stay PascalCase. Run `pnpm lint` to enforce the Next.js/Expo ESLint configs; `pnpm format` inside `apps/expo` applies ESLint+Prettier fixes. Prefer named exports, colocate hooks under `hooks/`, and keep Tailwind or StyleSheet definitions near their components.

## Testing Guidelines
`@porteiroapp/tests` relies on the Node `--test` runner plus Axios and expects the API on `http://localhost:3001` (`PORT=3001` in `apps/interfone-api/.env`). Use `pnpm test:unit`, `test:advanced`, `test:persistence`, or `test:all` for coverage tiers, and mirror the existing descriptive filenames inside `tests/src/**/*.test.ts` when adding suites. Reset staged data between tests and log request IDs to align with the API’s request tracing.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits (`feat:`, `refactor:`, `fix:`). Keep commits scope-limited, include updated docs/tests when behavior shifts, and describe validation steps in the body. Pull requests should outline context, mention any env or schema changes, attach screenshots or payloads for UI/API work, and request reviewers for the impacted surface (API, mobile, web, or shared package).

## Security & Environment Notes
Do not commit secrets. Start from each `.env.example` (`apps/interfone-api`, `apps/expo`, `apps/nextjs`) and supply Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) plus Agora (`AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`) values via your runtime. Keep `ALLOWED_ORIGINS` tight, rotate Agora tokens through `/api/tokens`, and use a dedicated Supabase project for development instead of reusing production credentials.

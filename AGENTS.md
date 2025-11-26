# Repository Guidelines

## Project Structure & Module Organization
Core apps sit under `apps/`: `interfone-api` (Express 5 + native TS/ESM), `nextjs` (Next.js 15 App Router + Tailwind 4), and `expo` (Expo Router mobile). Shared Supabase clients, hooks, and Agora helpers stay in `packages/common`; rebuild them with `pnpm build:common` after edits so downstream apps pick up changes. Automated API/persistence suites reside in `tests/src`, while deployment and infra files (`supabase/`, `vercel.json`, `docs/`) live at the repo root for quick reference.

## Build, Test, and Development Commands
`pnpm install` hydrates the workspace (Node >=22.18). `pnpm dev` runs every app after compiling `@porteiroapp/common`; scope via `pnpm dev:web`, `dev:mobile`, or `dev:api`. Use `pnpm build` for a full compile or targeted `build:*` scripts for single surfaces. Quality gates: `pnpm lint`, `pnpm typecheck`, `pnpm test` (delegates to `@porteiroapp/tests`). When tooling misbehaves, run `pnpm clean && pnpm install`.

## Continuous Native Generation (CNG)
The Expo app (`apps/expo`) uses **Continuous Native Generation** via Expo Prebuild. Instead of manually maintaining `android/` and `ios/` directories long-term, these native projects are generated on-demand from the app config (`app.json`) and config plugins, then compiled. This simplifies upgrades, reduces orphaned code, and automates cross-platform configuration (icons, splash screens, permissions, etc.).

### Prebuild Commands
- `npx expo prebuild` — generates `android/` and `ios/` directories from `app.json` and config plugins.
- `npx expo prebuild --clean` — deletes existing native directories before regenerating (recommended for clean state).
- `npx expo prebuild --platform ios` or `--platform android` — generates only one platform.
- `npx expo run:ios` / `npx expo run:android` — builds and runs locally; triggers prebuild automatically if native dirs are missing.

### EAS Build Integration
When building with EAS (`eas build`), if `android/` and `ios/` are absent or listed in `.gitignore`/`.easignore`, EAS runs Prebuild automatically to generate fresh native projects before compilation. This is the default for projects created with `create-expo-app`. To force regeneration even when native dirs exist locally, add them to `.gitignore`:
```
/android
/ios
```

### Config Plugins
Native modifications (permissions, entitlements, build settings, native dependencies) should be handled via **config plugins** rather than direct edits to native files. Plugins are defined in `app.json` under the `plugins` array or as custom plugins in `apps/expo/plugins/`. Examples in this repo include `withAndroidFullScreenIntent.js`, `withCallKeepConnectionService.js`, and VoIP/CallKit handlers. When installing a library that requires native setup, check if it provides a config plugin or look for community plugins at [expo/config-plugins](https://github.com/expo/config-plugins).

### When to Use Prebuild
- **Upgrading Expo SDK**: Bump versions in `package.json`, then run `npx expo prebuild --clean` to regenerate native projects with the new template.
- **Adding native dependencies**: Install the package, add its config plugin to `app.json`, and run prebuild.
- **Debugging native code**: Run `npx expo prebuild` to generate native projects, then open in Android Studio or Xcode for inspection.
- **After modifying `app.json` or config plugins**: Re-run `npx expo prebuild --clean` to apply changes.

### Best Practices
- Keep `android/` and `ios/` in `.gitignore` to ensure EAS always generates fresh native code.
- Never manually edit generated native files—use config plugins instead; manual changes will be lost on next prebuild.
- Test config plugin changes locally with `npx expo prebuild --clean && npx expo run:ios` before pushing.
- If a library lacks a config plugin, create a local plugin in `apps/expo/plugins/` or open an issue/PR with the library maintainer.

## Coding Style & Naming Conventions
Projects are TypeScript-first with ESM imports and two-space indentation (see `apps/interfone-api/src`). API routes/services keep kebab-case filenames such as `call.routes.ts`, while React components in `apps/nextjs/src/components` and `apps/expo/app` stay PascalCase. Run `pnpm lint` to enforce the Next.js/Expo ESLint configs; `pnpm format` inside `apps/expo` applies ESLint+Prettier fixes. Prefer named exports, colocate hooks under `hooks/`, and keep Tailwind or StyleSheet definitions near their components.

## Testing Guidelines
`@porteiroapp/tests` relies on the Node `--test` runner plus Axios and expects the API on `http://localhost:3001` (`PORT=3001` in `apps/interfone-api/.env`). Use `pnpm test:unit`, `test:advanced`, `test:persistence`, or `test:all` for coverage tiers, and mirror the existing descriptive filenames inside `tests/src/**/*.test.ts` when adding suites. Reset staged data between tests and log request IDs to align with the API’s request tracing.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits (`feat:`, `refactor:`, `fix:`). Keep commits scope-limited, include updated docs/tests when behavior shifts, and describe validation steps in the body. Pull requests should outline context, mention any env or schema changes, attach screenshots or payloads for UI/API work, and request reviewers for the impacted surface (API, mobile, web, or shared package).

## Security & Environment Notes
Do not commit secrets. Start from each `.env.example` (`apps/interfone-api`, `apps/expo`, `apps/nextjs`) and supply Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) plus Agora (`AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`) values via your runtime. Keep `ALLOWED_ORIGINS` tight, rotate Agora tokens through `/api/tokens`, and use a dedicated Supabase project for development instead of reusing production credentials.

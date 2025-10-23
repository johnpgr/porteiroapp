# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PorteiroApp is a multi-tenant condominium management system with three main applications and a shared package library. The system handles resident registration, visitor management, video/audio calls via Agora SDK, and admin operations.

## Monorepo Structure

This is a **pnpm workspace monorepo** using Node 22+ with native TypeScript ESM support.

### Applications (`apps/`)

1. **interfone-api** - Express API server for intercom/call management
   - TypeScript with native Node 22 ESM (no bundler)
   - Handles Agora voice calls, token generation, call history
   - Direct PostgreSQL connections via Supabase
   - Runs on port 3000 (default) or 3001

2. **expo** (porteiro-mobile) - React Native mobile app
   - Expo Router for file-based routing
   - Four user roles with separate layouts: `admin/`, `morador/`, `porteiro/`, `visitante/`
   - Uses Agora React Native SDK for voice/video calls
   - React 19 + React Native 0.81.4

3. **nextjs** (porteiro-site) - Next.js 15 web application
   - App Router with Turbopack for dev
   - Admin dashboard, resident registration, login flows
   - Tailwind CSS v4 + React 19

### Packages (`packages/`)

1. **common** - Shared code across all apps
   - Supabase client with platform-aware configuration
   - Unified client works across Node, React Native, and browser
   - Shared TypeScript types (database schema)
   - React hooks (e.g., `usePendingNotificationsCore`, `useLembretes`)
   - Must be built before use: `pnpm build:common`

### Tests (`tests/`)

- Automated API tests for validation
- Three test suites: basic, advanced, and database persistence
- Tests are in JavaScript (not TypeScript)

## Development Commands

### Setup & Installation
```bash
pnpm install                    # Install all dependencies
pnpm clean:install             # Clean reinstall
```

### Development (all apps in parallel)
```bash
pnpm dev                       # Run all apps in parallel
pnpm dev:mobile                # Expo mobile app only
pnpm dev:web                   # Next.js web app only
pnpm dev:api                   # Interfone API only
```

### Building
```bash
pnpm build                     # Build all apps and packages
pnpm build:common              # Build common package (required before building apps)
pnpm build:mobile              # Build mobile app
pnpm build:web                 # Build web app
pnpm build:api                 # Build API (TypeScript compilation)
```

### Testing
```bash
pnpm test                      # Run all tests
pnpm test:unit                 # Unit tests only
pnpm test:advanced             # Advanced API tests
pnpm test:persistence          # Database persistence tests
```

### Code Quality
```bash
pnpm lint                      # Lint all packages
pnpm lint:mobile               # Lint mobile app only
pnpm lint:web                  # Lint web app only
pnpm format                    # Format mobile app code
pnpm typecheck                 # TypeCheck all TypeScript packages
```

### Production
```bash
pnpm start:web                 # Start Next.js production server
pnpm start:api                 # Start API production server
```

## Architecture Patterns

### Shared Package System

The `@porteiroapp/common` package provides cross-platform Supabase integration:

- **Platform Detection**: Automatically detects Node.js, React Native, or browser
- **Unified Client**: `UnifiedSupabaseClient` works consistently across all platforms
- **Configuration Manager**: `PlatformConfigManager` applies platform-specific settings
- **Auth Logger**: Platform-aware logging for authentication flows

When making changes to common package:
1. Edit source in `packages/common/`
2. Run `pnpm build:common` to compile TypeScript
3. Changes are automatically available to apps via workspace protocol

### API Architecture (interfone-api)

The API uses a clean Express architecture:
- **Controllers** (`src/controllers/`) - Request handling and response logic
- **Routes** (`src/routes/`) - Route definitions and middleware
- **Services** (`src/services/`) - Business logic and database operations
- **Native ESM** - Uses `.ts` extensions in imports, Node 22 native TypeScript

Key features:
- Agora token generation for RTC calls
- Call management (start, answer, decline, end)
- Call history and active call tracking
- Health checks at `/` and `/api/status`

### Mobile App Structure (expo)

File-based routing with Expo Router:
- `app/_layout.tsx` - Root layout
- `app/admin/` - Admin role screens and `_layout.tsx`
- `app/morador/` - Resident role screens and `_layout.tsx`
- `app/porteiro/` - Doorman role screens and `_layout.tsx`
- `app/visitante/` - Visitor role screens and `_layout.tsx`

Each role has its own layout file that defines navigation structure.

### Web App Structure (nextjs)

Next.js App Router structure:
- `src/app/` - App router pages and layouts
- `src/app/api/` - API routes (server-side endpoints)
- `src/components/` - React components
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility libraries and configurations
- `src/middleware.ts` - Next.js middleware for auth/routing

## Environment Configuration

### interfone-api (.env)
Required variables:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` - For voice calls
- `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` - WhatsApp integration (optional)
- `JWT_SECRET` - For token signing
- `PORT` - Server port (default: 3000)

### expo (.env)
Required variables (all prefixed with `EXPO_PUBLIC_` for client access):
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`
- `API_BASE_URL` - Points to interfone-api

### nextjs (.env.local)
Standard Next.js environment variables for Supabase and API endpoints.

## Key Technical Decisions

### TypeScript Configuration
- All apps use TypeScript 5.9+
- Common package exports `.d.ts` types for type safety across workspace
- Native Node 22 ESM in API (no bundler needed)

### Package Manager
- **pnpm 9.15+** is required (enforced via `packageManager` field)
- Workspace protocol (`workspace:*`) for internal dependencies
- Catalog feature for shared dependency versions across packages

### Supabase Integration
The common package centralizes all Supabase logic to ensure consistent behavior:
- Platform-specific storage adapters (AsyncStorage for RN, localStorage for web)
- Session persistence configuration per platform
- Automatic auth state management
- Type-safe database queries using generated types

### Monorepo Dependencies
When a package depends on `@porteiroapp/common`, it references the built output in `packages/common/dist/`. Always rebuild common after changes.

## Important Notes

- **Node Version**: Node 22.18.0+ is required for native TypeScript ESM support
- **API Port**: interfone-api runs on port 3001 in development (tests expect this)
- **Build Order**: Build `common` package before building apps that depend on it
- **Parallel Dev**: The root `pnpm dev` runs all apps simultaneously with `--parallel` flag
- **File Extensions**: API uses `.ts` extensions in imports (ESM requirement)
- **React Version**: All apps use React 19 (via pnpm catalog)

## Testing Notes

Tests are located in `tests/` directory and validate the `/api/register-resident` endpoint and other API functionality. Before running tests:
1. Ensure API is running: `pnpm dev:api`
2. API should be accessible at `http://localhost:3001`
3. Run from root: `pnpm test` or navigate to `tests/` and run specific test files

Tests validate:
- Registration with valid/invalid data
- Database persistence
- Concurrent request handling
- Response structure and field validation

# PorteiroApp Monorepo

A modern, multi-tenant condominium management system built with a monorepo architecture. PorteiroApp enables efficient building access management, visitor registration, delivery tracking, and resident communications through mobile, web, and API applications.

## 🏗️ Project Overview

PorteiroApp is a comprehensive platform designed for residential buildings and condominiums with:

- **4 distinct user roles**: Admin, Porteiro (Doorman), Morador (Resident), Visitante (Visitor)
- **Separate authentication flows** for each role with dedicated dashboards
- **Multi-tenant architecture** with building-level data isolation
- **Real-time communication** for visitor authorization and delivery tracking
- **Monorepo structure** for code sharing across mobile, web, and API

## 🛠️ Technology Stack

### Core Technologies
- **Frontend**: Expo 54, React Native 0.81.4, React 19
- **Web**: Next.js 15.5, React 19, Tailwind CSS 4
- **Backend**: Express.js, Node.js
- **Database**: Supabase (PostgreSQL, Auth, Storage)
- **Package Manager**: pnpm 9.15+
- **Language**: TypeScript (strict mode)
- **Routing**: Expo Router 5.1.4 (mobile), Next.js file-based (web)

### Key Dependencies
- `@supabase/supabase-js` - Database and authentication
- `react` & `react-dom` - UI framework
- `zod` - Schema validation
- `date-fns` - Date manipulation
- `axios` - HTTP client
- `lucide-react` - Icon library

## 📁 Repository Structure

```
porteiroapp/
├── apps/                              # Production applications
│   ├── expo/                          # @porteiroapp/porteiro-mobile
│   │   ├── app/                       # Expo Router file-based routing
│   │   ├── components/                # React Native components
│   │   ├── hooks/                     # Custom React hooks
│   │   ├── services/                  # Business logic services
│   │   ├── utils/                     # Utilities
│   │   └── package.json
│   │
│   ├── nextjs/                        # @porteiroapp/porteiro-site
│   │   ├── src/
│   │   │   ├── app/                   # Next.js app directory routes
│   │   │   ├── components/            # React components
│   │   │   ├── hooks/                 # Custom hooks
│   │   │   └── lib/                   # Utilities and services
│   │   └── package.json
│   │
│   └── api/                           # @porteiroapp/notification-api
│       ├── src/
│       │   ├── routes/                # Express route handlers
│       │   ├── services/              # Business logic
│       │   ├── validators/            # Input validation
│       │   └── utils/                 # Helper functions
│       └── package.json
│
├── packages/                          # Shared packages
│   └── supabase/                      # @porteiroapp/supabase
│       ├── src/
│       │   ├── client.ts              # Supabase client factories
│       │   ├── index.ts               # Package exports
│       │   └── types.ts               # Database TypeScript types
│       ├── functions/                 # Supabase Edge Functions
│       ├── migrations/                # Database migrations
│       └── package.json
│
├── tests/                             # Test suite
│   ├── test-*.js                      # Test files
│   └── package.json
│
├── package.json                       # Root monorepo configuration
├── pnpm-workspace.yaml                # pnpm workspace definition & catalog
├── tsconfig.json                      # Root TypeScript configuration
└── CLAUDE.md                          # Development guidelines
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 9.15.0

### Install pnpm

```bash
# Enable corepack (comes with Node.js 16.9+)
corepack enable

# Install and activate pnpm
corepack prepare pnpm@9.15.4 --activate
```

### Initial Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd porteiroapp

# 2. Clean existing node_modules (if upgrading)
pnpm clean

# 3. Install dependencies
pnpm install

# 4. Verify installation
pnpm ls --depth 0
```

## 💻 Development

### Running All Applications

```bash
# Start all apps in parallel (mobile, web, api)
pnpm dev
```

This command:
- Starts the Expo dev server for the mobile app
- Runs Next.js dev server for the web app
- Starts the Express API server

### Running Individual Applications

```bash
# Mobile app (Expo)
pnpm dev:mobile
# Browse to http://localhost:8081 or scan QR code with Expo Go

# Web app (Next.js)
pnpm dev:web
# Open http://localhost:3000

# API (Express)
pnpm dev:api
# API runs on configured port (default 3001)
```

### Building for Production

```bash
# Build all applications
pnpm build

# Build specific application
pnpm build:web
pnpm build:api

# Build mobile app
pnpm build:mobile
```

### Running Production Servers

```bash
# Start Next.js production server
pnpm start:web

# Start Express API production server
pnpm start:api
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit                # Basic unit tests
pnpm test:advanced            # Advanced test scenarios
pnpm test:persistence         # Database persistence tests
```

## 📦 Managing Dependencies

### Add Dependency to Specific App

```bash
# Add to mobile app (using catalog version if available)
pnpm --filter @porteiroapp/porteiro-mobile add zod

# Add to web app with specific version
pnpm --filter @porteiroapp/porteiro-site add lodash@^4.17.21

# Add to API
pnpm --filter @porteiroapp/notification-api add express-cors
```

### Add Dependency to Shared Package

```bash
# Add to shared database package
pnpm --filter @porteiroapp/supabase add some-package
```

### Update Catalog Versions

Edit `pnpm-workspace.yaml` catalog section, then:

```bash
pnpm install
```

## 🔧 Code Quality

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific app
pnpm lint:mobile
pnpm lint:web
```

### Format Code

```bash
# Auto-fix ESLint issues and format code (mobile app)
pnpm format
```

### Type Checking

```bash
# Check TypeScript types across all packages
pnpm type-check

# Check specific package
pnpm --filter @porteiroapp/supabase type-check
```

## 🏛️ Architecture

### Multi-Role System

PorteiroApp implements 4 distinct user roles with completely separate workflows:

#### 1. **Admin** (`admin_profiles` table)
- **Access**: `/admin/login` → `/admin/*`
- **Features**: Building management, user administration, communications, activity logs
- **Scope**: Can manage multiple buildings via `building_admins` junction table

#### 2. **Porteiro/Doorman** (`profiles` table, `user_type='porteiro'`)
- **Access**: `/porteiro/login` → `/porteiro/*`
- **Features**: Visitor check-in, delivery reception, vehicle registration
- **Scope**: Building-level operations, tied to single building

#### 3. **Morador/Resident** (`profiles` table, `user_type='morador'`)
- **Access**: `/morador/login` → `/morador/*`
- **Features**: Visitor authorization, notifications, profile management
- **Scope**: Apartment-level access via `apartment_residents` junction table

#### 4. **Visitante/Visitor** (no login required initially)
- **Access**: `/visitante/*`
- **Features**: Emergency contact, self-registration, status checking

### Dual Profile System

Admin users are completely separate from regular users:

- **`profiles` table**: Porteiros and Moradores
  - Fields: `user_id`, `name`, `email`, `phone`, `user_type`, `building_id`

- **`admin_profiles` table**: Administrators only
  - Fields: `user_id`, `name`, `email`, `phone`, `role`, `is_active`
  - Linked to buildings via `building_admins` junction table

### Multi-Tenancy

**Building-scoped data isolation**:

```typescript
// Porteiro query example
.eq('building_id', user.building_id)

// Morador query example (via apartments)
const apartments = await getResidentApartments(userId);
.in('apartment_id', apartments.map(a => a.id))
```

Each building is an independent data unit with its own visitors, deliveries, residents, and communications.

### Database Schema

**Key tables**:
- `buildings` - Condominium buildings
- `apartments` - Individual units within buildings
- `apartment_residents` - Many-to-many: resident ↔ apartment
- `profiles` - Porteiro and Morador user profiles
- `admin_profiles` - Administrator profiles
- `building_admins` - Many-to-many: admin ↔ building
- `visitors` - Visitor records and authorizations
- `visitor_logs` - Entry/exit tracking (tipo_log: 'IN'/'OUT')
- `deliveries` - Package reception and tracking
- `vehicles` - Resident vehicle records
- `communications` - Building announcements

**RLS Policies**:
- Enabled on all tables for security
- Access control primarily handled at application layer via `user_type` checks
- Some policies disabled in development migrations

## 📚 Shared Packages

### `@porteiroapp/supabase` - Shared Database Package

Located in `packages/supabase/`, this package provides:

**Client Factories**:
- `createBrowserClient(url, anonKey, storage?)` - Client-side usage
- `createServerClient(url, serviceKey)` - Server-side usage
- `createSupabaseClient(config)` - Custom configuration

**Type Exports**:
- `Database` - Complete database schema type
- `TypedSupabaseClient` - Typed Supabase client
- All table types (Row, Insert, Update)

**Usage Examples**:

```typescript
// Mobile App (React Native)
import { createBrowserClient } from '@porteiroapp/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabase = createBrowserClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  AsyncStorage
);
```

```typescript
// Web App (Next.js)
import { createBrowserClient } from '@porteiroapp/supabase';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

```typescript
// API (Express)
import { createServerClient } from '@porteiroapp/supabase';

const supabase = createServerClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

See `packages/supabase/README.md` for detailed documentation.

## 🔗 Workspace Commands

### List All Packages

```bash
# Show all workspace packages and versions
pnpm ls --depth 0
```

### Run Commands in Specific Package

```bash
# Run type-check in database package
pnpm --filter @porteiroapp/supabase type-check

# Run build in mobile app
pnpm --filter @porteiroapp/porteiro-mobile build
```

### Run Commands in All Packages

```bash
# Build all packages
pnpm --recursive build

# Run scripts in all apps in parallel
pnpm --parallel --filter "./apps/**" dev
```

## 🐛 Troubleshooting

### "Cannot find module '@porteiroapp/supabase'"

```bash
# Rebuild packages and reinstall dependencies
pnpm install
pnpm type-check
```

### Expo Metro bundler cache issues

```bash
cd apps/expo
pnpm start --clear
```

### Next.js build errors

```bash
cd apps/nextjs
rm -rf .next
pnpm build
```

### pnpm install fails or dependency conflicts

```bash
# Complete clean reinstall
pnpm clean
pnpm install --force
```

### Port already in use

Each app uses different ports:
- Mobile: `8081` (Expo)
- Web: `3000` (Next.js)
- API: `3001` (Express, configurable)

If ports conflict, check for running processes:

```bash
# Find process on port
lsof -i :3000
kill -9 <PID>
```

### TypeScript errors in monorepo

```bash
# Force TypeScript rebuild
pnpm type-check --force
```

## 📝 Common Development Patterns

### Data Fetching Pattern

Standard pattern used throughout the application:

```typescript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  fetchData();
}, [dependencies]);

const fetchData = async () => {
  try {
    setLoading(true);
    const { data, error } = await supabase
      .from('table')
      .select('columns')
      .eq('filter', value);

    if (error) throw error;
    setData(data);
  } catch (err) {
    setError(err.message);
    console.error('🔥 Error:', err);
  } finally {
    setLoading(false);
  }
};
```

### Supabase Query Patterns

```typescript
// Simple SELECT
const { data } = await supabase
  .from('table')
  .select('*')
  .eq('column', value)
  .single();

// JOIN query
const { data } = await supabase
  .from('visitor_logs')
  .select(`
    id, log_time, tipo_log,
    visitors!inner(id, name, document),
    apartments!inner(number, building_id)
  `)
  .eq('status', 'approved');

// Building-scoped query
.eq('building_id', user.building_id)

// Apartment-scoped query
const apartments = await getResidentApartments(userId);
.in('apartment_id', apartments.map(a => a.id))
```

## 📖 Documentation

- **Development Guidelines**: See `CLAUDE.md` for project-specific guidelines
- **Monorepo Setup**: See `MONOREPO_SETUP_SUMMARY.md` for detailed setup info
- **Database Package**: See `packages/supabase/README.md` for shared types
- **Quick Start**: See `QUICK_START.md` for quick reference
- **Restructure Plan**: See `MONOREPO_RESTRUCTURE_PLAN.md` for ongoing migration

## 🔐 Security

### Environment Variables

Required environment variables in `.env`:

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# WhatsApp/SMS
TWILIO_ACCOUNT_SID=xxxxx
TWILIO_AUTH_TOKEN=xxxxx
```

### Best Practices

- **Never commit `.env`** files (already in `.gitignore`)
- RLS policies are permissive - rely on application-layer auth checks
- All mutations check `user_type` before allowing operations
- Use `ProtectedRoute` wrapper for all authenticated screens
- Always validate user permissions before sensitive operations

## 🔄 Visitor Lifecycle Example

Demonstrates multi-role interaction:

1. **Morador** authorizes visitor → `INSERT INTO visitors`
2. **Porteiro** sees in "Autorizacoes" tab → `SELECT FROM visitors WHERE status='authorized'`
3. Porteiro confirms arrival → `INSERT INTO visitor_logs (tipo_log='IN')`
4. Porteiro logs exit → `INSERT INTO visitor_logs (tipo_log='OUT')`
5. **Morador** views history → `SELECT FROM visitor_logs` (filtered by apartment)

## 🎨 Code Style

- **Language**: Portuguese for domain language (morador, porteiro, visitante)
- **TypeScript**: Strict mode enabled
- **Formatting**: Run `pnpm format` before commits
- **Naming**: `camelCase` for variables/functions, `PascalCase` for components
- **Components**: Functional components with hooks only (no classes)
- **Path Aliases**: Use `~/*` for root-relative imports

## 📚 Key Principles

### KISS (Keep It Simple, Stupid)
Maintain code simplicity and avoid unnecessary complexity.

### DRY (Don't Repeat Yourself)
Extract repeated code into functions, components, or modules.

### Clean Code
Use clear names, single responsibility per function, and consistent formatting.

### SOLID Principles
- **S**ingle Responsibility
- **O**pen/Closed
- **L**iskov Substitution
- **I**nterface Segregation
- **D**ependency Inversion

### SOC (Separation of Concerns)
Separate frontend, backend, and database logic into distinct layers.

## 📦 Database Migrations

- Located in `packages/supabase/migrations/`
- 70+ migration files managing schema evolution
- Apply via Supabase Dashboard or CLI
- Test migrations included for debugging

## 🤝 Contributing

1. Create a new branch from `develop`
2. Make your changes following the code style guidelines
3. Run `pnpm format` and `pnpm lint` before committing
4. Run tests: `pnpm test`
5. Submit a pull request with a clear description

## 📄 License

[Add your license information here]

## 📞 Support

For issues, questions, or feedback:
- Check existing documentation in the repo
- Open an issue in the repository

## 🗺️ Project Status

- ✅ Monorepo infrastructure complete
- ✅ Shared database package created
- ✅ Development environment configured
- 🚧 Migration to shared packages in progress
- 🗂️ Future: Platform-specific adapter packages

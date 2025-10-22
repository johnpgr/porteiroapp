# CLAUDE.md

This file provides guidance to Claude Code and developers when working with the PorteiroApp monorepo.

## 🎯 Project Overview

**PorteiroApp** is a modern, multi-tenant condominium management system built with a **monorepo architecture**. The application supports **4 distinct user roles** (Admin, Porteiro/Doorman, Morador/Resident, Visitante/Visitor) with separate authentication flows and feature sets for managing building access, visitor registration, deliveries, and communications.

### Key Objectives
- Enable efficient residential building management
- Support multiple concurrent buildings (multi-tenant)
- Provide role-specific interfaces and workflows
- Maintain data isolation between buildings
- Streamline code sharing across mobile, web, and API

## 🏗️ Technology Stack

### Frontend Applications
- **Mobile App** (`apps/expo/`): Expo 54 + React Native 0.81.4 + React 19
- **Web App** (`apps/nextjs/`): Next.js 15.5 + React 19 + Tailwind CSS 4

### Backend
- **Notification API** (`apps/api/`): Express.js + Node.js
- **Database**: Supabase (PostgreSQL, Auth, Storage)

### Shared
- **Supabase Package** (`packages/supabase/`): Centralized client and types
- **Package Manager**: pnpm 9.15+
- **Language**: TypeScript (strict mode)
- **Routing**: Expo Router 5.1.4 (mobile), Next.js file-based (web)

### Key Dependencies
- `@supabase/supabase-js` - Database and authentication
- `react` & `react-dom` - UI framework
- `zod` - Schema validation (API)
- `date-fns` - Date manipulation
- `axios` - HTTP client
- `lucide-react` - Icon library (web)

## 📁 Monorepo Structure

```
porteiroapp/
├── apps/                                    # Production applications
│   ├── expo/                                # @porteiroapp/porteiro-mobile
│   │   ├── app/                             # Expo Router file-based routing
│   │   │   ├── _layout.tsx                  # Root layout with AuthProvider
│   │   │   ├── index.tsx                    # Home/role selector
│   │   │   ├── admin/                       # Admin role routes
│   │   │   ├── porteiro/                    # Doorman role routes
│   │   │   ├── morador/                     # Resident role routes
│   │   │   └── visitante/                   # Visitor role routes
│   │   ├── components/                      # React Native components
│   │   │   ├── ProtectedRoute.tsx           # Authorization wrapper
│   │   │   ├── AuthForm.tsx                 # Reusable login form
│   │   │   ├── porteiro/                    # Role-specific components
│   │   │   └── ...
│   │   ├── hooks/                           # Custom React hooks
│   │   │   ├── useAuth.tsx                  # AuthProvider context
│   │   │   ├── useAvisosNotifications.ts
│   │   │   └── ...
│   │   ├── services/                        # Business logic services
│   │   ├── utils/                           # Utilities
│   │   ├── assets/                          # Images, audio, icons
│   │   └── package.json
│   │
│   ├── nextjs/                              # @porteiroapp/porteiro-site
│   │   ├── src/
│   │   │   ├── app/                         # Next.js app directory
│   │   │   ├── components/                  # React components
│   │   │   ├── hooks/                       # Custom hooks
│   │   │   ├── lib/                         # Utilities and services
│   │   │   └── middleware.ts
│   │   └── package.json
│   │
│   └── api/                                 # @porteiroapp/notification-api
│       ├── src/
│       │   ├── index.js                     # Express app entry
│       │   ├── routes/                      # Express route handlers
│       │   ├── services/                    # Business logic
│       │   ├── validators/                  # Input validation (zod)
│       │   └── utils/                       # Helper functions
│       └── package.json
│
├── packages/                                # Shared packages
│   └── supabase/                            # @porteiroapp/supabase
│       ├── src/
│       │   ├── client.ts                    # Supabase client factories
│       │   ├── index.ts                     # Package exports
│       │   └── types.ts                     # Database TypeScript types
│       ├── functions/                       # Supabase Edge Functions
│       ├── migrations/                      # 70+ database migrations
│       └── package.json
│
├── tests/                                   # Test suite
│   └── package.json
│
├── package.json                             # Root monorepo config
├── pnpm-workspace.yaml                      # Workspace + catalog
├── tsconfig.json                            # Root TypeScript config
├── README.md                                # Main project documentation
├── CLAUDE.md                                # This file
├── QUICK_START.md                           # Quick reference guide
└── MONOREPO_SETUP_SUMMARY.md               # Detailed setup info
```

## 👥 Multi-Role System

PorteiroApp implements **4 distinct user roles** with completely separate workflows and authentication flows:

### 1. **Admin** (`admin_profiles` table)

**Access Path**: `/admin/login` → `/admin/*`

**Features**:
- Building management and configuration
- User administration (create/manage Porteiros and Moradores)
- Communications (building-wide announcements)
- Activity logs and audit trails
- Admin dashboard with metrics

**Data Scope**:
- Can manage multiple buildings via `building_admins` junction table
- View all buildings assigned to them
- Full access to building data within assigned buildings

**Authentication**:
- Separate from regular users (`admin_profiles` table)
- Uses `adminAuth` utility for special retry logic
- Automatic retry with exponential backoff (up to 3 times)
- 15-20s timeout handling with network checks

### 2. **Porteiro/Doorman** (`profiles` table, `user_type='porteiro'`)

**Access Path**: `/porteiro/login` → `/porteiro/*`

**Features**:
- Visitor check-in and authorization confirmation
- Delivery reception and tracking
- Vehicle registration for residents
- Building-scoped operations dashboard
- Access logs and history

**Main Screen**: `app/porteiro/index.tsx` (5 tabs interface)
- Autorizacoes (Visitor Authorizations)
- Visitantes (Registered Visitors)
- Entregas (Deliveries)
- Veiculos (Vehicles)
- Perfil (Profile)

**Data Scope**:
- Tied to single building via `building_id`
- Query pattern: `.eq('building_id', user.building_id)`
- Only sees data for their assigned building

### 3. **Morador/Resident** (`profiles` table, `user_type='morador'`)

**Access Path**: `/morador/login` → `/morador/*`

**Features**:
- Authorize visitors to their apartment
- Manage visitor history and status
- Multi-step registration flow
- Apartment and personal profile management
- Notifications and communications
- Vehicle management

**Multi-Step Flows**:
- **Registration**: `cadastro/novo.tsx` → `relacionamento.tsx` → `telefone.tsx` → etc.
- **Visitor Authorization**: `visitantes/nome.tsx` → `cpf.tsx` → `foto.tsx` → etc.

**Data Scope**:
- Linked to apartments via `apartment_residents` junction table (many-to-many)
- Query pattern:
  ```typescript
  const apartments = await getResidentApartments(userId);
  .in('apartment_id', apartments.map(a => a.id))
  ```
- Can manage multiple apartments

### 4. **Visitante/Visitor** (no login required initially)

**Access Path**: `/visitante/*`

**Features**:
- Self-registration
- Status checking
- Emergency contact
- Completion of registration via token link

**Data Scope**:
- No initial authentication required
- Token-based access for registration completion
- Limited data access

## 🔐 Dual Profile System

**Critical architectural decision**: Admin users are completely separate from regular users.

### `profiles` Table (Porteiros & Moradores)
```
Fields:
- user_id (FK to auth.users)
- name (string)
- email (string)
- phone (string)
- user_type (enum: 'porteiro', 'morador')
- building_id (FK to buildings)
- cpf (string)
- created_at (timestamp)
- updated_at (timestamp)
```

### `admin_profiles` Table (Administrators)
```
Fields:
- user_id (FK to auth.users)
- name (string)
- email (string)
- phone (string)
- role (string)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### `building_admins` Junction Table
```
Fields:
- id (UUID, primary key)
- admin_profile_id (FK to admin_profiles)
- building_id (FK to buildings)
- created_at (timestamp)
```

## 🏢 Multi-Tenancy Architecture

**Building-scoped data isolation** is enforced at the application layer:

### Porteiro (Doorman) Queries
```typescript
// All Porteiro queries filter by their building
.eq('building_id', user.building_id)
```

### Morador (Resident) Queries
```typescript
// First get user's apartments
const { data: apartments } = await supabase
  .from('apartment_residents')
  .select('apartment_id')
  .eq('profile_id', user.id);

// Then query with apartment IDs
.in('apartment_id', apartmentIds)
```

### Admin Queries
```typescript
// Get buildings assigned to admin
const { data: buildings } = await supabase
  .from('building_admins')
  .select('building_id')
  .eq('admin_profile_id', adminId);

// Query data within assigned buildings
.in('building_id', buildingIds)
```

Each building is an independent data unit:
- Separate visitors
- Separate deliveries
- Separate residents
- Separate communications
- No cross-building data visibility

## 🔑 Development Commands

### Starting the App

```bash
# Start all apps in parallel
pnpm dev

# Start individual apps
pnpm dev:mobile          # Expo on port 8081
pnpm dev:web             # Next.js on port 3000
pnpm dev:api             # Express on port 3001
```

### Code Quality

```bash
pnpm lint                # Lint all packages
pnpm lint:mobile         # Lint mobile app
pnpm lint:web            # Lint website
pnpm format              # Format mobile app code (prettier + eslint fix)
pnpm type-check          # TypeScript check all packages
```

### Database

```bash
# Database migrations are in packages/supabase/migrations/
# Apply via Supabase Dashboard or CLI
# No local database commands needed (cloud-hosted Supabase)
```

### Building & Testing

```bash
pnpm build               # Build all apps
pnpm build:web           # Build Next.js
pnpm build:api           # Build API
pnpm test                # Run all tests
pnpm clean               # Clean node_modules and build artifacts
pnpm clean:install       # Clean and reinstall everything
```

## 🗂️ Common Development Patterns

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
    console.error('🔥 Error:', err.message);
    Alert.alert('Error', 'User-friendly message');
  } finally {
    setLoading(false);
  }
};
```

### Supabase Query Patterns

**Simple SELECT**:
```typescript
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('column', value)
  .single();
```

**JOIN queries** (use `!inner` for required joins):
```typescript
const { data } = await supabase
  .from('visitor_logs')
  .select(`
    id, log_time, tipo_log,
    visitors!inner(id, name, document),
    apartments!inner(number, building_id)
  `)
  .eq('status', 'approved');
```

**Building-scoped queries** (Porteiro):
```typescript
.eq('building_id', user.building_id)
```

**Apartment-scoped queries** (Morador):
```typescript
// First get user's apartments
const { data: apartments } = await supabase
  .from('apartment_residents')
  .select('apartment_id')
  .eq('profile_id', user.id);

// Then query with apartment IDs
.in('apartment_id', apartmentIds)
```

### Admin Auth Service

Use `adminAuth` object from apps with special retry logic:

```typescript
// Admin operations have automatic retry and timeout handling
await adminAuth.signIn(email, password);
await adminAuth.getCurrentAdmin();
await adminAuth.getAdminBuildings(adminProfileId);
await adminAuth.createAdminProfile(userData);
await adminAuth.assignAdminToBuilding(adminId, buildingId);
```

**Features**:
- Automatic retry with exponential backoff (up to 3 times)
- 15-20s timeout handling
- Network connectivity checks on iOS
- Detailed error logging

### Multi-Step Forms

For complex registration flows (e.g., morador cadastro, visitor authorization):

1. Each step is a separate route: `cadastro/novo.tsx`, `cadastro/relacionamento.tsx`, etc.
2. State managed in parent `_layout.tsx`
3. Navigate between steps: `router.push('/morador/cadastro/relacionamento')`
4. **Benefits**: Browser back button works naturally, easier to test individual steps

### Modal Management

```typescript
const [modalVisible, setModalVisible] = useState(false);

<Modal
  visible={modalVisible}
  onRequestClose={() => setModalVisible(false)}
  transparent
  animationType="slide"
>
  {/* Modal content */}
</Modal>
```

### Error Handling

Consistent pattern across app:

```typescript
if (error) {
  console.error('🔥 Context: ' + error.message);
  Alert.alert('Error Title', 'User-friendly message');
  return; // or throw
}
```

**Log prefixes** for clarity:
- `🔐` Authentication
- `🔍` Queries
- `✅` Success
- `❌` Errors
- `⏳` Timeouts
- `📱` Mobile/platform-specific
- `🌐` Network

## 🔗 Shared Packages

### Using `@porteiroapp/supabase`

All applications should import from the shared package:

```typescript
import {
  createBrowserClient,
  createServerClient,
  Database
} from '@porteiroapp/supabase';
```

**Types**:
```typescript
import type { Database } from '@porteiroapp/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];
```

**Client Creation**:

Mobile:
```typescript
import { createBrowserClient } from '@porteiroapp/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabase = createBrowserClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  AsyncStorage
);
```

Web:
```typescript
import { createBrowserClient } from '@porteiroapp/supabase';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

API:
```typescript
import { createServerClient } from '@porteiroapp/supabase';

const supabase = createServerClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

## 🧩 Code Architecture Principles

### 🎯 KISS (Keep It Simple, Stupid)

**Principle**: Maintain code simplicity and avoid unnecessary complexity.

**Bad Example**:
```typescript
function soma(a, b) {
  if (typeof a === "number" && typeof b === "number") {
    return a + b;
  } else {
    return parseInt(a) + parseInt(b);
  }
}
```

**Better (KISS)**:
```typescript
function soma(a, b) {
  return Number(a) + Number(b);
}
```

### 🔁 DRY (Don't Repeat Yourself)

**Principle**: Avoid repeating code. Extract into functions, components, or modules.

**Bad Example**:
```typescript
console.log("Erro: usuário não encontrado");
alert("Erro: usuário não encontrado");
```

**Better (DRY)**:
```typescript
function exibirErro(msg: string) {
  console.log(`Erro: ${msg}`);
  alert(`Erro: ${msg}`);
}
exibirErro("usuário não encontrado");
```

### 🧼 Clean Code

**Principles**:
- Use **clear and descriptive names**
- Functions should have **a single responsibility**
- Avoid **unnecessary comments**
- Maintain **consistent formatting and style**

**Bad Example**:
```typescript
function x(a: number, b: number) {
  return a * b + a * a;
}
```

**Better (Clean Code)**:
```typescript
function calcularAreaTotal(base: number, altura: number): number {
  return base * altura + base * base;
}
```

### ⚙️ SOLID Principles

**S — Single Responsibility**: Each module has one reason to change.
```typescript
// ❌ Bad: Multiple responsibilities
async function salvarUsuario(usuario: Usuario) {
  validarUsuario(usuario);
  salvarNoBanco(usuario);
  enviarEmailBoasVindas(usuario);
}

// ✅ Better: Separated concerns
async function salvarUsuario(usuario: Usuario) {
  validarUsuario(usuario);
  salvarNoBanco(usuario);
}

async function enviarBoasVindas(usuario: Usuario) {
  enviarEmailBoasVindas(usuario);
}
```

**O — Open/Closed**: Open for extension, closed for modification.
```typescript
// ✅ Use inheritance or composition
abstract class EnviadorDeNotificacao {
  abstract enviar(mensagem: string): void;
}

class EnviadorEmail extends EnviadorDeNotificacao {
  enviar(mensagem: string) { console.log("Email:", mensagem); }
}

class EnviadorSMS extends EnviadorDeNotificacao {
  enviar(mensagem: string) { console.log("SMS:", mensagem); }
}
```

**L — Liskov Substitution**: Subtypes must be substitutable for their base types.

**I — Interface Segregation**: Prefer small, specific interfaces.

**D — Dependency Inversion**: Depend on abstractions, not concrete implementations.

### 🚫 YAGNI (You Aren't Gonna Need It)

**Principle**: Don't add functionality you don't need yet.

**Bad Example**:
```typescript
// ❌ Adding multi-currency support before needed
function calcularPreco(produto: Produto, moeda: string = "BRL"): number {
  if (moeda === "USD") return produto.preco * 0.19;
  if (moeda === "EUR") return produto.preco * 0.17;
  return produto.preco;
}
```

**Better (YAGNI)**:
```typescript
// ✅ Simple, focused implementation
function calcularPreco(produto: Produto): number {
  return produto.preco;
}
```

### 🧱 SOC (Separation of Concerns)

**Principle**: Separate responsibilities into distinct layers/modules.

**Architecture Example**:
- **Frontend**: UI and UX
- **Backend**: Business logic
- **Database**: Data persistence

**Code Example**:
```typescript
// 🎯 Controller (handles requests)
async function criarUsuarioController(req: Request, res: Response) {
  const usuario = await criarUsuarioService(req.body);
  res.json(usuario);
}

// 🎯 Service (business logic)
async function criarUsuarioService(dados: UsuarioDados): Promise<Usuario> {
  validarDados(dados);
  return salvarUsuarioNoBanco(dados);
}

// 🎯 Repository (data access)
async function salvarUsuarioNoBanco(dados: UsuarioDados): Promise<Usuario> {
  return supabase.from('profiles').insert(dados).single();
}
```

### 🧭 Principle of Least Surprise

**Principle**: Code should do exactly what it appears to do.

**Bad Example**:
```typescript
// ❌ Name doesn't match behavior
function deletarUsuario(id: string): void {
  desativarUsuario(id);  // Actually deactivates, not deletes!
}
```

**Better**:
```typescript
// ✅ Name matches behavior
function desativarUsuario(id: string): void {
  desativarUsuarioNoBanco(id);
}
```

## ✅ Important Considerations

### TypeScript Path Aliases

Use `~/*` for imports from project root within each app:

```typescript
// apps/expo/
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';
import { Button } from '~/components/Button';

// apps/nextjs/
import { supabase } from '~/lib/supabase';
import { LoadingSpinner } from '~/components/LoadingSpinner';

// apps/api/
import { supabase } from '~/src/services/supabaseClient';
```

Configured in each app's `tsconfig.json` with `baseUrl` and `paths`.

### Platform-Specific Code

iOS has special timeout handling and network checks. Check platform via:

```typescript
import { Platform } from 'react-native';

if (Platform.OS === 'ios') {
  // iOS-specific logic (e.g., longer timeouts, network checks)
}
```

### Disabled Features

**Currently commented out/disabled**:
1. Push notifications (`notificationService.ts`)
2. Audio recording for emergencies (`audioService.ts` - web incompatibility)
3. Real-time Supabase subscriptions (`.on('*', ...)` listeners)
4. Emergency button backend (routes exist, incomplete)

### Environment Variables

**Required in `.env`** (never commit this file):

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# WhatsApp/SMS (optional)
TWILIO_ACCOUNT_SID=xxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=xxxxx
```

### Security Best Practices

- **Never commit `.env`** files (already in `.gitignore`)
- **RLS policies are permissive** - rely on application-layer auth checks
- **All mutations check `user_type`** before allowing operations
- **Use `ProtectedRoute`** wrapper for all authenticated screens
- **Validate permissions** before sensitive operations
- **Log authentication events** for audit trails
- **Rotate API keys** regularly

## 📊 Database Migrations

- Located in `packages/supabase/migrations/`
- **70+ migration files** managing schema evolution
- Apply via Supabase Dashboard or CLI
- Test migrations included for debugging (`check_*.sql`, `verify_*.sql`)

### Key Migrations

- **009_multiple_residents_per_apartment.sql** - Introduced `apartment_residents` junction table
- **001_rls_policies.sql** - Basic RLS setup
- **004_super_admin_system.sql** - Admin profile system

## 🔄 Visitor Lifecycle Example

Demonstrates multi-role interaction:

1. **Morador** authorizes visitor → `INSERT INTO visitors`
2. **Porteiro** sees in "Autorizacoes" tab → `SELECT FROM visitors WHERE status='authorized'`
3. Porteiro confirms arrival → `INSERT INTO visitor_logs (tipo_log='IN')`
4. Porteiro logs exit → `INSERT INTO visitor_logs (tipo_log='OUT')`
5. **Morador** views history → `SELECT FROM visitor_logs` (filtered by apartment)

## 🎨 Code Style Guide

- **Domain Language**: Portuguese for domain terms (morador, porteiro, visitante)
- **TypeScript**: Strict mode enabled in all packages
- **Formatting**: Run `pnpm format` before committing
- **Naming Conventions**:
  - `camelCase` for variables and functions
  - `PascalCase` for components and classes
  - `UPPER_SNAKE_CASE` for constants
  - `snake_case` for database columns
- **Components**: Functional components with hooks only (no classes)
- **Exports**: Use named exports for better tree-shaking

## 🐛 Debugging

### Extensive Logging

Throughout the codebase:
- Check browser console (web) or React Native debugger
- iOS-specific logs for network issues
- SQL test queries in migration folder for database debugging

### Common Issues

| Issue | Solution |
|-------|----------|
| RLS policy blocking queries | Check policies in Supabase Dashboard |
| Login fails | Verify user exists in correct table (`profiles` vs `admin_profiles`) |
| Building-scoped data not showing | Verify `building_id` matches user's building |
| Apartment data missing | Check `apartment_residents` junction table entries |
| Cannot find module '@porteiroapp/supabase' | Run `pnpm install && pnpm type-check` |
| Metro bundler cache issues | Run `pnpm start --clear` in mobile app |
| Next.js build errors | Run `rm -rf .next && pnpm build` in web app |

## 📝 Layout & Design

**IMPORTANT**: Do not change the layout or design of the current project unless explicitly requested and clearly indicated. Only modify CSS/styling if:
1. User specifically asks for design changes
2. User provides clear instructions for layout modifications
3. Fixing bugs or responsive issues

Otherwise, preserve all current visual design and structure.

## 🤝 Monorepo Guidelines

### Adding Dependencies

**To specific app**:
```bash
pnpm --filter @porteiroapp/porteiro-mobile add package-name
pnpm --filter @porteiroapp/porteiro-site add package-name
pnpm --filter @porteiroapp/notification-api add package-name
```

**To shared package**:
```bash
pnpm --filter @porteiroapp/supabase add package-name
```

**Using catalog versions** (when defined):
```bash
pnpm --filter @porteiroapp/porteiro-mobile add react@catalog:react19
```

### Running Commands Across Packages

```bash
# Run in all packages
pnpm --recursive build

# Run in all apps in parallel
pnpm --parallel --filter "./apps/**" dev

# Run in specific package
pnpm --filter @porteiroapp/supabase type-check
```

## 📚 Related Documentation

- **README.md** - Main project documentation and getting started
- **QUICK_START.md** - Quick reference guide for common commands
- **MONOREPO_SETUP_SUMMARY.md** - Detailed setup and configuration
- **packages/supabase/README.md** - Shared database package usage
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [pnpm Catalogs](https://pnpm.io/catalogs)

## 🚀 Development Workflow

### Starting a New Feature

1. Create a new branch from `develop`
2. Make changes in appropriate app or shared package
3. Ensure TypeScript compiles: `pnpm type-check`
4. Run linting: `pnpm lint`
5. Test locally before committing

### Committing Code

1. Run `pnpm format` to auto-fix code style
2. Run `pnpm lint` to check for issues
3. Commit with clear, descriptive messages
4. Include reasoning for architectural decisions

### Submitting Pull Requests

1. Provide clear description of changes
2. Link related issues
3. Verify all tests pass: `pnpm test`
4. Request review from team members
5. Address feedback and update PR

## 📞 Getting Help

When debugging issues, check:
1. Browser/console logs with emoji prefixes
2. Supabase Dashboard for RLS policy issues
3. Type errors via `pnpm type-check`
4. Related documentation files
5. Similar implementations in codebase

---

**Last Updated**: 2025-10-21
**Status**: ✅ Comprehensive guidelines for monorepo development
**Domain Language**: Portuguese (morador, porteiro, visitante, etc.)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PorteiroApp is a multi-tenant condominium management system built with Expo/React Native and Supabase. The application supports 4 distinct user roles (Admin, Porteiro/Doorman, Morador/Resident, Visitante/Visitor) with separate authentication flows and feature sets for managing building access, visitor registration, deliveries, and communications.

## Technology Stack

- **Frontend**: Expo 54 + React Native 0.79.5 + React 19
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Routing**: Expo Router 5.1.4 (file-based routing)
- **Language**: TypeScript (strict mode)
- **State Management**: React Context + local useState (no Redux/Zustand)

## Development Commands

### Starting the App
```bash
npm start                 # Start Expo dev server
npm run android          # Run on Android device/emulator
npm run ios             # Run on iOS device/simulator
npm run web             # Run in web browser
```

### Code Quality
```bash
npm run lint            # Run ESLint and Prettier checks
npm run format          # Auto-fix ESLint issues and format code
```

### Database
- Migrations are in `supabase/migrations/`
- Apply migrations via Supabase Dashboard or CLI
- No local database commands (cloud-hosted Supabase)

## Architecture

### Multi-Role System

The app implements **4 distinct user roles** with completely separate workflows:

1. **Admin** (`admin_profiles` table)
   - Access: `/admin/login` → `/admin/*`
   - Features: Building management, user management, communications, activity logs
   - Can manage multiple buildings via `building_admins` junction table
   - Authentication: `adminAuth` utility (separate from regular users)

2. **Porteiro/Doorman** (`profiles` table with `user_type='porteiro'`)
   - Access: `/porteiro/login` → `/porteiro/*`
   - Features: Visitor check-in, delivery reception, vehicle registration, building-scoped operations
   - Tied to single building via `building_id`
   - Main screen: `app/porteiro/index.tsx` (2580 lines with 5 tabs)

3. **Morador/Resident** (`profiles` table with `user_type='morador'`)
   - Access: `/morador/login` → `/morador/*`
   - Features: Visitor authorization, notifications, profile management
   - Linked to apartments via `apartment_residents` junction table (many-to-many)
   - Multi-step flows for registration and visitor authorization

4. **Visitante/Visitor** (no login required initially)
   - Access: `/visitante/*`
   - Features: Emergency contact, registration, status checking

### Dual Profile System

**Critical architectural decision**: Admin users are completely separate from regular users.

- **`profiles` table**: Porteiros and Moradores
  - Fields: `user_id`, `name`, `email`, `phone`, `user_type`, `building_id`, `cpf`

- **`admin_profiles` table**: Administrators only
  - Fields: `user_id`, `name`, `email`, `phone`, `role`, `is_active`
  - Linked to buildings via `building_admins` junction table

Authentication flow checks both tables based on login context.

### Multi-Tenancy

**Building-scoped data isolation**:
- Each building is an independent data unit
- Porteiros: Query filter `eq('building_id', user.building_id)`
- Moradores: Via apartment linkage through `apartment_residents`
- Admins: Only see buildings assigned via `building_admins`

### Authentication Flow

Implemented in `hooks/useAuth.tsx`:

1. `signIn(email, password)` → Supabase Auth
2. On success, check `profiles` table first
3. If not found and might be admin, check `admin_profiles`
4. Load appropriate profile based on `user_type`
5. Session persisted via AsyncStorage

**Authorization**:
- `<ProtectedRoute>` component wraps all authenticated screens
- `usePermissions()` hook provides role-based feature access
- Checks user type and redirects to appropriate login

### Database Schema

**Key tables**:
- `buildings` - Condominium buildings
- `apartments` - Individual units within buildings
- `apartment_residents` - Many-to-many junction (resident ↔ apartment)
- `profiles` - Porteiro and Morador profiles
- `admin_profiles` - Administrator profiles
- `building_admins` - Many-to-many junction (admin ↔ building)
- `visitors` - Visitor records
- `visitor_logs` - Entry/exit tracking (tipo_log: 'IN'/'OUT')
- `deliveries` - Package reception
- `vehicles` - Resident vehicles
- `communications` - Building announcements

**RLS Policies**:
- Enabled on all tables but mostly permissive
- Access control primarily handled at application layer via `user_type` checks
- Some policies disabled in recent migrations for development

### File Structure

```
app/                              # Expo Router file-based routing
├── _layout.tsx                   # Root layout with AuthProvider
├── index.tsx                     # Home/role selector
├── admin/                        # Admin role routes
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── index.tsx                 # Admin dashboard
│   ├── users.tsx
│   ├── buildings.tsx
│   └── ...
├── porteiro/                     # Doorman role routes
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── index.tsx                 # Main dashboard (5 tabs)
│   └── ...
├── morador/                      # Resident role routes
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── index.tsx
│   ├── cadastro/                 # Multi-step registration
│   │   ├── novo.tsx
│   │   ├── relacionamento.tsx
│   │   ├── telefone.tsx
│   │   └── ...
│   └── visitantes/               # Multi-step visitor auth
│       ├── nome.tsx
│       ├── cpf.tsx
│       └── ...
└── visitante/                    # Visitor role routes

components/                       # Shared UI components
├── ProtectedRoute.tsx           # Authorization wrapper
├── AuthForm.tsx                 # Reusable login form
├── porteiro/                    # Role-specific components
│   ├── RegistrarVisitante.tsx
│   ├── RegistrarEncomenda.tsx
│   └── RegistrarVeiculo.tsx
└── ...

services/
├── notificationService.ts       # Push notifications (currently disabled)
└── audioService.ts              # Audio recording (disabled for web)

utils/
├── supabase.ts                  # Supabase client + adminAuth service
├── whatsapp.ts                  # WhatsApp integration (stubs)
└── styles.ts                    # Style utilities

types/
└── database.ts                  # Auto-generated Supabase types

hooks/
└── useAuth.tsx                  # AuthProvider context

supabase/migrations/             # 70+ migration files
```

## Common Development Patterns

### Data Fetching Pattern

Standard pattern used throughout:

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
  .single(); // Returns one row
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

Use `adminAuth` object from `utils/supabase.ts`:

```typescript
import { supabase, adminAuth } from '~/utils/supabase';

// Admin operations
await adminAuth.signIn(email, password);
await adminAuth.getCurrentAdmin();
await adminAuth.getAdminBuildings(adminProfileId);
await adminAuth.createAdminProfile(userData);
await adminAuth.assignAdminToBuilding(adminId, buildingId);
```

All admin operations include:
- Automatic retry with exponential backoff (up to 3 times)
- 15-20s timeout handling
- Network connectivity checks on iOS
- Detailed error logging

### Multi-step Forms

For complex registration flows (e.g., morador cadastro, visitor authorization):

1. Each step is a separate route: `cadastro/novo.tsx`, `cadastro/relacionamento.tsx`, etc.
2. State managed in parent `_layout.tsx`
3. Navigate between steps: `router.push('/morador/cadastro/relacionamento')`
4. Benefits: Browser back button works naturally, easier to test individual steps

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

Use emoji prefixes in logs:
- `🔐` Authentication
- `🔍` Queries
- `✅` Success
- `❌` Errors
- `⏳` Timeouts

## Important Considerations

### TypeScript Path Aliases

Use `~/*` for imports from project root:

```typescript
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/hooks/useAuth';
```

Configured in `tsconfig.json` with `baseUrl: "."` and `paths: { "~/*": ["*"] }`.

### Platform-Specific Code

iOS has special timeout handling (20s vs 10s) and network checks. See `utils/supabase.ts` for platform detection via `Platform.OS === 'ios'`.

### Disabled Features

**Currently commented out/disabled**:
1. Push notifications (`notificationService.ts`)
2. Audio recording for emergencies (`audioService.ts` - web incompatibility)
3. Real-time Supabase subscriptions (`.on('*', ...)` listeners)
4. Emergency button backend (routes exist, incomplete)

### Environment Variables

Required in `.env`:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend only)
- WhatsApp/Twilio credentials (Evolution API integration)

### Security

- **Never commit `.env`** (already in `.gitignore`)
- RLS policies are permissive - rely on application-layer auth checks
- All mutations check `user_type` before allowing operations
- Use `ProtectedRoute` wrapper for all authenticated screens

## Visitor Lifecycle Example

Demonstrates multi-role interaction:

1. **Morador** authorizes visitor → `INSERT INTO visitors`
2. **Porteiro** sees in "Autorizacoes" tab → `SELECT FROM visitors WHERE status='authorized'`
3. Porteiro confirms arrival → `INSERT INTO visitor_logs (tipo_log='IN')`
4. Porteiro logs exit → `INSERT INTO visitor_logs (tipo_log='OUT')`
5. **Morador** views history → `SELECT FROM visitor_logs` (filtered by apartment)

## Database Migrations

- 70+ migration files in `supabase/migrations/`
- Key migration: `009_multiple_residents_per_apartment.sql` - Introduced `apartment_residents` junction table
- Apply via Supabase Dashboard or CLI
- Test migrations include debug queries (`check_*.sql`, `verify_*.sql`)

## Debugging

**Extensive logging** throughout codebase:
- Check browser console (web) or React Native debugger
- iOS-specific logs in `supabase.ts` for network issues
- SQL test queries in migration folder for database debugging

**Common issues**:
- RLS policy blocking queries → Check policies in Supabase Dashboard
- Login fails → Verify user exists in correct table (`profiles` vs `admin_profiles`)
- Building-scoped data not showing → Verify `building_id` matches user's building
- Apartment data missing → Check `apartment_residents` junction table entries

## Code Style

- **Language**: Domain language is Portuguese (morador, porteiro, visitante)
- **TypeScript**: Strict mode enabled
- **Formatting**: Run `npm run format` before commits
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Components**: Functional components with hooks only (no classes)
- **🧠Boas práticas de programação**

> Sempre que possível, use as práticas a seguir ao escrever, revisar ou refatorar código.
>
> O objetivo é manter o código **simples, limpo, legível, reutilizável e fácil de dar manutenção**.
>
> ---
>
> ### 🧩 **KISS (Keep It Simple, Stupid)**
>
> **Ideia:** mantenha o código simples e direto, evite complexidade desnecessária.
>
> **Ruim:**
>
> ```js
> function soma(a, b) {
>   if (typeof a === "number" && typeof b === "number") {
>     return a + b;
>   } else {
>     return parseInt(a) + parseInt(b);
>   }
> }
> ```
>
> **Melhor (KISS):**
>
> ```js
> function soma(a, b) {
>   return Number(a) + Number(b);
> }
> ```
>
> ---
>
> ### 🔁 **DRY (Don’t Repeat Yourself)**
>
> **Ideia:** evite repetir código. Se algo se repete, transforme em função, componente ou módulo.
>
> **Ruim:**
>
> ```js
> console.log("Erro: usuário não encontrado");
> alert("Erro: usuário não encontrado");
> ```
>
> **Melhor (DRY):**
>
> ```js
> function exibirErro(msg) {
>   console.log(`Erro: ${msg}`);
>   alert(`Erro: ${msg}`);
> }
> exibirErro("usuário não encontrado");
> ```
>
> ---
>
> ### 🧼 **Clean Code**
>
> **Ideia:** código limpo é fácil de ler, entender e manter.
>
> * Use **nomes claros e descritivos**
> * Funções devem ter **uma única responsabilidade**
> * Evite **comentários desnecessários**
> * Mantenha **formatação e estilo consistentes**
>
> **Ruim:**
>
> ```js
> function x(a, b) {
>   return a * b + a * a;
> }
> ```
>
> **Melhor (Clean Code):**
>
> ```js
> function calcularAreaTotal(base, altura) {
>   return base * altura + base * base;
> }
> ```
>
> ---
>
> ### ⚙️ **SOLID**
>
> **Conjunto de princípios para código orientado a objetos bem estruturado e flexível.**
>
> * **S — Single Responsibility:** cada módulo deve ter uma única responsabilidade.
>
>   ```js
>   // Ruim: função faz várias coisas
>   function salvarUsuario(usuario) {
>     validarUsuario(usuario);
>     salvarNoBanco(usuario);
>     enviarEmailBoasVindas(usuario);
>   }
>
>   // Melhor: separar responsabilidades
>   function salvarUsuario(usuario) {
>     validarUsuario(usuario);
>     salvarNoBanco(usuario);
>   }
>
>   function enviarBoasVindas(usuario) {
>     enviarEmailBoasVindas(usuario);
>   }
>   ```
>
> * **O — Open/Closed:** código aberto para extensão, fechado para modificação.
>
>   ```js
>   // Em vez de editar a função original, adicione novas classes ou métodos.
>   class EnviadorDeNotificacao {
>     enviar(mensagem) {}
>   }
>
>   class EnviadorEmail extends EnviadorDeNotificacao {
>     enviar(mensagem) { console.log("Email:", mensagem); }
>   }
>
>   class EnviadorSMS extends EnviadorDeNotificacao {
>     enviar(mensagem) { console.log("SMS:", mensagem); }
>   }
>   ```
>
> * **L — Liskov Substitution:** classes filhas devem poder substituir as pais sem quebrar o sistema.
>
> * **I — Interface Segregation:** prefira interfaces pequenas e específicas.
>
> * **D — Dependency Inversion:** dependa de abstrações, não implementações concretas.
>
> ---
>
> ### 🚫 **YAGNI (You Aren’t Gonna Need It)**
>
> **Ideia:** não adicione funcionalidades que ainda não são necessárias.
>
> **Ruim:**
>
> ```js
> // Adicionando suporte a múltiplas moedas sem precisar ainda
> function calcularPreco(produto, moeda = "BRL") {
>   if (moeda === "USD") return produto.preco * 0.19;
>   if (moeda === "EUR") return produto.preco * 0.17;
>   return produto.preco;
> }
> ```
>
> **Melhor (YAGNI):**
>
> ```js
> function calcularPreco(produto) {
>   return produto.preco;
> }
> ```
>
> ---
>
> ### 🧱 **SOC (Separation of Concerns)**
>
> **Ideia:** separe responsabilidades em camadas/módulos distintos.
>
> **Exemplo (front/back):**
>
> * Frontend → interface e experiência do usuário
> * Backend → lógica de negócio
> * Banco de dados → persistência de dados
>
> **Exemplo em código:**
>
> ```js
> // Controller
> function criarUsuarioController(req, res) {
>   const usuario = criarUsuarioService(req.body);
>   res.json(usuario);
> }
>
> // Service
> function criarUsuarioService(dados) {
>   validarDados(dados);
>   return salvarUsuarioNoBanco(dados);
> }
> ```
>
> ---
>
> ### ⚡ **Convention Over Configuration**
>
> **Ideia:** use convenções padrão (nomes, pastas, rotas) para evitar configuração manual.
> Exemplo: frameworks como Next.js ou Rails já trazem convenções que reduzem o boilerplate.
>
> **Ruim:**
> Criar estrutura de pastas e rotas personalizadas para tudo.
>
> **Melhor:**
> Seguir convenções do framework (ex: `/pages`, `/api`, etc.).
>
> ---
>
> ### 🧭 **Principle of Least Surprise**
>
> **Ideia:** o código deve fazer exatamente o que parece que vai fazer.
>
> **Ruim:**
>
> ```js
> function deletarUsuario(id) {
>   // apenas desativa, mas o nome sugere exclusão real
>   desativarUsuario(id);
> }
> ```
>
> **Melhor:**
>
> ```js
> function desativarUsuario(id) {
>   // nome e ação coerentes
>   desativarUsuarioNoBanco(id);
> }
> ```
>
> ---
>
> **💡 Em resumo:**
>
> * Escreva código legível, modular e simples.
> * Evite repetições e complexidade.
> * Mantenha separação clara entre responsabilidades.
> * Siga padrões e convenções.
> * Faça o código expressar sua intenção de forma clara e previsível.

---
- em hipotese alguma mude o layout ou design do projeto atual, mude apenas se eu for bem claro e peça pra vc mudar algo no layout ou design, ao contrario nao mude nada do css etc.
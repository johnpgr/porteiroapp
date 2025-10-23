# @porteiroapp/common

Utilitários e componentes compartilhados para o projeto PorteiroApp. Este pacote fornece configurações de cliente Supabase agnósticas de plataforma, hooks React e operações de banco de dados type-safe.

## Visão Geral

`@porteiroapp/common` é um pacote de monorepo que centraliza funcionalidades comuns em todo o ecossistema PorteiroApp, incluindo ambientes mobile (React Native), web (Next.js) e server-side.

## Instalação

Este é um pacote privado de workspace. Para usá-lo em sua aplicação:

```json
{
  "dependencies": {
    "@porteiroapp/common": "workspace:*"
  }
}
```

## Exports

O pacote fornece dois pontos de entrada principais:

### `/supabase`

Utilitários de cliente Supabase, configurações e operações de banco de dados type-safe.

```typescript
import {
  createSupabaseClient,
  createBrowserClient,
  createServerClient,
  SupabaseClientFactory,
  UnifiedSupabaseClient,
  type TypedSupabaseClient,
  type Database
} from '@porteiroapp/common/supabase';
```

### `/hooks`

Hooks React para gerenciar notificações e lembretes.

```typescript
import {
  createUseLembretes,
  fetchPendingNotifications,
  respondToNotification,
  subscribeToPendingNotifications
} from '@porteiroapp/common/hooks';
```

## Funcionalidades

### Cliente Supabase Consciente de Plataforma

Crie clientes Supabase otimizados para diferentes plataformas com configuração automática:

```typescript
import { SupabaseClientFactory } from '@porteiroapp/common/supabase';

// React Native
const { client, unified } = SupabaseClientFactory.createReactNativeClient(
  Platform.OS,
  {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    storage: AsyncStorage,
    logLevel: 'error'
  }
);

// Browser/Web
const { client, unified } = SupabaseClientFactory.createBrowserClient({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  logLevel: 'info'
});

// Server
const { client, unified } = SupabaseClientFactory.createServerClient({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  serviceKey: SUPABASE_SERVICE_KEY
});
```

### Cliente Supabase Unificado

O `UnifiedSupabaseClient` fornece funcionalidades aprimoradas com lógica de retry, tratamento de timeout e otimizações específicas de plataforma:

```typescript
import { UnifiedSupabaseClient } from '@porteiroapp/common/supabase';

const unified = new UnifiedSupabaseClient({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  platformDetector: new BrowserPlatformDetector(),
  logLevel: 'debug'
});

// Login com retry e timeout automáticos
const { data, error } = await unified.signInWithPassword(email, password);

// Executar operações com timeout
const session = await unified.withTimeout(
  supabase.auth.getSession(),
  'refresh'
);

// Executar operações com retry
const result = await unified.withRetry(
  async () => supabase.from('users').select('*'),
  'fetch_users'
);
```

### Operações de Banco de Dados Type-Safe

Todas as operações de banco de dados são totalmente tipadas usando tipos gerados do Supabase:

```typescript
import type { TypedSupabaseClient, Database } from '@porteiroapp/common/supabase';

const supabase: TypedSupabaseClient = createBrowserClient(url, anonKey);

// Queries totalmente tipadas
const { data, error } = await supabase
  .from('profiles')
  .select('id, full_name, user_type')
  .eq('user_type', 'admin');

// data é automaticamente tipado como:
// Array<{ id: string; full_name: string; user_type: string }> | null
```

### Hooks React

#### useLembretes (Hook de Lembretes)

Hook baseado em factory para gerenciar lembretes (notas) com assinaturas em tempo real:

```typescript
import { createUseLembretes } from '@porteiroapp/common/hooks';

// Criar o hook com dependências
const useLembretes = createUseLembretes({
  supabase: supabaseClient,
  getUser: () => currentUser
});

// Usar no seu componente
function MyComponent() {
  const {
    lembretes,
    loading,
    error,
    createLembrete,
    updateLembrete,
    deleteLembrete,
    getLembreteById,
    getLembretesByStatus,
    getLembretesByPrioridade,
    getLembretesByCategoria,
    getLembretesProximos,
    refreshLembretes
  } = useLembretes();

  const handleCreate = async () => {
    const result = await createLembrete({
      titulo: 'Reunião de Condomínio',
      descricao: 'Discutir melhorias do prédio',
      data_vencimento: '2025-11-01T10:00:00Z',
      categoria: 'reuniao',
      prioridade: 'alta',
      antecedencia_alerta: 24,
      building_admin_id: buildingId
    });

    if (result.success) {
      console.log('Criado:', result.lembrete);
    }
  };
}
```

#### Funções Core de Notificações Pendentes

Funções agnósticas de plataforma para gerenciar notificações pendentes:

```typescript
import {
  fetchPendingNotifications,
  respondToNotification,
  subscribeToPendingNotifications
} from '@porteiroapp/common/hooks';

// Buscar notificações
const { data, error } = await fetchPendingNotifications({
  supabase,
  apartmentId: 'abc-123',
  userId: 'user-456'
});

// Responder à notificação
const result = await respondToNotification(
  { supabase, apartmentId, userId },
  notificationId,
  { action: 'approve', delivery_destination: 'portaria' }
);

// Assinar atualizações em tempo real
const cleanup = subscribeToPendingNotifications(
  { supabase, apartmentId },
  {
    onInsert: (notification) => console.log('Nova:', notification),
    onUpdate: (notification) => console.log('Atualizada:', notification)
  }
);

// Limpar quando finalizar
cleanup();
```

## Detecção de Plataforma

O pacote inclui utilitários de detecção de plataforma para otimizar a configuração do Supabase para diferentes ambientes:

```typescript
import {
  BrowserPlatformDetector,
  ReactNativePlatformDetector,
  ServerPlatformDetector
} from '@porteiroapp/common/supabase';

const detector = new BrowserPlatformDetector();
console.log(detector.getPlatform()); // 'browser'
console.log(detector.isMobile()); // false
console.log(detector.isNative()); // false
```

## Gerenciamento de Configuração

O `PlatformConfigManager` fornece configurações específicas de plataforma:

```typescript
import { PlatformConfigManager } from '@porteiroapp/common/supabase';

const configManager = new PlatformConfigManager(platformDetector, 'debug');

// Obter timeout específico da plataforma
const timeout = configManager.getTimeout('auth'); // Diferente por plataforma

// Obter opções do Supabase
const options = configManager.getSupabaseOptions(storage);

// Verificar se deve fazer retry
const shouldRetry = configManager.shouldRetry(retryCount);

// Calcular delay de retry com backoff exponencial
const delay = configManager.calculateRetryDelay(retryCount);
```

## Logging

Logger integrado com níveis de log configuráveis:

```typescript
import { AuthLogger } from '@porteiroapp/common/supabase';

const logger = new AuthLogger('debug');

logger.debug('Mensagem de debug', { metadata: 'valor' });
logger.info('Mensagem de info', { userId: '123' });
logger.warn('Mensagem de aviso', { context: 'auth' });
logger.error('Mensagem de erro', { error: errorObject });
```

## Supabase Edge Functions

O pacote inclui Supabase Edge Functions localizadas em `supabase/functions/`:

### send-notification

Envia notificações push para usuários via Expo Push API.

**Request:**
```typescript
{
  user_id?: string;
  profile_id?: string;
  title: string;
  body: string;
  type: 'visitor_approval' | 'visitor_arrival' | 'system' | 'security' | 'general';
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
}
```

### send-push-notification

Endpoint alternativo de notificação push com funcionalidade similar.

### process-notification-queue

Processa notificações enfileiradas em lote para melhor performance.

## Desenvolvimento

### Build

```bash
npm run build
```

Compila arquivos TypeScript para o diretório `dist/` com source maps e declarações de tipo.

### Type Check

```bash
npm run typecheck
```

Executa o compilador TypeScript sem emitir arquivos para verificar erros de tipo.

## Type Safety

O pacote usa configuração estrita de TypeScript com:

- `strict: true` - Todas as opções de verificação de tipo estrita habilitadas
- `noUncheckedIndexedAccess: true` - Acesso indexado retorna `T | undefined`
- `exactOptionalPropertyTypes: true` - Manipulação estrita de propriedades opcionais
- Tipos de banco de dados gerados do Supabase para type safety de ponta a ponta

## Arquitetura

### Estrutura de Diretórios

```
packages/common/
├── supabase/
│   ├── client/          # Implementação do UnifiedSupabaseClient
│   ├── config/          # Configurações específicas de plataforma
│   ├── core/            # Factory principal do cliente Supabase
│   ├── factories/       # Factories de cliente para diferentes plataformas
│   ├── functions/       # Supabase Edge Functions
│   ├── types/           # Definições de tipos do banco de dados
│   ├── utils/           # Detecção de plataforma e logging
│   └── index.ts         # Arquivo principal de export
├── hooks/
│   ├── useLembretes.ts                    # Hook de lembretes
│   ├── usePendingNotificationsCore.ts     # Lógica de notificações
│   └── index.ts                           # Arquivo principal de export
├── dist/                # Saída compilada
├── package.json
├── tsconfig.json
└── README.md
```

### Princípios de Design

1. **Agnóstico de Plataforma**: Funciona perfeitamente em ambientes React Native, Browser e Server
2. **Type Safe**: Aproveita o sistema de tipos do TypeScript para segurança em tempo de compilação
3. **Injeção de Dependência**: Usa padrão factory para injetar dependências específicas de plataforma
4. **Resiliente**: Lógica de retry integrada e tratamento de timeout para operações de rede
5. **Tempo Real**: Assinaturas Supabase Realtime para atualizações de dados ao vivo
6. **Modular**: Separação clara de responsabilidades com módulos focados

## Licença

Pacote privado - não para distribuição pública.

## Pacotes Relacionados

- `@porteiroapp/porteiro-app` - Aplicação mobile React Native
- `@porteiroapp/porteiro-webapp` - Aplicação web Next.js
- `@porteiroapp/interfone-api` - Serviço de API backend

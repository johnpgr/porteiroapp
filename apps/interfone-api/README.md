# Interfone API

API para sistema de interfone com Agora Voice SDK - TypeScript + ESM

## 🚀 Tecnologias

- **TypeScript** - Type safety e melhor DX
- **Node 22** - Native TypeScript support (sem transpilação!)
- **Express** - Framework web
- **ESM** - ES Modules nativos
- **Supabase** - Database (PostgreSQL)
- **Agora Voice SDK** - Chamadas de voz em tempo real

## ⚡ Node 22 Native TypeScript

Esta API utiliza o **suporte nativo do Node 22 para TypeScript**, eliminando a necessidade de ferramentas como `tsx`, `ts-node` ou transpilação prévia:

### Vantagens:
- ✅ **Execução direta**: `node src/server.ts` funciona nativamente
- ✅ **Hot reload nativo**: Flag `--watch` integrada ao Node
- ✅ **Sem build step**: Não precisa compilar para produção
- ✅ **Mais rápido**: Sem overhead de ferramentas externas
- ✅ **Menos dependências**: Removido `tsx` e similares

## 📦 Instalação

```bash
pnpm install
```

## 🔧 Configuração

Crie um arquivo `.env` baseado no `.env.example`:

```env
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Agora
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate
```

## 🏃 Executar

### Desenvolvimento (com hot reload)
```bash
pnpm dev
```
Uses Node 22's native `--watch` flag for automatic restarts.

### Produção
```bash
pnpm start
```
Uses Node 22's native TypeScript support - no build step required!

### Build (opcional)
```bash
pnpm build
```
Compiles TypeScript to JavaScript if needed for deployment.

## 📁 Estrutura

```
src/
├── server.ts              # Entry point
├── controllers/           # Request handlers
│   ├── call.controller.ts
│   └── token.controller.ts
├── routes/               # Route definitions
│   ├── call.routes.ts
│   └── token.routes.ts
└── services/             # Business logic
    └── db.service.ts
```

## 🔌 API Endpoints

### Health Check
- `GET /` - Health check
- `GET /api/status` - Service status

### Calls
- `POST /api/calls/start` - Iniciar chamada
- `POST /api/calls/:callId/answer` - Atender chamada
- `POST /api/calls/:callId/decline` - Recusar chamada
- `POST /api/calls/:callId/end` - Encerrar chamada
- `GET /api/calls/:callId/status` - Status da chamada
- `GET /api/calls/history` - Histórico de chamadas
- `GET /api/calls/active` - Chamadas ativas

### Tokens
- `POST /api/tokens/generate` - Gerar token RTC
- `POST /api/tokens/generate-multiple` - Gerar múltiplos tokens
- `POST /api/tokens/validate` - Validar token

## 🔄 Migração de JavaScript para TypeScript

A API foi convertida de JavaScript (CommonJS) para TypeScript (ESM) usando **Node 22's native TypeScript support**:

- ✅ Todos os arquivos convertidos para `.ts`
- ✅ Imports usando ESM (`import/export`)
- ✅ Type safety completo
- ✅ Configuração TypeScript (`tsconfig.json`)
- ✅ Scripts atualizados no `package.json`
- ✅ Node 22 executa TypeScript nativamente (sem tsx/ts-node)
- ✅ `--watch` flag nativo para hot reload

### Mudanças principais:

#### 1. **Module System**: CommonJS → ESM
```javascript
// Antes (CommonJS)
const express = require('express');
module.exports = router;

// Depois (ESM)
import express from 'express';
export default router;
```

#### 2. **File Extensions**: `.js` → `.ts`
```typescript
// Imports agora usam extensão .ts
import DatabaseService from './services/db.service.ts';
import CallController from '../controllers/call.controller.ts';
```
- Node 22 resolve `.ts` automaticamente com `allowImportingTsExtensions`
- Não precisa usar `.js` como workaround

#### 3. **Type Safety**: JavaScript → TypeScript
```typescript
// Tipos explícitos em funções
static async startCall(req: Request, res: Response): Promise<void> {
  // ...
}

// Interfaces para objetos
interface CallData {
  id: string;
  status: string;
  // ...
}
```

#### 4. **Node 22 Features**:

**a) Native TypeScript Execution**
```bash
# Antes: precisava de tsx/ts-node
npx tsx src/server.ts

# Agora: Node 22 executa diretamente
node src/server.ts
```

**b) Built-in Watch Mode**
```bash
# Antes: precisava de nodemon ou tsx watch
npx tsx watch src/server.ts

# Agora: flag --watch nativa
node --watch src/server.ts
```

**c) TypeScript Configuration**
```json
{
  "compilerOptions": {
    "module": "NodeNext",              // Usa resolução moderna do Node
    "moduleResolution": "NodeNext",     // Compatível com Node 22
    "allowImportingTsExtensions": true, // Permite import de .ts
    "noEmit": true                      // Não gera .js (Node executa .ts)
  }
}
```

### 📦 Package.json Changes

**Removido:**
- `tsx` - Não mais necessário

**Scripts atualizados:**
```json
{
  "scripts": {
    "dev": "node --watch src/server.ts",  // Hot reload nativo
    "start": "node src/server.ts",         // Execução direta
    "build": "tsc"                         // Opcional, para CI/CD
  }
}
```

### 🔧 TypeScript Config Highlights

```json
{
  "compilerOptions": {
    "module": "NodeNext",              // ESM moderno
    "moduleResolution": "NodeNext",     // Resolução Node 22
    "allowImportingTsExtensions": true, // Import .ts files
    "noEmit": true,                     // Sem transpilação
    "strict": true                      // Type safety máximo
  }
}
```

### ⚠️ Notas Importantes

1. **Requer Node.js 22+**: Esta configuração só funciona com Node 22 ou superior
2. **IDE Warnings**: Você pode ver avisos sobre `@types` faltando - isso é normal, o código roda perfeitamente
3. **Build Opcional**: O comando `build` ainda existe para casos onde você precisa de `.js` compilado (ex: Docker, CI/CD)

## 🗑️ Limpeza

Os arquivos JavaScript antigos ainda existem no diretório. Você pode removê-los manualmente:

```bash
# Remove old JS files
rm server.js
rm -rf src/**/*.js
```

Ou mantê-los como backup até confirmar que tudo funciona corretamente.

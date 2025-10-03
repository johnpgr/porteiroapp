# 🧪 Sistema de Testes WebRTC - James Avisa

Este diretório contém um sistema completo de testes para validar o funcionamento do sistema WebRTC do James Avisa (Sistema de Interfone - Áudio apenas).

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Estrutura dos Testes](#estrutura-dos-testes)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Executando os Testes](#executando-os-testes)
- [Tipos de Teste](#tipos-de-teste)
- [Interface de Teste Manual](#interface-de-teste-manual)
- [Relatórios e Cobertura](#relatórios-e-cobertura)
- [Troubleshooting](#troubleshooting)

## 🎯 Visão Geral

O sistema de testes foi desenvolvido para validar todas as funcionalidades do sistema de interfone WebRTC James Avisa:

- ✅ **APIs REST** - Autenticação, iniciar/responder/encerrar chamadas de voz
- ✅ **WebSocket** - Conectividade e sinalização em tempo real
- ✅ **Integração** - Simulação completa de chamadas de áudio entre porteiro e morador
- ✅ **WhatsApp** - Integração com notificações de chamadas
- ✅ **Autenticação** - Segurança e controle de acesso
- ✅ **Interface Manual** - Testes visuais e interativos do interfone
- ✅ **Qualidade de Áudio** - Testes de latência, volume e clareza

## 📁 Estrutura dos Testes

```
tests/
├── api/                    # Testes de API REST
│   ├── webrtc-api.test.js
│   └── ...
├── auth/                   # Testes de autenticação
│   ├── webrtc-auth.test.js
│   └── ...
├── integration/            # Testes de integração
│   ├── call-simulation.test.js
│   ├── whatsapp-integration.test.js
│   └── ...
├── websocket/              # Testes de WebSocket
│   ├── signaling.test.js
│   └── ...
├── manual/                 # Interface para testes manuais
│   ├── webrtc-test-interface.html
│   └── ...
├── scripts/                # Scripts automatizados
│   ├── run-tests.js
│   └── ...
├── setup.js               # Configuração global dos testes
└── README.md              # Esta documentação
```

## 🔧 Pré-requisitos

### Software Necessário

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **Navegador moderno** (Chrome, Firefox, Safari, Edge)

### Variáveis de Ambiente

Certifique-se de que as seguintes variáveis estão configuradas no arquivo `.env`:

```env
# JWT
JWT_SECRET=seu_jwt_secret_aqui

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui

# WhatsApp (opcional para testes)
WHATSAPP_API_URL=sua_api_whatsapp
WHATSAPP_API_TOKEN=seu_token_whatsapp

# Servidor
PORT=3000
NODE_ENV=test
```

## 📦 Instalação

1. **Instalar dependências de teste:**

```bash
npm install --save-dev jest supertest ws socket.io-client @types/jest
```

2. **Verificar instalação:**

```bash
npm test -- --version
```

## 🚀 Executando os Testes

### Método 1: Script Automatizado (Recomendado)

```bash
# Executar todos os testes
node tests/scripts/run-tests.js

# Executar testes específicos
node tests/scripts/run-tests.js api          # Apenas testes de API
node tests/scripts/run-tests.js websocket    # Apenas testes WebSocket
node tests/scripts/run-tests.js integration  # Apenas testes de integração
node tests/scripts/run-tests.js auth         # Apenas testes de autenticação
node tests/scripts/run-tests.js performance  # Apenas testes de performance
```

### Método 2: NPM Scripts

```bash
# Executar todos os testes
npm test

# Executar com cobertura
npm run test:coverage

# Executar em modo watch
npm run test:watch

# Executar testes específicos
npm test -- --testPathPattern=api
npm test -- --testPathPattern=websocket
npm test -- --testPathPattern=integration
```

### Método 3: Jest Direto

```bash
# Executar todos os testes
npx jest

# Executar com verbose
npx jest --verbose

# Executar arquivo específico
npx jest tests/api/webrtc-api.test.js

# Executar com cobertura
npx jest --coverage
```

## 🧪 Tipos de Teste

### 1. Testes de API REST

**Localização:** `tests/api/`

**O que testa:**
- Autenticação JWT
- Endpoints de chamada (iniciar, responder, encerrar)
- Listagem de moradores
- Validação de dados
- Tratamento de erros

**Executar:**
```bash
npm test -- --testPathPattern=api
```

### 2. Testes de WebSocket

**Localização:** `tests/websocket/`

**O que testa:**
- Conexão WebSocket
- Autenticação via Socket.IO
- Sinalização WebRTC
- Eventos em tempo real
- Reconexão automática

**Executar:**
```bash
npm test -- --testPathPattern=websocket
```

### 3. Testes de Integração

**Localização:** `tests/integration/`

**O que testa:**
- Fluxo completo de chamadas
- Integração com WhatsApp
- Simulação porteiro ↔ morador
- Cenários de erro
- Performance

**Executar:**
```bash
npm test -- --testPathPattern=integration
```

### 4. Testes de Autenticação

**Localização:** `tests/auth/`

**O que testa:**
- Geração de tokens JWT
- Validação de permissões
- Controle de acesso por função
- Segurança WebSocket

**Executar:**
```bash
npm test -- --testPathPattern=auth
```

## 🖥️ Interface de Teste Manual

### Acessando a Interface

1. **Iniciar o servidor:**
```bash
npm run dev
```

2. **Abrir a interface:**
```bash
# Abrir diretamente no navegador
open tests/manual/webrtc-test-interface.html

# Ou navegar para:
file:///caminho/para/seu/projeto/tests/manual/webrtc-test-interface.html
```

### Funcionalidades da Interface

#### Painel do Porteiro
- 🔐 Autenticação JWT
- 👥 Seleção de moradores
- 📞 Iniciar chamadas (vídeo/áudio)
- ❌ Encerrar chamadas
- 📝 Especificar motivo e visitante

#### Painel do Morador
- 🔐 Autenticação JWT
- ✅ Atender chamadas
- ❌ Rejeitar chamadas
- 🔗 Conectar como morador

#### Controles de Mídia
- 📷 Alternar câmera
- 🎤 Alternar microfone
- 🔊 Controlar áudio remoto

#### Testes Automatizados
- 🔍 Testar APIs
- 🌐 Testar WebSocket
- 🔄 Testar STUN/TURN
- 📞 Simular chamada completa

### Como Usar

1. **Configurar Tokens:**
   - Obtenha tokens JWT válidos para porteiro e morador
   - Cole nos campos de autenticação

2. **Testar Chamada:**
   - No painel do porteiro: selecione morador e inicie chamada
   - No painel do morador: atenda ou rejeite a chamada
   - Observe os logs em tempo real

3. **Verificar Conectividade:**
   - Use os botões de teste automatizado
   - Monitore o status da conexão
   - Verifique os logs de erro

## 📊 Relatórios e Cobertura

### Cobertura de Código

Após executar os testes com cobertura:

```bash
npm run test:coverage
```

Os relatórios estarão disponíveis em:
- **HTML:** `coverage/lcov-report/index.html`
- **LCOV:** `coverage/lcov.info`
- **JSON:** `coverage/coverage-final.json`

### Métricas Importantes

- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 85%
- **Lines:** > 80%

### Visualizar Relatório

```bash
# Abrir relatório HTML
open coverage/lcov-report/index.html

# Ou usar um servidor local
npx http-server coverage/lcov-report
```

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. Servidor não inicia

**Erro:** `EADDRINUSE: address already in use`

**Solução:**
```bash
# Encontrar processo na porta 3000
lsof -ti:3000

# Matar processo
kill -9 $(lsof -ti:3000)

# Ou usar porta diferente
PORT=3001 npm run dev
```

#### 2. Testes de WebSocket falham

**Erro:** `Connection timeout`

**Solução:**
- Verificar se o servidor está rodando
- Confirmar porta correta (3000)
- Verificar firewall/antivírus

#### 3. Permissões de mídia

**Erro:** `NotAllowedError: Permission denied`

**Solução:**
- Usar HTTPS ou localhost
- Permitir acesso à câmera/microfone no navegador
- Verificar configurações de privacidade

#### 4. Testes de autenticação falham

**Erro:** `JsonWebTokenError: invalid token`

**Solução:**
- Verificar `JWT_SECRET` no `.env`
- Confirmar formato do token
- Verificar expiração do token

#### 5. Conexão com Supabase

**Erro:** `Invalid API key`

**Solução:**
- Verificar `SUPABASE_URL` e `SUPABASE_ANON_KEY`
- Confirmar permissões RLS
- Testar conexão manual

### Logs de Debug

#### Habilitar logs detalhados:

```bash
# Variável de ambiente
DEBUG=* npm test

# Ou específico para WebRTC
DEBUG=webrtc:* npm test
```

#### Logs do navegador:

```javascript
// No console do navegador
localStorage.setItem('debug', 'webrtc:*');
location.reload();
```

### Verificação de Saúde

```bash
# Verificar status do sistema
curl http://localhost:3000/api/webrtc/health

# Verificar WebSocket
node -e "const io = require('socket.io-client'); const socket = io('http://localhost:3000'); socket.on('connect', () => console.log('OK'));"
```

## 📞 Suporte

Se você encontrar problemas não cobertos nesta documentação:

1. **Verificar logs:** Console do navegador e terminal
2. **Testar isoladamente:** Execute testes individuais
3. **Verificar ambiente:** Confirme todas as variáveis de ambiente
4. **Documentar erro:** Salve logs e passos para reproduzir

## 🔄 Atualizações

Para manter os testes atualizados:

```bash
# Atualizar dependências de teste
npm update --save-dev

# Verificar vulnerabilidades
npm audit

# Corrigir vulnerabilidades
npm audit fix
```

---

**📝 Nota:** Esta documentação é atualizada regularmente. Para a versão mais recente, consulte o repositório do projeto.

**🏢 James Avisa** - Sistema de Videoporteiro com WebRTC
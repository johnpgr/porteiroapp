# 📞 API WebRTC - James Avisa

## 📋 Visão Geral

A API WebRTC do James Avisa fornece funcionalidades completas para comunicação em tempo real entre porteiros e moradores através de chamadas de áudio/vídeo. O sistema é integrado com Supabase para autenticação, autorização e persistência de dados.

### 🎯 Funcionalidades Principais

- **Chamadas WebRTC**: Áudio e vídeo em tempo real
- **Autenticação JWT**: Segurança baseada em tokens Supabase
- **Controle de Acesso**: Diferentes níveis de permissão (Admin, Porteiro, Morador)
- **Rate Limiting**: Proteção contra spam de chamadas
- **Histórico de Chamadas**: Registro completo de todas as interações
- **Status de Usuários**: Controle de disponibilidade online/offline
- **WebSocket Signaling**: Sinalização em tempo real para estabelecimento de conexões

---

## 🔐 Autenticação e Segurança

### JWT Token Authentication

Todos os endpoints requerem autenticação via JWT token do Supabase:

```javascript
// Headers obrigatórios
{
  "Authorization": "Bearer <supabase_jwt_token>",
  "Content-Type": "application/json"
}
```

### Middlewares de Segurança

#### 1. **authenticateWebRTC**
- Valida JWT token com Supabase
- Verifica se usuário existe e tem WebRTC habilitado
- Adiciona informações do usuário ao request

#### 2. **Controle de Acesso por Tipo de Usuário**
- `requireAdmin`: Apenas administradores
- `requirePorteiro`: Porteiros e administradores
- `requireMorador`: Moradores e administradores

#### 3. **Rate Limiting**
- Máximo de 10 chamadas por minuto por usuário
- Janela deslizante de 60 segundos
- Retorna erro 429 quando excedido

#### 4. **Validação de Parâmetros**
- Valida IDs de receptor
- Verifica tipos de chamada (audio/video)
- Impede auto-chamadas

### Códigos de Erro de Autenticação

| Código | Descrição | Status HTTP |
|--------|-----------|-------------|
| `MISSING_TOKEN` | Token de acesso não fornecido | 401 |
| `INVALID_TOKEN` | Token inválido ou expirado | 401 |
| `USER_NOT_FOUND` | Usuário não encontrado | 404 |
| `WEBRTC_DISABLED` | WebRTC não habilitado para usuário | 403 |
| `ADMIN_REQUIRED` | Acesso restrito a administradores | 403 |
| `PORTEIRO_REQUIRED` | Acesso restrito a porteiros | 403 |
| `MORADOR_REQUIRED` | Acesso restrito a moradores | 403 |
| `RATE_LIMIT_EXCEEDED` | Muitas tentativas de chamada | 429 |

---

## 🛠️ Endpoints da API

### Base URL
```
http://127.0.0.1:3001/api/webrtc
```

---

### 1. **GET /residents** - Listar Moradores Disponíveis

**Permissão**: Porteiro ou Admin

**Descrição**: Retorna lista de moradores disponíveis para chamadas WebRTC.

**Request**:
```http
GET /api/webrtc/residents
Authorization: Bearer <jwt_token>
```

**Response Success (200)**:
```json
{
  "success": true,
  "residents": [
    {
      "id": "uuid",
      "name": "João Silva",
      "apartment_number": "101",
      "building": "Bloco A",
      "is_online": true,
      "is_available": true
    }
  ],
  "total": 1
}
```

**Response Error (500)**:
```json
{
  "success": false,
  "error": "Erro ao buscar moradores disponíveis"
}
```

---

### 2. **POST /call/initiate** - Iniciar Chamada WebRTC

**Permissão**: Autenticado + Rate Limited

**Descrição**: Inicia uma nova chamada WebRTC entre dois usuários.

**Request**:
```http
POST /api/webrtc/call/initiate
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "callerId": "uuid_do_porteiro",
  "receiverId": "uuid_do_morador",
  "callType": "audio"
}
```

**Response Success (200)**:
```json
{
  "success": true,
  "callId": "uuid_da_chamada",
  "socketRoom": "call_uuid_da_chamada",
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "stun:stun1.l.google.com:19302" }
  ],
  "receiver": {
    "id": "uuid_do_morador",
    "name": "João Silva"
  }
}
```

**Response Error (400)**:
```json
{
  "success": false,
  "error": "Usuário destinatário não está disponível"
}
```

**Códigos de Erro**:
- `MISSING_RECEIVER_ID`: ID do receptor não fornecido
- `INVALID_CALL_TYPE`: Tipo de chamada inválido
- `SELF_CALL_NOT_ALLOWED`: Tentativa de auto-chamada

---

### 3. **POST /call/:callId/answer** - Responder Chamada

**Permissão**: Autenticado

**Descrição**: Responde a uma chamada WebRTC pendente.

**Request**:
```http
POST /api/webrtc/call/123e4567-e89b-12d3-a456-426614174000/answer
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "userId": "uuid_do_morador"
}
```

**Response Success (200)**:
```json
{
  "success": true,
  "callId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "answered",
  "socketRoom": "call_123e4567-e89b-12d3-a456-426614174000",
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" }
  ]
}
```

**Response Error (404)**:
```json
{
  "success": false,
  "error": "Chamada não encontrada ou não pode ser respondida"
}
```

---

### 4. **POST /call/:callId/end** - Encerrar Chamada

**Permissão**: Autenticado

**Descrição**: Encerra uma chamada WebRTC ativa.

**Request**:
```http
POST /api/webrtc/call/123e4567-e89b-12d3-a456-426614174000/end
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "userId": "uuid_do_usuario",
  "endReason": "user_ended"
}
```

**Response Success (200)**:
```json
{
  "success": true,
  "callId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "ended",
  "duration": 120,
  "endReason": "user_ended"
}
```

---

### 5. **GET /call/history** - Histórico de Chamadas

**Permissão**: Autenticado

**Descrição**: Retorna o histórico de chamadas de um usuário.

**Request**:
```http
GET /api/webrtc/call/history?userId=uuid&limit=50&offset=0
Authorization: Bearer <jwt_token>
```

**Response Success (200)**:
```json
{
  "success": true,
  "calls": [
    {
      "id": "uuid",
      "status": "ended",
      "initiated_at": "2024-01-15T10:30:00Z",
      "answered_at": "2024-01-15T10:30:05Z",
      "ended_at": "2024-01-15T10:32:30Z",
      "duration_seconds": 145,
      "end_reason": "user_ended",
      "caller": {
        "id": "uuid",
        "name": "Porteiro João",
        "user_type": "porteiro"
      },
      "receiver": {
        "id": "uuid",
        "name": "Maria Silva",
        "user_type": "morador"
      }
    }
  ],
  "total": 1
}
```

---

### 6. **GET /users/status** - Status de Usuários

**Permissão**: Autenticado

**Descrição**: Retorna o status online/offline de usuários específicos.

**Request**:
```http
GET /api/webrtc/users/status?userIds=uuid1,uuid2,uuid3
Authorization: Bearer <jwt_token>
```

**Response Success (200)**:
```json
{
  "success": true,
  "users": [
    {
      "id": "uuid1",
      "name": "João Silva",
      "user_type": "morador",
      "is_online": true,
      "is_available": true,
      "last_seen": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### 7. **POST /users/status** - Atualizar Status do Usuário

**Permissão**: Autenticado

**Descrição**: Atualiza o status online/disponível de um usuário.

**Request**:
```http
POST /api/webrtc/users/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "userId": "uuid",
  "isOnline": true,
  "isAvailable": true
}
```

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Status atualizado com sucesso"
}
```

---

### 8. **GET /config** - Configurações WebRTC

**Permissão**: Autenticado

**Descrição**: Retorna configurações WebRTC (STUN/TURN servers, media constraints).

**Request**:
```http
GET /api/webrtc/config?quality=medium&audioOnly=false
Authorization: Bearer <jwt_token>
```

**Response Success (200)**:
```json
{
  "success": true,
  "data": {
    "iceConfiguration": {
      "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" },
        { "urls": "stun:stun1.l.google.com:19302" }
      ]
    },
    "mediaConstraints": {
      "audio": true,
      "video": {
        "width": { "ideal": 1280 },
        "height": { "ideal": 720 }
      }
    },
    "environment": {
      "isDevelopment": true,
      "logLevel": "debug"
    },
    "userType": "porteiro"
  }
}
```

---

## 🔄 Fluxo de Chamadas WebRTC

### 1. **Fluxo Completo de Chamada**

```mermaid
sequenceDiagram
    participant P as Porteiro
    participant API as API WebRTC
    participant WS as WebSocket
    participant M as Morador

    P->>API: POST /call/initiate
    API->>API: Validar usuários
    API->>API: Criar registro de chamada
    API-->>P: callId + socketRoom + iceServers
    
    P->>WS: Conectar na sala (socketRoom)
    M->>WS: Conectar na sala (socketRoom)
    
    P->>WS: Enviar offer SDP
    WS->>M: Repassar offer SDP
    
    M->>API: POST /call/:callId/answer
    API->>API: Atualizar status para "answered"
    API-->>M: Confirmação + iceServers
    
    M->>WS: Enviar answer SDP
    WS->>P: Repassar answer SDP
    
    P<->>M: Troca de ICE Candidates via WebSocket
    P<->>M: Estabelecer conexão WebRTC direta
    
    Note over P,M: Chamada ativa - áudio/vídeo direto
    
    P->>API: POST /call/:callId/end
    API->>API: Calcular duração + atualizar status
    API-->>P: Confirmação de encerramento
```

### 2. **Estados da Chamada**

| Estado | Descrição |
|--------|-----------|
| `initiated` | Chamada criada, aguardando resposta |
| `ringing` | Chamada tocando no dispositivo do receptor |
| `answered` | Chamada aceita, estabelecendo conexão |
| `ended` | Chamada encerrada normalmente |
| `missed` | Chamada não atendida |
| `rejected` | Chamada rejeitada pelo receptor |

### 3. **Motivos de Encerramento**

- `user_ended`: Usuário encerrou a chamada
- `timeout`: Timeout de conexão
- `network_error`: Erro de rede
- `rejected`: Chamada rejeitada
- `busy`: Usuário ocupado

---

## 🌐 Configuração WebSocket

### Conexão WebSocket

```javascript
import io from 'socket.io-client';

const socket = io('ws://127.0.0.1:3001', {
  auth: {
    token: supabaseJwtToken
  }
});

// Entrar na sala da chamada
socket.emit('join-call', { callId: 'uuid_da_chamada' });
```

### Eventos WebSocket

#### **Eventos de Sinalização**

```javascript
// Enviar offer SDP
socket.emit('webrtc-offer', {
  callId: 'uuid',
  offer: peerConnection.localDescription
});

// Receber offer SDP
socket.on('webrtc-offer', (data) => {
  peerConnection.setRemoteDescription(data.offer);
});

// Enviar answer SDP
socket.emit('webrtc-answer', {
  callId: 'uuid',
  answer: peerConnection.localDescription
});

// Receber answer SDP
socket.on('webrtc-answer', (data) => {
  peerConnection.setRemoteDescription(data.answer);
});

// Enviar ICE Candidate
socket.emit('webrtc-ice-candidate', {
  callId: 'uuid',
  candidate: event.candidate
});

// Receber ICE Candidate
socket.on('webrtc-ice-candidate', (data) => {
  peerConnection.addIceCandidate(data.candidate);
});
```

#### **Eventos de Status**

```javascript
// Status da chamada alterado
socket.on('call-status-changed', (data) => {
  console.log(`Chamada ${data.callId} mudou para ${data.status}`);
});

// Usuário entrou/saiu da sala
socket.on('user-joined-call', (data) => {
  console.log(`${data.userName} entrou na chamada`);
});

socket.on('user-left-call', (data) => {
  console.log(`${data.userName} saiu da chamada`);
});
```

---

## 💻 Exemplos de Integração

### 1. **Inicialização do Cliente WebRTC**

```javascript
class WebRTCClient {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.socket = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
  }

  async initialize() {
    // Obter token JWT do Supabase
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) throw new Error('Usuário não autenticado');

    // Conectar WebSocket
    this.socket = io('ws://127.0.0.1:3001', {
      auth: { token: session.access_token }
    });

    // Configurar eventos WebSocket
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.socket.on('webrtc-offer', this.handleOffer.bind(this));
    this.socket.on('webrtc-answer', this.handleAnswer.bind(this));
    this.socket.on('webrtc-ice-candidate', this.handleIceCandidate.bind(this));
  }
}
```

### 2. **Iniciar Chamada (Porteiro)**

```javascript
async function initiateCall(receiverId) {
  try {
    // Obter token de autenticação
    const { data: { session } } = await supabase.auth.getSession();
    
    // Iniciar chamada via API
    const response = await fetch('/api/webrtc/call/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        callerId: session.user.id,
        receiverId: receiverId,
        callType: 'audio'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // Conectar na sala WebSocket
      socket.emit('join-call', { callId: result.callId });
      
      // Configurar WebRTC
      await setupWebRTC(result.iceServers);
      
      // Capturar mídia local
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      peerConnection.addStream(stream);
      
      // Criar offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      // Enviar offer via WebSocket
      socket.emit('webrtc-offer', {
        callId: result.callId,
        offer: offer
      });
      
      return result.callId;
    }
  } catch (error) {
    console.error('Erro ao iniciar chamada:', error);
    throw error;
  }
}
```

### 3. **Responder Chamada (Morador)**

```javascript
async function answerCall(callId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Responder chamada via API
    const response = await fetch(`/api/webrtc/call/${callId}/answer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: session.user.id
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // Conectar na sala WebSocket
      socket.emit('join-call', { callId: callId });
      
      // Capturar mídia local
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      peerConnection.addStream(stream);
      
      // Aguardar offer e criar answer será tratado pelos eventos WebSocket
      return true;
    }
  } catch (error) {
    console.error('Erro ao responder chamada:', error);
    throw error;
  }
}
```

### 4. **Configuração WebRTC**

```javascript
async function setupWebRTC(iceServers) {
  const configuration = {
    iceServers: iceServers,
    iceCandidatePoolSize: 10
  };

  peerConnection = new RTCPeerConnection(configuration);

  // Eventos ICE
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('webrtc-ice-candidate', {
        callId: currentCallId,
        candidate: event.candidate
      });
    }
  };

  // Stream remoto
  peerConnection.onaddstream = (event) => {
    const remoteAudio = document.getElementById('remoteAudio');
    remoteAudio.srcObject = event.stream;
  };

  // Estados de conexão
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
  };
}
```

---

## 📊 Estrutura de Dados

### Tabela: `profiles` (Usuários WebRTC)

```sql
-- Campos adicionados à tabela profiles existente
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID único do usuário |
| `full_name` | TEXT | Nome completo |
| `email` | TEXT | Email do usuário |
| `phone` | TEXT | Telefone |
| `user_type` | TEXT | Tipo: admin, porteiro, morador |
| `is_online` | BOOLEAN | Status online |
| `is_available` | BOOLEAN | Disponível para chamadas |
| `last_seen` | TIMESTAMP | Última atividade |

### Tabela: `webrtc_calls`

```sql
CREATE TABLE webrtc_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES profiles(id),
    receiver_id UUID NOT NULL REFERENCES profiles(id),
    apartment_id UUID REFERENCES apartments(id),
    status VARCHAR(20) DEFAULT 'initiated',
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    end_reason VARCHAR(50),
    webrtc_stats JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID único da chamada |
| `caller_id` | UUID | ID do usuário que iniciou |
| `receiver_id` | UUID | ID do usuário que recebeu |
| `apartment_id` | UUID | ID do apartamento (opcional) |
| `status` | VARCHAR | Estado da chamada |
| `initiated_at` | TIMESTAMP | Horário de início |
| `answered_at` | TIMESTAMP | Horário de resposta |
| `ended_at` | TIMESTAMP | Horário de encerramento |
| `duration_seconds` | INTEGER | Duração em segundos |
| `end_reason` | VARCHAR | Motivo do encerramento |
| `webrtc_stats` | JSONB | Estatísticas da conexão |

### Tabela: `webrtc_device_tokens`

```sql
CREATE TABLE webrtc_device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    token VARCHAR(500) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID único do token |
| `profile_id` | UUID | ID do usuário |
| `token` | VARCHAR | Token do dispositivo |
| `platform` | VARCHAR | Plataforma: android, ios, web |
| `is_active` | BOOLEAN | Token ativo |
| `created_at` | TIMESTAMP | Data de criação |

---

## 🧪 Testes e Validação

### 1. **Teste de Conectividade**

```bash
# Verificar se API está rodando
curl -X GET http://127.0.0.1:3001/health

# Testar endpoint sem autenticação (deve retornar 401)
curl -X GET http://127.0.0.1:3001/api/webrtc/residents
```

### 2. **Teste de Autenticação**

```javascript
// Teste com token válido
const response = await fetch('/api/webrtc/residents', {
  headers: {
    'Authorization': `Bearer ${validJwtToken}`
  }
});

console.log('Status:', response.status); // Deve ser 200
```

### 3. **Teste de Chamada Completa**

```javascript
async function testCompleteCall() {
  try {
    // 1. Iniciar chamada
    const callResponse = await fetch('/api/webrtc/call/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${porteiroToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        callerId: 'porteiro-uuid',
        receiverId: 'morador-uuid',
        callType: 'audio'
      })
    });

    const callData = await callResponse.json();
    console.log('Chamada iniciada:', callData.callId);

    // 2. Responder chamada
    const answerResponse = await fetch(`/api/webrtc/call/${callData.callId}/answer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${moradorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: 'morador-uuid'
      })
    });

    console.log('Chamada respondida:', answerResponse.status === 200);

    // 3. Simular duração da chamada
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. Encerrar chamada
    const endResponse = await fetch(`/api/webrtc/call/${callData.callId}/end`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${porteiroToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: 'porteiro-uuid',
        endReason: 'user_ended'
      })
    });

    const endData = await endResponse.json();
    console.log('Chamada encerrada. Duração:', endData.duration, 'segundos');

  } catch (error) {
    console.error('Erro no teste:', error);
  }
}
```

### 4. **Teste de Rate Limiting**

```javascript
async function testRateLimit() {
  const promises = [];
  
  // Fazer 15 chamadas simultâneas (limite é 10)
  for (let i = 0; i < 15; i++) {
    promises.push(
      fetch('/api/webrtc/call/initiate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          callerId: 'test-uuid',
          receiverId: 'target-uuid'
        })
      })
    );
  }

  const responses = await Promise.all(promises);
  const rateLimited = responses.filter(r => r.status === 429);
  
  console.log(`${rateLimited.length} chamadas bloqueadas por rate limit`);
}
```

---

## 🚨 Códigos de Erro Completos

### Erros de Autenticação (4xx)

| Código HTTP | Código Interno | Descrição |
|-------------|----------------|-----------|
| 401 | `MISSING_TOKEN` | Token de acesso não fornecido |
| 401 | `INVALID_TOKEN` | Token inválido ou expirado |
| 401 | `NOT_AUTHENTICATED` | Usuário não autenticado |
| 403 | `WEBRTC_DISABLED` | WebRTC não habilitado |
| 403 | `ADMIN_REQUIRED` | Acesso restrito a admins |
| 403 | `PORTEIRO_REQUIRED` | Acesso restrito a porteiros |
| 403 | `MORADOR_REQUIRED` | Acesso restrito a moradores |
| 404 | `USER_NOT_FOUND` | Usuário não encontrado |
| 429 | `RATE_LIMIT_EXCEEDED` | Limite de chamadas excedido |

### Erros de Validação (4xx)

| Código HTTP | Código Interno | Descrição |
|-------------|----------------|-----------|
| 400 | `MISSING_RECEIVER_ID` | ID do receptor obrigatório |
| 400 | `INVALID_CALL_TYPE` | Tipo de chamada inválido |
| 400 | `SELF_CALL_NOT_ALLOWED` | Auto-chamada não permitida |
| 404 | `CALL_NOT_FOUND` | Chamada não encontrada |
| 400 | `USER_NOT_AVAILABLE` | Usuário não disponível |

### Erros do Servidor (5xx)

| Código HTTP | Descrição |
|-------------|-----------|
| 500 | Erro interno do servidor |
| 500 | Erro de conexão com Supabase |
| 500 | Erro ao criar/atualizar chamada |

---

## 🔧 Configuração de Desenvolvimento

### Variáveis de Ambiente

```env
# Supabase
SUPABASE_URL=https://ycamhxzumzkpxuhtugxc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# WebRTC
WEBRTC_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302

# Servidor
PORT=3001
NODE_ENV=development
```

### Inicialização

```bash
# Instalar dependências
npm install

# Executar migrações Supabase
npm run db:migrate

# Iniciar servidor de desenvolvimento
npm run dev

# Executar testes
npm run test:webrtc
```

---

## 📝 Notas Importantes

1. **Segurança**: Todos os endpoints requerem autenticação JWT válida
2. **Rate Limiting**: Máximo de 10 chamadas por minuto por usuário
3. **WebSocket**: Necessário para sinalização WebRTC em tempo real
4. **STUN Servers**: Usando servidores gratuitos do Google (produção deve usar TURN servers próprios)
5. **Logs**: Todos os eventos são logados para auditoria
6. **RLS**: Row Level Security habilitado em todas as tabelas
7. **Permissões**: Diferentes níveis de acesso por tipo de usuário

---

## 🆘 Suporte e Troubleshooting

### Problemas Comuns

1. **Token Expirado**: Renovar token JWT do Supabase
2. **WebSocket Desconectado**: Implementar reconexão automática
3. **ICE Candidates Falham**: Verificar configuração de rede/firewall
4. **Áudio Não Funciona**: Verificar permissões de microfone no browser
5. **Rate Limit**: Aguardar 1 minuto antes de nova tentativa

### Debug

```javascript
// Habilitar logs detalhados
localStorage.setItem('webrtc-debug', 'true');

// Verificar status da conexão
console.log('WebRTC State:', peerConnection.connectionState);
console.log('ICE State:', peerConnection.iceConnectionState);
console.log('Signaling State:', peerConnection.signalingState);
```

---

**Versão da Documentação**: 1.0  
**Última Atualização**: Janeiro 2024  
**Autor**: James Avisa Development Team
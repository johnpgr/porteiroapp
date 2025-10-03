# JamesAvisa WhatsApp API

API responsável pelo envio exclusivo de mensagens WhatsApp para moradores do JamesAvisa e sistema de interfone WebRTC.

## 📋 Descrição

Esta API foi desenvolvida especificamente para o JamesAvisa e é responsável por:
- Enviar mensagens WhatsApp para moradores
- Gerar links de cadastro personalizados
- Validar dados de moradores
- Integrar com a Evolution API para envio de mensagens
- **Sistema de Interfone WebRTC**: Comunicação de voz em tempo real entre porteiro e morador

## 🚀 Instalação

1. Clone o repositório:
```bash
git clone <repository-url>
cd notification-api-main
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente (veja seção [Configuração](#configuração))

4. Inicie a API:
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## ⚙️ Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Evolution API Configuration
EVOLUTION_BASE_URL=http://127.0.0.1:8080
EVOLUTION_API_KEY=sua_api_key_aqui
EVOLUTION_INSTANCE=default

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration (opcional)
ALLOWED_ORIGINS=http://127.0.0.1:3000,https://JamesAvisa.com
```

### Variáveis Obrigatórias:
- `EVOLUTION_BASE_URL`: URL base da Evolution API
- `EVOLUTION_API_KEY`: Chave de API da Evolution
- `EVOLUTION_INSTANCE`: Nome da instância do WhatsApp

## 📡 Endpoints

### Health Check
```http
GET /health
```

**Resposta:**
```json
{
  "status": "OK",
  "timestamp": "2025-08-22T14:26:47.513Z",
  "service": "JamesAvisa WhatsApp API",
  "version": "1.0.0"
}
```

### Informações da API
```http
GET /
```

**Resposta:**
```json
{
  "message": "JamesAvisa WhatsApp API",
  "description": "API responsável pelo envio de mensagens WhatsApp para moradores",
  "endpoints": {
    "health": "GET /health",
    "sendWhatsApp": "POST /api/send-resident-whatsapp"
  },
  "version": "1.0.0"
}
```

### Enviar WhatsApp para Morador
```http
POST /api/send-resident-whatsapp
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "name": "João Silva",
  "phone": "91981941219",
  "building": "Edifício Central",
  "apartment": "101",
  "registrationUrl": "https://jamesavisa.jamesconcierge.com/" // opcional
}
```

**Campos Obrigatórios:**
- `name`: Nome do morador (string, mínimo 1 caractere)
- `phone`: Telefone do morador (string, mínimo 10 dígitos)
- `building`: Nome/número do prédio (string, mínimo 1 caractere)
- `apartment`: Número do apartamento (string, mínimo 1 caractere)

**Campos Opcionais:**
- `registrationUrl`: URL de cadastro personalizada (padrão: "https://jamesavisa.jamesconcierge.com/")

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "whatsappSent": true,
  "message": "Mensagem WhatsApp enviada com sucesso",
  "data": {
    "name": "João Silva",
    "phone": "5591981941219",
    "building": "Edifício Central",
    "apartment": "101",
    "registrationLink": "https://jamesavisa.jamesconcierge.com/?name=Jo%C3%A3o+Silva&phone=91981941219&building=Edif%C3%ADcio+Central&apartment=101"
  },
  "timestamp": "2025-08-22T14:30:00.000Z",
  "duration": "1.2s"
}
```

**Resposta de Erro de Validação (400):**
```json
{
  "success": false,
  "whatsappSent": false,
  "error": "Dados inválidos",
  "details": [
    "name: Nome é obrigatório",
    "phone: Telefone deve ter pelo menos 10 dígitos"
  ],
  "timestamp": "2025-08-22T14:30:00.000Z",
  "duration": "5ms"
}
```

**Resposta de Erro de Configuração (500):**
```json
{
  "success": false,
  "whatsappSent": false,
  "error": "EVOLUTION_API_KEY não configurado",
  "timestamp": "2025-08-22T14:30:00.000Z",
  "duration": "5ms"
}
```

## 📱 Exemplo de Mensagem Enviada

A API gera automaticamente uma mensagem formatada como:

```
🏢 *JamesAvisa - Cadastro de Morador*

Olá *João Silva*!

Você foi convidado(a) para se cadastrar no JamesAvisa.

📍 *Dados do seu apartamento:*
🏢 Prédio: Edifício Central
🚪 Apartamento: 101

Para completar seu cadastro, clique no link abaixo:
https://jamesavisa.jamesconcierge.com/?name=João+Silva&phone=91981941219&building=Edifício+Central&apartment=101

Com o JamesAvisa você pode:
✅ Receber visitantes com mais segurança
✅ Autorizar entregas remotamente
✅ Comunicar-se diretamente com a portaria
✅ Acompanhar movimentações do seu apartamento

_Mensagem enviada automaticamente pelo sistema JamesAvisa_
```

## 🧪 Testando a API

### API WhatsApp

#### Usando curl (Linux/Mac):
```bash
# Health check
curl http://127.0.0.1:3001/health

# Enviar mensagem
curl -X POST http://127.0.0.1:3001/api/send-resident-whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "phone": "91981941219",
    "building": "Edifício Central",
    "apartment": "101"
  }'
```

#### Usando PowerShell (Windows):
```powershell
# Health check
Invoke-WebRequest -Uri "http://127.0.0.1:3001/health"

# Enviar mensagem
Invoke-WebRequest -Uri "http://127.0.0.1:3001/api/send-resident-whatsapp" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{
    "name": "João Silva",
    "phone": "91981941219",
    "building": "Edifício Central",
    "apartment": "101"
  }'
```

### 📞 Testando o Sistema de Interfone

#### Interface de Teste Manual:
1. **Inicie o servidor**: `npm start`
2. **Acesse a interface**: `http://localhost:3001/tests/manual/webrtc-test-interface.html`
3. **Teste as funcionalidades**:
   - Conectar como Porteiro ou Morador
   - Iniciar chamada de voz
   - Testar controles de volume e mute
   - Verificar indicadores de conexão
   - Monitorar qualidade de áudio

#### Fluxo de Teste:
```
1. Abra duas abas do navegador
2. Aba 1: Conecte como "Porteiro"
3. Aba 2: Conecte como "Morador"
4. No Porteiro: Clique "Iniciar Chamada"
5. No Morador: Aceite a chamada
6. Teste a comunicação de voz
7. Use controles de volume/mute
8. Encerre a chamada
```

#### Verificação de Conectividade:
- **WebSocket**: Verifique conexão em `ws://localhost:3001/socket.io/`
- **STUN/TURN**: Testa atravessamento de NAT/Firewall
- **Áudio**: Verifica captura e reprodução de áudio
- **Latência**: Monitora qualidade da conexão em tempo real

## 📞 Sistema de Interfone WebRTC

O JamesAvisa inclui um sistema completo de interfone baseado em WebRTC para comunicação de voz entre porteiro e morador.

### Características:
- **Áudio apenas**: Sistema otimizado para chamadas de voz (sem vídeo)
- **Baixa latência**: Configurado para comunicação em tempo real
- **Atravessa NAT/Firewall**: Utiliza servidores STUN/TURN
- **Interface de teste**: Página HTML para testes manuais
- **Notificações WhatsApp**: Integração com notificações de chamadas

### Acesso ao Sistema:
- **Interface de Teste**: `http://localhost:3001/tests/manual/webrtc-test-interface.html`
- **WebSocket**: `ws://localhost:3001/socket.io/`
- **Endpoints WebRTC**: `/api/webrtc/*`

### Funcionalidades:
- ✅ Chamadas de voz entre porteiro e morador
- ✅ Controles de volume e mute/unmute
- ✅ Indicadores visuais de conexão e qualidade de áudio
- ✅ Monitoramento de nível de áudio em tempo real
- ✅ Testes automatizados de conectividade

## 🏗️ Arquitetura

```
notification-api-main/
├── index.js                 # Servidor principal
├── package.json            # Dependências e scripts
├── README.md              # Documentação
├── .env                   # Variáveis de ambiente
├── tests/
│   └── manual/
│       └── webrtc-test-interface.html # Interface de teste do interfone
└── src/
    ├── routes/
    │   ├── sendNotification.js    # Rotas da API
    │   └── webrtcRoutes.js       # Rotas WebRTC
    ├── services/
    │   ├── whatsappService.js         # Integração com Evolution API
    │   ├── webrtcSignalingService.js  # Sinalização WebRTC
    │   └── webrtcNotificationService.js # Notificações de chamadas
    ├── controllers/
    │   └── webrtcController.js    # Controlador WebRTC
    ├── config/
    │   └── webrtcConfig.js       # Configurações WebRTC
    ├── validators/
    │   └── notificationValidator.js # Validação de dados
    └── utils/
        └── messageFormatter.js    # Formatação de mensagens
```

## 🔧 Dependências

- **express**: Framework web para Node.js
- **cors**: Middleware para CORS
- **morgan**: Logger de requisições HTTP
- **zod**: Validação de esquemas
- **axios**: Cliente HTTP para Evolution API
- **dotenv**: Carregamento de variáveis de ambiente
- **nodemon**: Desenvolvimento com hot reload

## 🚨 Tratamento de Erros

A API possui tratamento robusto de erros:

- **Validação de dados**: Campos obrigatórios e formatos
- **Configuração**: Verificação de variáveis de ambiente
- **Evolution API**: Tratamento de erros de conexão e API
- **Números de telefone**: Validação de formato brasileiro
- **Rate limiting**: Controle de frequência de envio

## 📊 Logs

A API gera logs detalhados:
- Requisições HTTP (via Morgan)
- Configuração da Evolution API
- Erros e exceções
- Status de envio de mensagens

## 🔒 Segurança

- CORS configurável
- Validação rigorosa de entrada
- Não exposição de dados sensíveis nos logs
- Tratamento seguro de erros

## 📈 Monitoramento

- Health check endpoint (`/health`)
- Logs estruturados
- Timestamps em todas as respostas
- Duração de processamento

## 🤝 Integração com JamesAvisa

Esta API foi projetada para ser consumida pelo aplicativo principal do JamesAvisa, substituindo a integração direta com a Evolution API e centralizando o envio de mensagens WhatsApp.

## 📝 Licença

ISC
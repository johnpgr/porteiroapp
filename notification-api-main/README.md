# JamesAvisa WhatsApp API

API responsável pelo envio exclusivo de mensagens WhatsApp para moradores do JamesAvisa.

## 📋 Descrição

Esta API foi desenvolvida especificamente para o JamesAvisa e é responsável por:
- Enviar mensagens WhatsApp para moradores
- Gerar links de cadastro personalizados
- Validar dados de moradores
- Integrar com a Evolution API para envio de mensagens

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

### Usando curl (Linux/Mac):
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

### Usando PowerShell (Windows):
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

## 🏗️ Arquitetura

```
notification-api-main/
├── index.js                 # Servidor principal
├── package.json            # Dependências e scripts
├── README.md              # Documentação
├── .env                   # Variáveis de ambiente
└── src/
    ├── routes/
    │   └── sendNotification.js    # Rotas da API
    ├── services/
    │   └── whatsappService.js     # Integração com Evolution API
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
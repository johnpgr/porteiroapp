# 📱 Notification API - Evolution WhatsApp

API para envio de notificações via **E-mail (Resend)** e **WhatsApp (Evolution API)**.

## 🚀 Configuração

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp env.example .env
```

Preencha o `.env`:
```env
PORT=3000

# Resend (E-mail)
RESEND_API_KEY=re_xxxxxxxxxxxxxxx
RESEND_FROM="Digital Paisagismo <noreply@digitalpaisagismo.com>"

# Evolution API (WhatsApp)
EVOLUTION_BASE_URL=http://localhost:8080
EVOLUTION_INSTANCE=default
EVOLUTION_API_KEY=sua_api_key_aqui

# Para desabilitar WhatsApp temporariamente
# WHATSAPP_DISABLED=true
```

### 3. Executar
```bash
npm run dev    # desenvolvimento
npm start      # produção
```

## 📡 Endpoints

### POST `/api/send-notification`
Envia notificação via e-mail e/ou WhatsApp.

**Body:**
```json
{
  "recipient": {
    "email": "cliente@email.com",
    "name": "João Silva", 
    "phone": "11999999999"
  },
  "message": "Seu projeto foi atualizado!",
  "subject": "Atualização do projeto",
  "type": "client",
  "channels": {
    "email": true,
    "whatsapp": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "emailSent": true,
  "whatsappSent": true,
  "errors": []
}
```

### GET `/api/whatsapp-status`
Verifica status da instância WhatsApp.

**Response:**
```json
{
  "connected": true,
  "state": "open",
  "instance": "default"
}
```

### GET `/health`
Health check da API.

## 🔧 Evolution API Setup

### Instalação da Evolution API

1. **Clone o repositório:**
```bash
git clone https://github.com/EvolutionAPI/evolution-api.git
cd evolution-api
```

2. **Configure o Docker:**
```bash
cp Docker/.env.example Docker/.env
# Edite Docker/.env conforme necessário
```

3. **Execute:**
```bash
docker-compose -f Docker/docker-compose.yaml up -d
```

4. **Acesse:** http://localhost:8080

### Configuração da Instância

1. **Criar instância:**
```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: sua_api_key" \
  -d '{
    "instanceName": "default",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

2. **Conectar WhatsApp:**
   - Acesse: http://localhost:8080/instance/connect/default
   - Escaneie o QR Code com o WhatsApp
   - Aguarde status "open"

3. **Verificar status:**
```bash
curl -X GET http://localhost:8080/instance/connectionState/default \
  -H "apikey: sua_api_key"
```

## 💰 Custos e Comparação

### Evolution API (RECOMENDADO)
- **Custo:** GRATUITO (self-hosted)
- **Infraestrutura:** VPS/Servidor próprio (~$5-20/mês)
- **Mensagens:** Ilimitadas
- **Setup:** Médio (Docker + WhatsApp Business)
- **Controle:** Total

### Twilio (Anterior)
- **Custo:** $0.0075 por mensagem
- **Infraestrutura:** Zero (SaaS)
- **Mensagens:** Pay-per-use
- **Setup:** Fácil (mas precisa aprovação Meta)
- **Controle:** Limitado

### Exemplo de Economia:
- **1.000 mensagens/mês:**
  - Twilio: $7.50/mês + aprovações
  - Evolution: $0/mês (apenas VPS)
- **10.000 mensagens/mês:**
  - Twilio: $75/mês
  - Evolution: $0/mês

## 🔄 Como Funcionam os Disparos

### Evolution API
1. **Conexão:** WhatsApp conectado via QR Code
2. **Envio:** API REST para instância local
3. **Entrega:** Direto pelo WhatsApp Business
4. **Status:** Tempo real via webhooks
5. **Limite:** Definido pelo WhatsApp (não pela Evolution)

### Fluxo de Envio:
```
Frontend → Notification API → Evolution API → WhatsApp → Destinatário
```

### Vantagens Evolution:
- ✅ Sem custos por mensagem
- ✅ Controle total da infraestrutura  
- ✅ Suporte a múltiplas instâncias
- ✅ Webhooks para status
- ✅ API REST completa
- ✅ Suporte a mídias, grupos, etc.

### Limitações:
- ⚠️ Precisa manter servidor online
- ⚠️ Respeitar limites do WhatsApp Business
- ⚠️ Reconexão manual se desconectar

## 🛠️ Troubleshooting

### WhatsApp não conecta
```bash
# Verificar logs da Evolution
docker logs evolution-api

# Recriar instância
curl -X DELETE http://localhost:8080/instance/delete/default -H "apikey: sua_key"
curl -X POST http://localhost:8080/instance/create -H "apikey: sua_key" -d '{"instanceName":"default"}'
```

### Mensagens não chegam
1. Verificar se instância está "open"
2. Testar número no formato correto (5511999999999)
3. Verificar se não está em spam
4. Respeitar limite de mensagens do WhatsApp

### API não responde
```bash
# Verificar se Evolution está rodando
curl http://localhost:8080/instance/fetchInstances -H "apikey: sua_key"

# Reiniciar se necessário
docker-compose -f Docker/docker-compose.yaml restart
``` 
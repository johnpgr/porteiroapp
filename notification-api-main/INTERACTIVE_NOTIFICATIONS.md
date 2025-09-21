# Sistema de Notificações Interativas WhatsApp

Este documento descreve o sistema de notificações interativas implementado na API, que permite aos usuários gerenciar notificações do porteiro diretamente pelo WhatsApp usando botões e listas interativas.

## 🚀 Funcionalidades Implementadas

### 1. Webhook para Processar Respostas
- **Endpoint**: `POST /api/whatsapp-webhook`
- **Funcionalidade**: Processa respostas de botões e listas interativas do WhatsApp
- **Atualiza**: `notification_status` e `delivery_destination` na tabela `visitor_logs`

### 2. Envio de Mensagens com Botões Interativos
- **Endpoint**: `POST /api/interactive/send-interactive-notification`
- **Funcionalidade**: Envia notificações com botões específicos baseados no tipo de visita
- **Suporte**: Botões e listas interativas

### 3. Botões Específicos por Tipo de Notificação

#### Visitas/Entregas Gerais:
- **"Aceitar"** → Atualiza `notification_status` para `approved`
- **"Recusar"** → Atualiza `notification_status` para `rejected`

#### Entregas Específicas:
- **"Enviar pelo elevador"** → Atualiza `delivery_destination` para `elevator`
- **"Deixar na portaria"** → Atualiza `delivery_destination` para `reception`

## 📋 Endpoints Disponíveis

### 1. Notificação Interativa Automática
```http
POST /api/interactive/send-interactive-notification
Content-Type: application/json

{
  "phoneNumber": "+5511999999999",
  "visitorName": "João Silva",
  "apartmentNumber": "101",
  "visitType": "visitor", // ou "delivery"
  "tokenId": "unique-token-id",
  "useList": false // true para lista, false para botões
}
```

### 2. Botões Customizados
```http
POST /api/interactive/send-custom-buttons
Content-Type: application/json

{
  "phoneNumber": "+5511999999999",
  "message": "Sua mensagem personalizada",
  "buttons": [
    {
      "id": "accept",
      "title": "Aceitar"
    },
    {
      "id": "reject",
      "title": "Recusar"
    }
  ],
  "tokenId": "unique-token-id"
}
```

### 3. Lista Customizada
```http
POST /api/interactive/send-custom-list
Content-Type: application/json

{
  "phoneNumber": "+5511999999999",
  "message": "Sua mensagem personalizada",
  "listItems": [
    {
      "id": "option1",
      "title": "Opção 1",
      "description": "Descrição da opção 1"
    },
    {
      "id": "option2",
      "title": "Opção 2",
      "description": "Descrição da opção 2"
    }
  ],
  "title": "Selecione uma opção",
  "tokenId": "unique-token-id"
}
```

### 4. Teste de Conectividade
```http
GET /api/interactive/test
```

## 🔄 Fluxo de Funcionamento

1. **Envio da Notificação**:
   - Sistema chama endpoint de notificação interativa
   - API gera mensagem com botões/lista baseada no `visitType`
   - Mensagem é enviada via WhatsApp com botões interativos

2. **Resposta do Usuário**:
   - Usuário clica em um botão no WhatsApp
   - WhatsApp envia webhook para `/api/whatsapp-webhook`
   - API processa a resposta e identifica a ação

3. **Atualização do Banco**:
   - Sistema atualiza `visitor_logs` com base na ação:
     - `notification_status`: `approved` ou `rejected`
     - `delivery_destination`: `elevator` ou `reception`
   - Confirmação é enviada ao usuário

## 🛠️ Configuração Técnica

### Variáveis de Ambiente Necessárias
```env
# Evolution API
EVOLUTION_API_BASE_URL=https://sua-evolution-api.com
EVOLUTION_API_TOKEN=seu-token-aqui
EVOLUTION_API_INSTANCE=sua-instancia

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

### Estrutura da Tabela `visitor_logs`
```sql
-- Campos relevantes para o sistema interativo
notification_status VARCHAR -- 'pending', 'approved', 'rejected'
delivery_destination VARCHAR -- 'elevator', 'reception'
resident_response_at TIMESTAMP
rejection_reason TEXT
```

## 📱 Exemplos de Mensagens

### Visita Geral
```
🔔 Nova visita para Apartamento 101

Visitante: João Silva
Data: 08/09/2025 às 14:30

O que deseja fazer?

[Aceitar] [Recusar]
```

### Entrega
```
📦 Nova entrega para Apartamento 101

Para: Maria Santos
Data: 08/09/2025 às 15:45

Onde deseja receber?

[Enviar pelo elevador] [Deixar na portaria]
```

## ✅ Validações Implementadas

- ✅ Validação de dados obrigatórios
- ✅ Verificação de formato de botões/listas
- ✅ Validação de token de autorização
- ✅ Verificação de status da instância WhatsApp
- ✅ Tratamento de erros da Evolution API
- ✅ Logs detalhados para debugging
- ✅ Atualização segura do banco de dados
- ✅ Confirmação de ações para o usuário

## 🔍 Logs e Monitoramento

O sistema gera logs detalhados para:
- Envio de mensagens interativas
- Processamento de respostas de webhook
- Atualizações no banco de dados
- Erros e exceções

## 🚨 Tratamento de Erros

- **401**: Token inválido ou expirado
- **404**: Instância não encontrada
- **400**: Dados inválidos ou malformados
- **500**: Erro interno do servidor

Todos os erros são logados e retornam mensagens apropriadas para o cliente.

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do servidor
2. Teste a conectividade com `/api/interactive/test`
3. Valide as configurações da Evolution API
4. Confirme as perm
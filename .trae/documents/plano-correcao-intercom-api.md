# 🔧 Plano de Correção - Integração IntercomModal com API WebRTC

## 📋 Análise do Problema

### ❌ **Problema Identificado**
- **IntercomModal.tsx** está usando URL local: `http://127.0.0.1:3001`
- **Deveria usar** URL de produção: `https://jamesavisaapi.jamesconcierge.com`
- **Endpoint inexistente**: `/api/webrtc/intercom` não existe na API de produção
- **Erro**: `Network request failed` - não consegue conectar com servidor local

### 🔍 **Documentação da API Analisada**
Conforme a documentação oficial da API em `https://jamesavisaapi.jamesconcierge.com`:

**Endpoints WebRTC Disponíveis:**
- ✅ `GET /api/webrtc/residents` - Listar moradores
- ✅ `POST /api/webrtc/call/initiate` - Iniciar chamada
- ✅ `POST /api/webrtc/call/:callId/answer` - Atender chamada
- ✅ `POST /api/webrtc/call/:callId/end` - Encerrar chamada
- ✅ `GET /api/webrtc/buildings` - Listar prédios
- ✅ `GET /api/webrtc/apartments/:number/residents` - Moradores do apartamento

**❌ Endpoint NÃO EXISTE:**
- `/api/webrtc/intercom` - **NÃO DOCUMENTADO**

## 🎯 Plano de Correção

### **Fase 1: Configuração da URL Base**
1. **Atualizar IntercomModal.tsx** para usar variável de ambiente
2. **Usar** `process.env.EXPO_PUBLIC_NOTIFICATION_API_URL`
3. **Remover** URL hardcoded `http://127.0.0.1:3001`

### **Fase 2: Correção do Endpoint**
1. **Substituir** `/api/webrtc/intercom` por `/api/webrtc/call/initiate`
2. **Ajustar parâmetros** conforme documentação da API
3. **Implementar** lógica para chamadas de apartamento

### **Fase 3: Adaptação dos Parâmetros**
**Endpoint Original (não existe):**
```json
POST /api/webrtc/intercom
{
  "callerId": "uuid",
  "apartmentNumber": "101",
  "buildingId": "uuid"
}
```

**Endpoint Correto (existe):**
```json
POST /api/webrtc/call/initiate
{
  "callerId": "uuid",
  "receiverId": "uuid",
  "callType": "audio"
}
```

### **Fase 4: Implementação da Lógica de Apartamento**
1. **Buscar moradores** usando `GET /api/webrtc/apartments/:number/residents`
2. **Criar chamadas individuais** para cada morador
3. **Gerenciar múltiplas chamadas** simultaneamente

## 🛠️ Implementação Detalhada

### **1. Correção da URL Base**
```typescript
// ❌ ANTES (hardcoded)
const response = await fetch('http://127.0.0.1:3001/api/webrtc/intercom', {

// ✅ DEPOIS (usando env)
const API_BASE_URL = process.env.EXPO_PUBLIC_NOTIFICATION_API_URL;
const response = await fetch(`${API_BASE_URL}/api/webrtc/call/initiate`, {
```

### **2. Nova Lógica de Chamada de Apartamento**
```typescript
// 1. Buscar moradores do apartamento
const residentsResponse = await fetch(
  `${API_BASE_URL}/api/webrtc/apartments/${apartmentNumber}/residents`
);

// 2. Para cada morador, criar uma chamada
const residents = await residentsResponse.json();
const callPromises = residents.map(resident => 
  fetch(`${API_BASE_URL}/api/webrtc/call/initiate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      callerId: user.id,
      receiverId: resident.id,
      callType: 'audio'
    })
  })
);

// 3. Executar todas as chamadas simultaneamente
const results = await Promise.allSettled(callPromises);
```

### **3. Tratamento de Erros Específicos**
```typescript
// Verificar se API está acessível
if (!response.ok) {
  if (response.status === 404) {
    throw new Error('Apartamento não encontrado');
  } else if (response.status === 401) {
    throw new Error('Não autorizado');
  } else if (response.status === 500) {
    throw new Error('Erro interno do servidor');
  }
}
```

## ✅ Checklist de Correções

### **Configuração**
- [ ] Verificar se `EXPO_PUBLIC_NOTIFICATION_API_URL` está definida no `.env`
- [ ] Confirmar que a URL aponta para `https://jamesavisaapi.jamesconcierge.com`
- [ ] Testar conectividade com a API de produção

### **Código**
- [ ] Substituir URL hardcoded por variável de ambiente
- [ ] Trocar endpoint `/api/webrtc/intercom` por `/api/webrtc/call/initiate`
- [ ] Implementar busca de moradores por apartamento
- [ ] Criar lógica para múltiplas chamadas simultâneas
- [ ] Ajustar tratamento de erros

### **Testes**
- [ ] Testar conectividade com API de produção
- [ ] Validar autenticação com token Bearer
- [ ] Testar busca de moradores por apartamento
- [ ] Testar criação de chamadas múltiplas
- [ ] Verificar tratamento de erros

## 🚀 Próximos Passos

1. **Implementar correções** no IntercomModal.tsx
2. **Testar** conectividade com API de produção
3. **Validar** funcionalidade completa do interfone
4. **Documentar** mudanças para equipe

## ⚠️ Observações Importantes

- **API de produção** não tem endpoint `/api/webrtc/intercom`
- **Necessário** implementar lógica de apartamento usando endpoints existentes
- **Múltiplas chamadas** devem ser gerenciadas simultaneamente
- **Autenticação** deve usar token Bearer válido
- **Tratamento de erros** deve ser robusto para produção

---

**Status**: 🔴 **CRÍTICO** - Correção necessária para funcionamento
**Prioridade**: 🔥 **ALTA** - Implementar imediatamente
**Estimativa**: ⏱️ **30-45 minutos** para implementação completa
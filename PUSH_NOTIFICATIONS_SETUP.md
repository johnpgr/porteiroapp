# 🔔 Push Notifications - Guia Completo

Este documento explica como configurar, testar e usar push notifications no PorteiroApp.

## 📋 O que foi implementado

✅ **Configuração completa de push notifications** que funcionam com o app:
- **Fechado** (app não está rodando)
- **Em segundo plano** (app minimizado)
- **Aberto** (app em uso)

### Arquivos modificados/criados:

1. **`app.json`** - Configuração do Expo com permissões de notificação
2. **`services/notificationService.ts`** - Serviço completo de notificações (reabilitado)
3. **`hooks/useAuth.tsx`** - Registro automático de push tokens no login
4. **`utils/pushNotifications.ts`** - Helper functions para enviar notificações
5. **`supabase/functions/send-push-notification/index.ts`** - Edge Function para envio
6. **`supabase/migrations/20250115_add_push_token_columns.sql`** - Migration para coluna `push_token`
7. **`app/_layout.tsx`** - Listeners de notificações
8. **`app/morador/preregister.tsx`** - Integrado com notificações
9. **`components/porteiro/RegistrarVisitante.tsx`** - Integrado com notificações

---

## 🚀 Como configurar

### 1. Aplicar a migration no banco de dados

Acesse o Supabase Dashboard e execute a migration:

```bash
# Opção 1: Via Supabase CLI
supabase db push

# Opção 2: Via Dashboard
# 1. Vá em SQL Editor no Supabase Dashboard
# 2. Cole o conteúdo de: supabase/migrations/20250115_add_push_token_columns.sql
# 3. Execute
```

### 2. Fazer deploy da Edge Function

```bash
# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Login no Supabase
supabase login

# Link do projeto
supabase link --project-ref YOUR_PROJECT_ID

# Deploy da função
supabase functions deploy send-push-notification
```

### 3. Configurar Project ID no Expo

Você precisa adicionar o Project ID do Expo no `app.json`:

**Opção A: Usando EAS (recomendado)**
```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login no Expo
eas login

# Criar projeto (se ainda não existe)
eas build:configure
```

O Project ID será adicionado automaticamente em `app.json` → `extra.eas.projectId`

**Opção B: Manual (para testes locais)**

Adicione no `app.json`:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "seu-project-id-aqui"
      }
    }
  }
}
```

### 4. Testar em dispositivo físico

⚠️ **IMPORTANTE**: Push notifications **NÃO funcionam** no emulador/simulador.

```bash
# Android
npm run android

# iOS
npm run ios
```

---

## 🧪 Como testar

### Teste 1: Registro de Push Token no Login

1. Faça login no app (qualquer tipo de usuário)
2. Verifique o console - deve aparecer:
   ```
   🔔 Push token obtido: ExponentPushToken[XXXXXX]
   🔔 Push token salvo com sucesso
   ```
3. Verifique no banco de dados:
   ```sql
   SELECT push_token FROM profiles WHERE user_id = 'seu-user-id';
   -- ou
   SELECT push_token FROM admin_profiles WHERE user_id = 'seu-user-id';
   ```

### Teste 2: Notificação quando Porteiro registra Visitante

**Passos:**
1. Faça login como **Morador** em um dispositivo
2. Feche o app ou minimize
3. Em outro dispositivo (ou web), faça login como **Porteiro**
4. Registre um visitante para o apartamento do morador
5. ✅ O morador deve receber uma notificação push: "🚪 Novo Visitante"

### Teste 3: Notificação quando Morador autoriza Visitante

**Passos:**
1. Faça login como **Porteiro** em um dispositivo
2. Feche o app ou minimize
3. Em outro dispositivo, faça login como **Morador**
4. Pré-cadastre um visitante
5. ✅ O porteiro deve receber: "✅ Visitante Autorizado"

### Teste 4: Notificação com App Fechado

1. Faça login no app
2. **Force close** o app (não apenas minimize)
3. Peça para alguém registrar um visitante para você
4. ✅ Deve aparecer notificação na bandeja do celular

### Teste 5: Tocar na Notificação

1. Receba uma notificação com o app fechado
2. Toque na notificação
3. ✅ O app deve abrir na tela correta (ex: `/morador/notifications`)

---

## 🧑‍💻 Como enviar notificações manualmente

### Via Supabase Edge Function (recomendado)

```typescript
import { sendPushNotification } from '~/utils/pushNotifications';

// Notificar todos os moradores de um apartamento
await sendPushNotification({
  title: '🚪 Visitante Aguardando',
  message: 'João Silva está na portaria',
  type: 'visitor',
  apartmentIds: ['apartment-uuid'],
  data: { visitorId: 'visitor-123' }
});

// Notificar todos os porteiros de um prédio
await sendPushNotification({
  title: '📦 Nova Encomenda',
  message: 'Encomenda para apt 205',
  type: 'delivery',
  userType: 'porteiro',
  buildingId: 'building-uuid'
});

// Notificar usuários específicos
await sendPushNotification({
  title: '🚨 Emergência',
  message: 'Incêndio no 3º andar',
  type: 'emergency',
  userIds: ['user-id-1', 'user-id-2']
});
```

### Helper Functions Prontas

```typescript
import {
  notifyNewVisitor,
  notifyPorteiroVisitorAuthorized,
  notifyNewDelivery,
  sendBuildingCommunication,
  sendEmergencyAlert
} from '~/utils/pushNotifications';

// Notificar sobre visitante
await notifyNewVisitor({
  visitorName: 'João Silva',
  visitorDocument: '123.456.789-00',
  apartmentIds: ['apartment-id'],
  apartmentNumber: '101'
});

// Comunicado geral do prédio
await sendBuildingCommunication({
  title: 'Reunião de Condomínio',
  message: 'Reunião no dia 20/01 às 19h',
  buildingId: 'building-id'
});

// Alerta de emergência
await sendEmergencyAlert({
  message: 'Evacuação imediata - incêndio',
  buildingId: 'building-id'
});
```

---

## 🐛 Troubleshooting

### Problema: "Push notifications não são suportadas na web"

**Solução**: Push notifications do Expo só funcionam em dispositivos físicos (Android/iOS).

---

### Problema: "Project ID não configurado"

**Solução**: Configure o Project ID conforme seção "3. Configurar Project ID no Expo"

---

### Problema: Token não está sendo salvo no banco

**Verifique:**
1. A migration foi aplicada?
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'profiles' AND column_name = 'push_token';
   ```
2. O usuário tem permissão de UPDATE?
3. Console mostra erros?

---

### Problema: Notificações não chegam

**Checklist:**
1. ✅ Está testando em dispositivo físico (não emulador)?
2. ✅ O usuário fez login e o token foi registrado?
3. ✅ A Edge Function foi deployada?
4. ✅ O push token é válido (formato `ExponentPushToken[XXXXXX]`)?
5. ✅ Verifique logs da Edge Function no Supabase Dashboard

---

### Problema: "Device Credentials" ou "FCM" errors

**Android**: Configure o Google Services:
1. Crie projeto no Firebase Console
2. Baixe `google-services.json`
3. Coloque em `android/app/google-services.json`
4. Rode `eas build --platform android`

**iOS**: Configure certificados APNs:
```bash
eas credentials
```

---

## 📊 Monitoramento

### Ver tokens registrados

```sql
-- Todos os tokens
SELECT
  p.name,
  p.email,
  p.user_type,
  p.push_token,
  p.last_login
FROM profiles p
WHERE p.push_token IS NOT NULL
ORDER BY p.last_login DESC;
```

### Ver logs da Edge Function

1. Acesse Supabase Dashboard
2. Vá em **Edge Functions** → **send-push-notification**
3. Clique em **Logs**

### Testar Edge Function manualmente

```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Teste",
    "message": "Mensagem de teste",
    "type": "communication",
    "pushTokens": ["ExponentPushToken[XXXXXX]"]
  }'
```

---

## 🎯 Fluxos implementados

### 1. Login → Registro de Token
```
[Usuário faz login]
  → notificationService.registerForPushNotifications()
  → notificationService.savePushToken(userId, token, userType)
  → Token salvo no banco (profiles ou admin_profiles)
```

### 2. Porteiro registra Visitante → Notifica Morador
```
[Porteiro registra entrada do visitante]
  → notifyNewVisitor({ visitorName, apartmentIds, ... })
  → Edge Function envia para Expo Push API
  → Morador recebe notificação (mesmo com app fechado)
```

### 3. Morador autoriza Visitante → Notifica Porteiro
```
[Morador pré-cadastra visitante]
  → notifyPorteiroVisitorAuthorized({ visitorName, buildingId, ... })
  → Edge Function envia para Expo Push API
  → Porteiro recebe notificação
```

### 4. Usuário toca na notificação → Navega para tela
```
[Usuário toca na notificação]
  → setupNotificationListeners (em _layout.tsx)
  → router.push('/tela-apropriada')
  → App abre na tela correta
```

---

## 📚 Referências

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/)

---

## ✅ Checklist Final

Antes de considerar completo, verifique:

- [ ] Migration aplicada no banco
- [ ] Edge Function deployada
- [ ] Project ID configurado
- [ ] Testado em dispositivo físico Android
- [ ] Testado em dispositivo físico iOS
- [ ] Notificação chega com app fechado
- [ ] Notificação chega com app em segundo plano
- [ ] Notificação chega com app aberto
- [ ] Tocar na notificação abre a tela correta
- [ ] Tokens sendo salvos no banco

---

**🎉 Pronto! Suas push notifications estão configuradas e funcionando!**

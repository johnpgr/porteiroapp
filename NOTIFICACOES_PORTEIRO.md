# 🔔 Sistema de Notificações do Porteiro

## ✅ Implementações Concluídas

### 1. **Serviço de Notificações Push** (`services/notificationService.ts`)
- ✅ Registro automático de push tokens
- ✅ Suporte para iOS, Android e Web
- ✅ Configuração de canais de notificação Android
- ✅ Envio de notificações via Supabase Edge Function

### 2. **Edge Function** (`supabase/functions/send-push-notification/index.ts`)
- ✅ Busca tokens por `userType` (porteiro, morador, admin)
- ✅ Filtros por `buildingId` para notificações específicas do prédio
- ✅ Envio em lote (100 notificações por request)
- ✅ Integração com Expo Push API

### 3. **Hook de Notificações do Porteiro** (`hooks/usePorteiroNotifications.ts`)
- ✅ Listeners de notificações em **foreground** (app aberto)
- ✅ Listeners de notificações em **background** (app minimizado)
- ✅ Listeners quando usuário **toca na notificação**
- ✅ Exibição de Alerts quando morador aprova/rejeita visitante
- ✅ Verificação de turno ativo antes de notificar

### 4. **Dashboard do Porteiro** (`app/porteiro/index.tsx`)
- ✅ Registro automático de push token no login
- ✅ Token salvo na tabela `user_notification_tokens`
- ✅ Atualização automática quando token muda

### 5. **Tela de Autorização do Morador** (`app/morador/authorize.tsx`)
- ✅ Envia notificação push quando aprova visitante
- ✅ Envia notificação push quando rejeita visitante
- ✅ Notificação inclui nome do visitante e número do apartamento

---

## 📱 Como Funciona

### **Fluxo Completo:**

1. **Porteiro faz login** → Push token é registrado automaticamente
2. **Morador autoriza/rejeita visitante** → Notificação é enviada via Edge Function
3. **Edge Function busca tokens dos porteiros** do prédio específico
4. **Expo Push API envia notificação** para todos os tokens encontrados
5. **Porteiro recebe notificação:**
   - **App aberto (foreground):** Alert popup aparece imediatamente
   - **App minimizado (background):** Notificação na barra de status
   - **App fechado:** Notificação na barra de status, abre app ao tocar

---

## 🧪 Como Testar

### **Pré-requisitos:**
- ✅ Dispositivo físico (emulador NÃO recebe push notifications)
- ✅ Projeto Expo EAS configurado (já feito: `74e123bc-f565-44ba-92f0-86fc00cbe0b1`)
- ✅ Tabela `user_notification_tokens` criada no Supabase
- ✅ Edge Function `send-push-notification` deployed

### **Teste 1: Verificar Registro de Token**

```sql
-- Verificar se o token do porteiro foi salvo
SELECT
  unt.user_id,
  unt.token,
  unt.device_type,
  unt.is_active,
  p.full_name,
  p.user_type
FROM user_notification_tokens unt
JOIN profiles p ON p.user_id = unt.user_id
WHERE p.user_type = 'porteiro'
ORDER BY unt.created_at DESC;
```

**Resultado esperado:** Deve aparecer o token do porteiro logado

---

### **Teste 2: Notificação de Aprovação (App Aberto)**

1. **Porteiro:** Faça login e mantenha app aberto
2. **Morador:** Entre na tela de autorizar visitantes
3. **Morador:** Aprove um visitante pendente
4. **Porteiro:** Deve receber:
   - ✅ Alert popup: "✅ Visitante Aprovado"
   - ✅ Mensagem: "[Nome] foi aprovado para o apartamento [Número]"

---

### **Teste 3: Notificação de Rejeição (App Aberto)**

1. **Porteiro:** Mantenha app aberto
2. **Morador:** Rejeite um visitante pendente
3. **Porteiro:** Deve receber:
   - ✅ Alert popup: "❌ Visitante Rejeitado"
   - ✅ Mensagem: "A entrada de [Nome] foi rejeitada pelo apartamento [Número]"

---

### **Teste 4: Notificação em Background (App Minimizado)**

1. **Porteiro:** Minimize o app (não feche)
2. **Morador:** Aprove/rejeite visitante
3. **Porteiro:** Deve receber:
   - ✅ Notificação na barra de status do celular
   - ✅ Som/vibração (conforme configurações do dispositivo)
   - ✅ Ao tocar: app abre com os dados da notificação

---

### **Teste 5: Notificação com App Fechado**

1. **Porteiro:** **Feche completamente o app** (force close)
2. **Morador:** Aprove/rejeite visitante
3. **Porteiro:** Deve receber:
   - ✅ Notificação na barra de status
   - ✅ Som/vibração
   - ✅ Ao tocar: app abre e exibe informações

---

## 🐛 Troubleshooting

### **Notificações não aparecem:**

1. **Verificar permissões:**
   ```typescript
   import * as Notifications from 'expo-notifications';

   const { status } = await Notifications.getPermissionsAsync();
   console.log('Permission status:', status);
   ```

2. **Verificar token salvo no banco:**
   ```sql
   SELECT * FROM user_notification_tokens
   WHERE user_id = '[porteiro_user_id]'
   AND is_active = true;
   ```

3. **Verificar logs da Edge Function:**
   - Acesse Supabase Dashboard > Edge Functions > Logs
   - Procure por erros em `send-push-notification`

4. **Testar Edge Function manualmente:**
   ```bash
   curl -X POST 'https://[sua-url].supabase.co/functions/v1/send-push-notification' \
     -H 'Authorization: Bearer [anon-key]' \
     -H 'Content-Type: application/json' \
     -d '{
       "title": "Teste Manual",
       "message": "Testando notificação",
       "type": "visitor",
       "userType": "porteiro",
       "buildingId": "[building-id-do-porteiro]"
     }'
   ```

5. **Verificar Expo Push Credentials:**
   ```bash
   npx expo-doctor
   npx eas credentials
   ```

---

## 📊 Logs Úteis

### **Console do Porteiro:**
```
🔔 [PorteiroDashboard] Registrando push token para porteiro: [user_id]
✅ [PorteiroDashboard] Push token registrado com sucesso
📩 [usePorteiroNotifications] Notificação recebida (foreground): {...}
```

### **Console do Morador:**
```
✅ Notificação push enviada para o porteiro com sucesso
```

### **Edge Function Logs:**
```
🔍 Buscando tokens para userType: porteiro, buildingId: [building_id]
📱 Encontrados [X] tokens de porteiros
✅ Push notifications enviadas: sent=[X], failed=[Y]
```

---

## 🔧 Configurações Importantes

### **app.json**
```json
{
  "expo": {
    "plugins": [
      ["expo-notifications", {
        "icon": "./assets/notification-icon.png",
        "color": "#2196F3",
        "mode": "production"
      }]
    ],
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "android": {
      "useNextNotificationsApi": true,
      "permissions": [
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.VIBRATE",
        "com.google.android.c2dm.permission.RECEIVE"
      ]
    }
  }
}
```

---

## 🚀 Deploy

### **Edge Function:**
```bash
# Deploy da função de notificações
supabase functions deploy send-push-notification

# Testar localmente (opcional)
supabase functions serve send-push-notification
```

### **Build do App:**
```bash
# Development build com push notifications
npx eas build --profile development --platform android
npx eas build --profile development --platform ios

# Preview build
npx eas build --profile preview --platform all

# Production build
npx eas build --profile production --platform all
```

---

## ✨ Recursos Adicionais

### **Canais de Notificação Android:**
- `visitor` - Visitantes (HIGH priority)
- `delivery` - Entregas (HIGH priority)
- `emergency` - Emergências (MAX priority)
- `default` - Geral (DEFAULT priority)

### **Tipos de Notificação:**
```typescript
type NotificationData = {
  type: 'visitor_approved' | 'visitor_rejected' | 'visitor_waiting' | 'delivery' | 'emergency' | 'general';
  visitor_id?: string;
  visitor_name?: string;
  apartment_number?: string;
  // ... outros campos
}
```

---

## 📝 Próximos Passos (Opcional)

1. **Badge count** - Mostrar número de notificações não lidas
2. **Histórico** - Salvar notificações no banco para histórico
3. **Configurações** - Permitir porteiro desativar certos tipos de notificação
4. **Deep linking** - Navegar para tela específica ao tocar notificação
5. **Agrupamento** - Agrupar múltiplas notificações similares

---

## ❓ FAQ

**P: Por que o emulador não recebe notificações?**
R: Expo Push Notifications só funcionam em dispositivos físicos.

**P: Como testar sem dois dispositivos?**
R: Use um dispositivo físico + Expo Go no segundo dispositivo, ou teste via curl manualmente.

**P: Notificações aparecem mas sem som/vibração?**
R: Verifique configurações do dispositivo e canais de notificação Android.

**P: Token não está sendo salvo?**
R: Verifique console logs e certifique-se que a tabela `user_notification_tokens` existe.

---

**Implementado por:** Claude Code
**Data:** $(date +%Y-%m-%d)
**Versão:** 1.0.0

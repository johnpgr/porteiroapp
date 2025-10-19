# 🔔 Configuração de Push Notifications para Produção

## ✅ Status Atual

Seu app já está **90% configurado** para notificações em produção. O código está pronto e o `app.json` está correto.

## 📋 Checklist de Produção

### ✅ 1. Configurações já feitas (você tem tudo isso):

- [x] Plugin `expo-notifications` configurado
- [x] Ícone de notificação definido (`./assets/notification-icon.png`)
- [x] Cor de notificação: `#2196F3`
- [x] Permissões Android configuradas
- [x] `UIBackgroundModes` iOS configurado
- [x] Edge Function `send-push-notification` implementada
- [x] Push tokens sendo registrados no login
- [x] EAS Project ID: `74e123bc-f565-44ba-92f0-86fc00cbe0b1`

### ⚠️ 2. O que você PRECISA fazer antes do build de produção:

#### **A. Android - Configurar FCM (Firebase Cloud Messaging)**

1. **Verificar se `google-services.json` existe:**
   ```bash
   # Verificar se o arquivo existe
   ls google-services.json
   ```

2. **Se NÃO existir, criar projeto no Firebase:**
   - Acesse: https://console.firebase.google.com
   - Crie um projeto ou use existente
   - Adicione um app Android:
     - Package name: `com.porteiroapp.notifications` (do app.json)
   - Baixe `google-services.json`
   - Coloque na raiz do projeto

3. **Configurar FCM Server Key no Expo:**
   ```bash
   # NÃO precisa mais com Expo SDK 47+
   # Expo gerencia automaticamente FCM v1 API
   ```

#### **B. iOS - Configurar APNs (Apple Push Notification Service)**

**OBRIGATÓRIO para notificações iOS funcionarem:**

1. **Criar APNs Key no Apple Developer:**
   - Acesse: https://developer.apple.com/account/resources/authkeys/list
   - Clique em **"+"** para criar nova chave
   - Nome: "James Avisa Push Notifications"
   - Marque: **"Apple Push Notifications service (APNs)"**
   - Clique em **Continue** e **Register**
   - **BAIXE a chave** (arquivo `.p8`) - você só pode baixar UMA VEZ
   - Anote o **Key ID** e **Team ID**

2. **Configurar APNs Key no EAS:**
   ```bash
   eas credentials
   ```
   - Selecione: **iOS**
   - Selecione: **Production**
   - Selecione: **Push Notifications**
   - Upload do arquivo `.p8`
   - Insira **Key ID** e **Team ID**

   **OU** adicione no `eas.json`:
   ```json
   {
     "cli": {
       "version": ">= 3.0.0"
     },
     "build": {
       "production": {
         "ios": {
           "credentials": {
             "pushKey": {
               "path": "./AuthKey_XXXXXX.p8",
               "keyId": "XXXXXX",
               "teamId": "XXXXXX"
             }
           }
         }
       }
     }
   }
   ```

#### **C. Criar arquivos de ícone de notificação**

1. **Ícone de notificação Android** (`./assets/notification-icon.png`):
   - Tamanho: **96x96px**
   - Formato: PNG transparente
   - Cor: Branco (será colorido com `#2196F3` do app.json)
   - Design: Silhueta simples do logo (sem gradientes)

2. **Logo principal** (`./assets/logo.png`):
   - Tamanho: **1024x1024px**
   - Formato: PNG
   - Este será usado como:
     - Ícone do app
     - Imagem grande na notificação (Android)

## 🚀 Build de Produção

### **1. Build Android (APK/AAB)**

```bash
# Build de produção
eas build --platform android --profile production

# Ou build de preview para testar
eas build --platform android --profile preview
```

### **2. Build iOS (IPA)**

```bash
# Build de produção (requer Apple Developer Account)
eas build --platform ios --profile production

# Ou build de preview para testar
eas build --platform ios --profile preview
```

## 📱 Como vão aparecer as notificações

### **Android:**

```
┌─────────────────────────────────────────┐
│ 🔔 James Avisa        [icon]     12:34  │
│ 📦 Nova Encomenda [EDGE FUNCTION]       │
│ Encomenda de Amazon para Douglas Moura  │
│                                          │
│ [Logo do app grande - 1024x1024]       │
└─────────────────────────────────────────┘
```

### **iOS:**

```
┌─────────────────────────────────────────┐
│ James Avisa                      [logo] │
│ 📦 Nova Encomenda [EDGE FUNCTION]       │
│ Encomenda de Amazon para Douglas Moura  │
│                                    12:34│
└─────────────────────────────────────────┘
```

## 🧪 Testar Notificações em Produção

### **1. Build de teste (Expo Go não funciona para push em produção):**

```bash
# Android
eas build --platform android --profile preview
# Instale o APK no dispositivo físico

# iOS
eas build --platform ios --profile preview
# Instale via TestFlight ou direct install
```

### **2. Registrar push token:**

1. Instale o app do build de produção
2. Faça login
3. Verifique os logs (via `adb logcat` no Android ou Xcode no iOS):
   ```
   🔔 [registerPushToken] Push token obtido: ExponentPushToken[...]
   ✅ [registerPushToken] Push token registrado com sucesso
   ```

### **3. Testar envio de notificação:**

1. Use outro usuário (porteiro) para registrar visitante/encomenda
2. Notificação deve chegar IMEDIATAMENTE (app aberto, fechado ou background)

### **4. Verificar no banco de dados:**

```sql
SELECT id, full_name, push_token, notification_enabled
FROM profiles
WHERE id = 'seu-user-id';
```

- `push_token` deve estar preenchido
- `notification_enabled` deve ser `true`

## 🐛 Troubleshooting

### **Notificações não chegam:**

1. **Verificar permissão no dispositivo:**
   - Android: Configurações > Apps > James Avisa > Notificações
   - iOS: Ajustes > James Avisa > Notificações

2. **Verificar push_token no banco:**
   ```sql
   SELECT push_token FROM profiles WHERE user_id = 'xxx';
   ```
   - Se `null`: Login não registrou token
   - Se preenchido: Token foi registrado

3. **Verificar logs da Edge Function:**
   ```bash
   npx supabase functions logs send-push-notification
   ```

4. **Testar com Expo Push Tool:**
   - Acesse: https://expo.dev/notifications
   - Cole o push token
   - Envie notificação de teste
   - Se chegar: Sistema está OK
   - Se não chegar: Problema no token ou configuração

### **Erro "Device not registered":**

- Token expirou ou inválido
- Usuário desinstalou e reinstalou o app
- **Solução**: Fazer logout e login novamente

### **Notificações chegam mas sem ícone/logo:**

- Verificar se `./assets/notification-icon.png` existe
- Rebuildar o app com `eas build`

## 📚 Documentação Oficial

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [APNs Configuration](https://developer.apple.com/documentation/usernotifications)
- [EAS Build](https://docs.expo.dev/build/introduction/)

## 🎯 Resumo

**ANTES de fazer build de produção:**

1. ✅ Criar ícone de notificação (96x96px, branco, transparente)
2. ⚠️ Configurar Firebase (baixar `google-services.json`)
3. ⚠️ Configurar APNs Key (Apple Developer)
4. ✅ Verificar `app.json` (já está OK)
5. ✅ Testar com build de preview primeiro
6. ✅ Fazer build de produção
7. ✅ Testar notificações end-to-end

**Seu código está PRONTO!** Só faltam as configurações de credenciais para iOS/Android.

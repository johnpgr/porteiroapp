# Análise Técnica do Sistema de Notificações - PorteiroApp

## 1. Visão Geral do Sistema

O PorteiroApp possui dois sistemas de notificação distintos:
1. **Sistema de Visitantes/Encomendas/Veículos**: Notificações em tempo real para aprovação de entrada
2. **Sistema de Avisos e Enquetes**: Notificações informativas sobre comunicados e pesquisas

Ambos utilizam tecnologias similares (Supabase Realtime, Expo Notifications, WhatsApp API), mas com implementações e fluxos diferentes.

## 2. Sistema de Notificações de Visitantes/Encomendas/Veículos

### 2.1 Fluxo Completo de Notificação

#### Etapa 1: Registro pelo Porteiro
Quando o porteiro registra uma entrada nos arquivos:
- `RegistrarEncomenda.tsx` (linhas 470-547)
- `RegistrarVeiculo.tsx` (linhas 717-780) 
- `RegistrarVisitante.tsx` (linhas 540-607)

O processo segue esta sequência:

1. **Inserção no banco de dados**:
   ```sql
   INSERT INTO visitor_logs (
     building_id, apartment_id, entry_type, guest_name,
     notification_status, requires_resident_approval, created_at
   ) VALUES (...)
   ```

2. **Busca de dados do morador**:
   ```typescript
   const { data: residentData } = await supabase
     .from('apartment_residents')
     .select('profiles!inner(full_name, phone)')
     .eq('apartment_id', selectedApartment.id)
     .eq('is_owner', true)
   ```

3. **Envio de notificação WhatsApp**:
   ```typescript
   await notificationApi.sendVisitorWaitingNotification({
     visitor_name: nomeVisitante,
     resident_phone: residentData.profiles.phone,
     resident_name: residentData.profiles.full_name,
     building: buildingData.name,
     apartment: selectedApartment.number,
     visitor_log_id: visitorLogData.id
   })
   ```

#### Etapa 2: Processamento em Tempo Real (usePendingNotifications.ts)

O hook `usePendingNotifications` gerencia o lado do morador:

1. **Subscription Realtime**:
   ```typescript
   const channel = supabase
     .channel('visitor_notifications')
     .on('postgres_changes', {
       event: '*',
       schema: 'public', 
       table: 'visitor_logs',
       filter: `apartment_id=eq.${apartmentId}`
     }, (payload) => {
       if (payload.eventType === 'INSERT') {
         triggerAutomaticNotifications(payload.new)
       }
     })
   ```

2. **Disparo Automático de Notificações** (linhas 200-220):
   ```typescript
   const triggerAutomaticNotifications = async (newLog) => {
     // 1. Push Notification
     await Notifications.scheduleNotificationAsync({
       content: {
         title: `${entryTypeText} Aguardando Aprovação`,
         body: `${visitorName} está aguardando autorização para ${apartmentNumber}`,
         data: { type: 'pending_visitor', visitor_log_id: newLog.id }
       }
     })
     
     // 2. WhatsApp Notification
     await notificationApi.sendVisitorWaitingNotification({...})
   }
   ```

#### Etapa 3: Resposta do Morador

Quando o morador responde via `NotificationCard.tsx`:

1. **Atualização do status**:
   ```typescript
   const { error } = await supabase
     .from('visitor_logs')
     .update({
       notification_status: response.action === 'approve' ? 'approved' : 'rejected',
       resident_response_at: new Date().toISOString(),
       delivery_destination: response.delivery_destination
     })
     .eq('id', notificationId)
   ```

2. **Notificação aos porteiros** (linhas 260-350):
   ```typescript
   const notifyDoorkeepers = async (notificationId, response, buildingId) => {
     // Buscar porteiros do prédio
     const { data: doorkeepers } = await supabase
       .from('profiles')
       .select('id, full_name')
       .eq('building_id', buildingId)
       .eq('user_type', 'porteiro')
     
     // Enviar push notification para cada porteiro
     for (const doorkeeper of doorkeepers) {
       await Notifications.scheduleNotificationAsync({...})
     }
   }
   ```

### 2.2 Componentes Envolvidos

#### Frontend (Morador)
- **`app/morador/index.tsx`**: Dashboard principal que exibe notificações pendentes
- **`components/NotificationCard.tsx`**: Renderiza cards de notificação com ações (aprovar/rejeitar)
- **`hooks/usePendingNotifications.ts`**: Gerencia estado, realtime e respostas

#### Backend/API
- **`services/notificationApi.ts`**: Interface para API externa de WhatsApp
- **Supabase Realtime**: Sistema de subscriptions em tempo real
- **Expo Notifications**: Push notifications nativas

### 2.3 Estrutura de Dados

#### Tabela visitor_logs
```sql
CREATE TABLE visitor_logs (
  id uuid PRIMARY KEY,
  building_id uuid REFERENCES buildings(id),
  apartment_id uuid REFERENCES apartments(id),
  entry_type text CHECK (entry_type IN ('visitor', 'delivery', 'vehicle')),
  guest_name text,
  notification_status text DEFAULT 'pending',
  requires_resident_approval boolean DEFAULT true,
  resident_response_at timestamp,
  delivery_destination text,
  rejection_reason text,
  created_at timestamp DEFAULT now()
)
```

## 3. Sistema de Avisos e Enquetes

### 3.1 Implementação Atual (useAvisosNotifications.ts)

O sistema de avisos possui uma implementação mais simples:

#### Estrutura de Dados
```sql
-- Tabela communications
CREATE TABLE communications (
  id uuid PRIMARY KEY,
  building_id uuid REFERENCES buildings(id),
  title text NOT NULL,
  content text NOT NULL,
  type text DEFAULT 'notice',
  priority text DEFAULT 'normal',
  created_by uuid REFERENCES profiles(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
)

-- Tabela polls  
CREATE TABLE polls (
  id uuid PRIMARY KEY,
  building_id uuid REFERENCES buildings(id),
  title text NOT NULL,
  description text,
  expires_at timestamp,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
)
```

#### Fluxo de Notificação
1. **Subscription Realtime** (linhas 257-308):
   ```typescript
   // Comunicados
   const commChannel = supabase
     .channel('communications_notifications')
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'communications',
       filter: `building_id=eq.${userBuildingId}`
     }, triggerCommunicationNotification)
   
   // Enquetes
   const pollChannel = supabase
     .channel('polls_notifications')
     .on('postgres_changes', {
       event: 'INSERT', 
       schema: 'public',
       table: 'polls',
       filter: `building_id=eq.${userBuildingId}`
     }, triggerPollNotification)
   ```

2. **Disparo de Notificações** (linhas 80-164):
   ```typescript
   const triggerCommunicationNotification = async (newCommunication) => {
     // Apenas Push Notification - SEM WhatsApp
     await Notifications.scheduleNotificationAsync({
       content: {
         title: '📢 Novo Comunicado',
         body: `${buildingName}: ${communication.title}`,
         data: {
           type: 'new_communication',
           communication_id: communication.id
         }
       }
     })
   }
   ```

### 3.2 Limitações Identificadas

1. **Apenas Push Notifications**: Não envia WhatsApp como o sistema de visitantes
2. **Sem persistência de status**: Não rastreia se o morador visualizou o aviso
3. **Sem confirmação de entrega**: Não há feedback se a notificação foi recebida
4. **Sem sistema de resposta**: Moradores não podem interagir com avisos

## 4. Análise Comparativa dos Sistemas

| Aspecto | Visitantes/Encomendas | Avisos/Enquetes |
|---------|----------------------|------------------|
| **Push Notifications** | ✅ Sim | ✅ Sim |
| **WhatsApp** | ✅ Sim | ❌ Não |
| **Realtime Subscriptions** | ✅ Sim | ✅ Sim |
| **Persistência de Status** | ✅ Sim (pending/approved/rejected) | ❌ Não |
| **Sistema de Resposta** | ✅ Sim (aprovar/rejeitar) | ❌ Não |
| **Notificação de Feedback** | ✅ Sim (para porteiros) | ❌ Não |
| **Controle de Entrega** | ✅ Sim | ❌ Não |
| **Histórico** | ✅ Sim | ❌ Limitado |

## 5. Problemas Identificados no Sistema de Avisos

### 5.1 Principais Falhas

1. **Falta de WhatsApp Integration**:
   - Sistema de visitantes usa `notificationApi.sendVisitorWaitingNotification()`
   - Sistema de avisos não possui equivalente
   - Moradores podem não receber notificações se push notifications falharem

2. **Ausência de Controle de Status**:
   - Não há tabela para rastrear status de leitura dos avisos
   - Impossível saber se morador visualizou comunicado importante
   - Sem métricas de engajamento

3. **Falta de Sistema de Confirmação**:
   - Avisos urgentes não têm confirmação de recebimento
   - Administradores não sabem se mensagem foi entregue

4. **Inconsistência de UX**:
   - Moradores esperam mesmo padrão de notificação
   - Diferentes comportamentos confundem usuários

### 5.2 Cenários de Falha

1. **Push Notification Falha**:
   - Se dispositivo estiver offline
   - Se permissões estiverem desabilitadas
   - Se app não estiver instalado
   - **Resultado**: Morador não recebe aviso importante

2. **Filtro de Building ID**:
   - Se `userBuildingId` não for identificado corretamente
   - **Resultado**: Notificações não são disparadas

3. **Subscription Realtime**:
   - Se conexão WebSocket falhar
   - Se subscription não for estabelecida
   - **Resultado**: Notificações não são processadas em tempo real

## 6. Recomendações para Implementação

### 6.1 Padronização do Sistema de Notificações

#### Criar Tabela de Status de Avisos
```sql
CREATE TABLE communication_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid REFERENCES communications(id),
  user_id uuid REFERENCES profiles(id),
  status text CHECK (status IN ('sent', 'delivered', 'read', 'acknowledged')),
  notification_type text CHECK (notification_type IN ('push', 'whatsapp')),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
)
```

#### Implementar WhatsApp para Avisos
```typescript
// Adicionar ao notificationApi.ts
async sendCommunicationNotification({
  communication_id,
  resident_phone,
  resident_name, 
  building,
  title,
  content,
  priority
}: SendCommunicationNotificationRequest) {
  return this.makeRequest('/send-communication', {
    communication_id,
    resident_phone,
    resident_name,
    building,
    title,
    content,
    priority
  })
}
```

#### Modificar useAvisosNotifications.ts
```typescript
const triggerCommunicationNotification = async (newCommunication) => {
  // 1. Push Notification (existente)
  await Notifications.scheduleNotificationAsync({...})
  
  // 2. WhatsApp Notification (NOVO)
  if (residentPhone) {
    await notificationApi.sendCommunicationNotification({
      communication_id: newCommunication.id,
      resident_phone: residentPhone,
      resident_name: residentName,
      building: buildingName,
      title: newCommunication.title,
      content: newCommunication.content,
      priority: newCommunication.priority
    })
  }
  
  // 3. Registrar status (NOVO)
  await supabase.from('communication_status').insert({
    communication_id: newCommunication.id,
    user_id: user.id,
    status: 'sent',
    notification_type: 'push'
  })
}
```

### 6.2 Sistema de Confirmação para Avisos Urgentes

#### Interface de Confirmação
```typescript
interface CommunicationResponse {
  communication_id: string
  user_id: string
  action: 'acknowledged' | 'read'
  timestamp: string
}

const respondToCommunication = async (
  communicationId: string,
  action: 'acknowledged' | 'read'
) => {
  await supabase
    .from('communication_status')
    .update({
      status: action,
      updated_at: new Date().toISOString()
    })
    .eq('communication_id', communicationId)
    .eq('user_id', user.id)
}
```

#### NotificationCard para Avisos
```typescript
const CommunicationNotificationCard = ({ communication, onRespond }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{communication.title}</Text>
      <Text style={styles.content}>{communication.content}</Text>
      
      {communication.priority === 'high' && (
        <TouchableOpacity 
          style={styles.acknowledgeButton}
          onPress={() => onRespond(communication.id, 'acknowledged')}
        >
          <Text>✅ Confirmar Recebimento</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
```

### 6.3 Dashboard de Monitoramento para Administradores

```typescript
// Métricas de entrega de avisos
const getCommunicationMetrics = async (communicationId: string) => {
  const { data } = await supabase
    .from('communication_status')
    .select('status, notification_type, created_at')
    .eq('communication_id', communicationId)
  
  return {
    total_sent: data.length,
    delivered: data.filter(s => s.status === 'delivered').length,
    read: data.filter(s => s.status === 'read').length,
    acknowledged: data.filter(s => s.status === 'acknowledged').length
  }
}
```

### 6.4 Implementação Gradual

#### Fase 1: Correção Imediata
1. Adicionar WhatsApp ao sistema de avisos
2. Implementar tabela `communication_status`
3. Modificar `useAvisosNotifications` para incluir WhatsApp

#### Fase 2: Melhorias de UX
1. Criar `CommunicationNotificationCard`
2. Implementar sistema de confirmação
3. Adicionar métricas básicas

#### Fase 3: Dashboard Avançado
1. Interface de monitoramento para administradores
2. Relatórios de engajamento
3. Notificações de follow-up automáticas

## 7. Conclusão

O sistema de notificações do PorteiroApp possui uma base sólida no módulo de visitantes/encomendas/veículos, mas o sistema de avisos e enquetes está incompleto. As principais lacunas são:

1. **Falta de integração WhatsApp** no sistema de avisos
2. **Ausência de controle de status** e confirmação de entrega
3. **Inconsistência de experiência** entre os dois sistemas

A implementação das recomendações propostas garantirá:
- **Confiabilidade**: Múltiplos canais de entrega (push + WhatsApp)
- **Rastreabilidade**: Status de entrega e leitura
- **Consistência**: Experiência uniforme para todos os tipos de notificação
- **Monitoramento**: Métricas para administradores

Esta padronização é essencial para garantir que avisos importantes (emergências, manutenções, comunicados urgentes) sejam efetivamente entregues a todos os moradores.
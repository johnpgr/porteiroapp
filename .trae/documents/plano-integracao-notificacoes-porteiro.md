# Plano de Integração de Notificações no RegistrarVisitante

## 1. Visão Geral

Este documento detalha o plano para integrar notificações em tempo real no componente `RegistrarVisitante.tsx`, permitindo que moradores recebam notificações automáticas quando visitantes são registrados pelo porteiro.

## 2. Análise do Fluxo Atual

### 2.1 Fluxo Existente
Atualmente, o componente `RegistrarVisitante` segue este fluxo:
1. Porteiro insere dados do apartamento
2. Seleciona tipo de visita (social, prestador, entrega)
3. Insere dados do visitante (nome, CPF)
4. Adiciona observações opcionais
5. Tira foto do visitante
6. Confirma o registro
7. Insere dados nas tabelas `visitors` e `visitor_logs`

### 2.2 Ponto de Integração
O ponto ideal para integração é na função `handleConfirm()` do step de confirmação, após o sucesso da inserção no `visitor_logs`.

## 3. Estratégia de Implementação

### 3.1 Modificação da Estrutura de Dados

Precisamos adicionar campos na tabela `visitor_logs` para suportar notificações:

```sql
-- Campos necessários (alguns já existem)
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS notification_status VARCHAR DEFAULT 'pending';
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS requires_resident_approval BOOLEAN DEFAULT true;
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS entry_type VARCHAR;
ALTER TABLE visitor_logs ADD COLUMN IF NOT EXISTS guest_name VARCHAR;
```

### 3.2 Modificações no Componente RegistrarVisitante

#### 3.2.1 Imports Adicionais
```typescript
// Adicionar ao início do arquivo
import { createNotificationForResident } from '../../services/notificationService';
```

#### 3.2.2 Função de Criação de Notificação
```typescript
const createResidentNotification = async (
  apartmentId: string,
  visitorLogId: string,
  visitorData: {
    name: string;
    type: TipoVisita;
    company?: string;
    purpose?: string;
  }
) => {
  try {
    // Calcular tempo de expiração (24 horas)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Determinar entry_type baseado no tipo de visita
    let entryType = 'visitor';
    if (visitorData.type === 'entrega') entryType = 'delivery';
    if (visitorData.type === 'prestador') entryType = 'service';

    // Atualizar o visitor_log com dados de notificação
    const { error: updateError } = await supabase
      .from('visitor_logs')
      .update({
        notification_status: 'pending',
        notification_sent_at: new Date().toISOString(),
        requires_resident_approval: true,
        expires_at: expiresAt.toISOString(),
        entry_type: entryType,
        guest_name: visitorData.name,
        // Campos específicos por tipo
        ...(visitorData.company && { delivery_sender: visitorData.company }),
        ...(visitorData.purpose && { purpose: visitorData.purpose })
      })
      .eq('id', visitorLogId);

    if (updateError) {
      console.error('Erro ao atualizar visitor_log para notificação:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao criar notificação para morador:', error);
    return false;
  }
};
```

#### 3.2.3 Modificação da Função handleConfirm
```typescript
const handleConfirm = async () => {
  try {
    // ... código existente até a inserção no visitor_logs ...

    // Inserir log de entrada na tabela visitor_logs
    const { data: logData, error: logError } = await supabase
      .from('visitor_logs')
      .insert({
        visitor_id: visitorId,
        apartment_id: apartmentData.id,
        building_id: apartmentData.building_id,
        log_time: new Date().toISOString(),
        tipo_log: 'IN',
        visit_session_id: visitSessionId,
        purpose: observacoes || purpose,
        authorized_by: user.id
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Erro ao inserir log de entrada:', logError);
      Alert.alert('Erro', 'Falha ao registrar entrada do visitante.');
      return;
    }

    // NOVA FUNCIONALIDADE: Criar notificação para o morador
    const notificationSuccess = await createResidentNotification(
      apartmentData.id,
      logData.id,
      {
        name: nomeVisitante,
        type: tipoVisita!,
        company: empresaPrestador || empresaEntrega || undefined,
        purpose: observacoes || purpose
      }
    );

    // Mensagem de sucesso incluindo status da notificação
    const baseMessage = `${nomeVisitante} foi registrado com entrada no apartamento ${apartamento}.`;
    const notificationMessage = notificationSuccess 
      ? ' Notificação enviada ao morador.' 
      : ' Aviso: Notificação não pôde ser enviada ao morador.';
    
    const fullMessage = baseMessage + notificationMessage;

    if (onConfirm) {
      onConfirm(fullMessage);
    } else {
      Alert.alert('✅ Visitante Registrado!', fullMessage, [{ text: 'OK' }]);
      onClose();
    }
  } catch (error) {
    // ... tratamento de erro existente ...
  }
};
```

### 3.3 Serviço de Notificação

Criar arquivo `services/notificationService.ts`:

```typescript
import { supabase } from '../utils/supabase';

export interface NotificationData {
  apartmentId: string;
  visitorName: string;
  visitorType: 'visitor' | 'delivery' | 'service';
  company?: string;
  purpose?: string;
  expiresAt: string;
}

export const createNotificationForResident = async (
  notificationData: NotificationData
): Promise<boolean> => {
  try {
    // Verificar se há moradores no apartamento
    const { data: residents, error: residentsError } = await supabase
      .from('apartment_residents')
      .select('profile_id')
      .eq('apartment_id', notificationData.apartmentId);

    if (residentsError || !residents || residents.length === 0) {
      console.warn('Nenhum morador encontrado para o apartamento');
      return false;
    }

    // A notificação será automaticamente detectada pelo sistema Realtime
    // através da inserção/atualização na tabela visitor_logs
    console.log('Notificação criada para moradores do apartamento:', notificationData.apartmentId);
    return true;
  } catch (error) {
    console.error('Erro no serviço de notificação:', error);
    return false;
  }
};

// Função auxiliar para formatar mensagem de notificação
export const formatNotificationMessage = (
  visitorName: string,
  visitorType: string,
  company?: string
): string => {
  switch (visitorType) {
    case 'delivery':
      return `📦 Encomenda de ${company || 'remetente desconhecido'} chegou`;
    case 'service':
      return `🔧 Prestador de serviço ${company ? `(${company})` : ''} - ${visitorName}`;
    default:
      return `👤 ${visitorName} quer subir`;
  }
};
```

## 4. Integração com Sistema Realtime Existente

### 4.1 Compatibilidade
O sistema já possui:
- Hook `usePendingNotifications` que monitora a tabela `visitor_logs`
- Componente `NotificationCard` para exibir notificações
- Supabase Realtime configurado

### 4.2 Fluxo de Notificação
1. Porteiro registra visitante
2. Sistema insere dados em `visitor_logs` com `notification_status: 'pending'`
3. Supabase Realtime detecta a inserção
4. Hook `usePendingNotifications` no app do morador recebe a atualização
5. Notificação aparece automaticamente na interface do morador
6. Morador pode aprovar/rejeitar através do `NotificationCard`

## 5. Tratamento de Erros e Fallbacks

### 5.1 Cenários de Erro
- Falha na conexão com Supabase
- Apartamento não encontrado
- Morador não cadastrado no apartamento
- Erro na atualização do visitor_log

### 5.2 Estratégias de Fallback
```typescript
// Adicionar ao handleConfirm
const handleNotificationFailure = () => {
  // Log do erro para monitoramento
  console.warn('Notificação não enviada - visitante registrado sem notificação');
  
  // Ainda permitir o registro do visitante
  // Mostrar aviso ao porteiro
  Alert.alert(
    'Aviso',
    'Visitante registrado com sucesso, mas a notificação não pôde ser enviada ao morador. Considere avisar pessoalmente.',
    [{ text: 'Entendi' }]
  );
};
```

### 5.3 Retry Logic
```typescript
const createNotificationWithRetry = async (
  apartmentId: string,
  visitorLogId: string,
  visitorData: any,
  maxRetries: number = 3
): Promise<boolean> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const success = await createResidentNotification(apartmentId, visitorLogId, visitorData);
    
    if (success) {
      return true;
    }
    
    if (attempt < maxRetries) {
      // Aguardar antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return false;
};
```

## 6. Validações e Segurança

### 6.1 Validações Necessárias
- Verificar se o porteiro tem permissão para o prédio
- Validar se o apartamento existe no prédio do porteiro
- Confirmar que há moradores cadastrados no apartamento
- Verificar limites de rate limiting para notificações

### 6.2 Políticas RLS
As políticas RLS já existentes devem cobrir:
- Porteiros só podem criar logs para seu prédio
- Moradores só veem notificações do seu apartamento

## 7. Monitoramento e Logs

### 7.1 Métricas a Acompanhar
- Taxa de sucesso de notificações enviadas
- Tempo de resposta dos moradores
- Notificações expiradas sem resposta
- Erros na criação de notificações

### 7.2 Logs Estruturados
```typescript
const logNotificationEvent = (event: string, data: any) => {
  console.log(`[NOTIFICATION] ${event}:`, {
    timestamp: new Date().toISOString(),
    apartmentId: data.apartmentId,
    visitorName: data.visitorName,
    success: data.success,
    error: data.error
  });
};
```

## 8. Testes Recomendados

### 8.1 Testes Unitários
- Função `createResidentNotification`
- Formatação de mensagens
- Tratamento de erros

### 8.2 Testes de Integração
- Fluxo completo de registro + notificação
- Cenários de falha de rede
- Múltiplos moradores no mesmo apartamento

### 8.3 Testes E2E
- Porteiro registra visitante → Morador recebe notificação
- Morador aprova/rejeita → Sistema atualiza status
- Notificação expira automaticamente

## 9. Cronograma de Implementação

### Fase 1 (1-2 dias)
- Modificar estrutura do banco de dados
- Implementar função `createResidentNotification`
- Modificar `handleConfirm` no RegistrarVisitante

### Fase 2 (1 dia)
- Criar serviço de notificação
- Implementar tratamento de erros
- Adicionar logs estruturados

### Fase 3 (1 dia)
- Testes de integração
- Validação do fluxo completo
- Ajustes de UX/UI

## 10. Considerações Futuras

### 10.1 Melhorias Possíveis
- Notificações push para dispositivos móveis
- Histórico de notificações enviadas
- Configurações de preferência de notificação por morador
- Integração com WhatsApp/SMS como fallback

### 10.2 Escalabilidade
- Implementar queue system para alto volume
- Cache de dados de apartamentos/moradores
- Otimização de queries Supabase

Este plano garante uma integração robusta e confiável do sistema de notificações, mantendo compatibilidade com a arquitetura existente e fornecendo uma experiência fluida tanto para porteiros quanto para moradores.
import { supabase } from '~/utils/supabase';
import { getPorteiroBuildingId } from './building.service';

export type PorteiroLogType = 'visitor' | 'delivery';

export interface PorteiroLogEntry {
  id: string;
  type: PorteiroLogType;
  title: string;
  subtitle: string;
  status: string;
  time: string;
  icon: string;
  color: string;
  photo_url?: string;
  details: string[];
  timestampISO: string;
}

export interface PorteiroLogsPayload {
  logs: PorteiroLogEntry[];
  pendingDeliveries: PorteiroLogEntry[];
  scheduledVisits: PorteiroLogEntry[];
}

const VISITOR_STATUS_MAP: Record<
  string,
  { status: string; icon: string; color: string }
> = {
  approved_in: {
    status: 'Entrada autorizada',
    icon: '✅',
    color: '#4CAF50',
  },
  approved_out: {
    status: 'Saída registrada',
    icon: '🚪',
    color: '#2196F3',
  },
  rejected: {
    status: 'Acesso negado',
    icon: '❌',
    color: '#F44336',
  },
  pending: {
    status: 'Aguardando aprovação',
    icon: '⏳',
    color: '#FF9800',
  },
  default: {
    status: 'Expirado',
    icon: '⏰',
    color: '#666666',
  },
};

const formatRelativeDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffHours * 60);
    return `${diffMinutes} min atrás`;
  }

  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h atrás`;
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}/${month} ${hours}:${minutes}`;
};

export async function fetchPorteiroLogs(userId: string): Promise<PorteiroLogsPayload> {
  const buildingId = await getPorteiroBuildingId(userId);

  if (!buildingId) {
    return { logs: [], pendingDeliveries: [], scheduledVisits: [] };
  }

  const [visitorResult, deliveryResult] = await Promise.all([
    supabase
      .from('visitor_logs')
      .select(
        `
          *,
          apartments!inner(number),
          visitors(name, document, photo_url)
        `
      )
      .eq('building_id', buildingId)
      .order('log_time', { ascending: false })
      .limit(20),
    supabase
      .from('deliveries')
      .select(
        `
          *,
          apartments!inner(number)
        `
      )
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (visitorResult.error) {
    throw visitorResult.error;
  }

  if (deliveryResult.error) {
    throw deliveryResult.error;
  }

  const visitorLogs: PorteiroLogEntry[] = (visitorResult.data ?? []).map((log: any) => {
    const statusKey =
      log.notification_status === 'approved'
        ? log.tipo_log === 'IN'
          ? 'approved_in'
          : 'approved_out'
        : log.notification_status === 'rejected'
          ? 'rejected'
          : log.notification_status === 'pending'
            ? 'pending'
            : 'default';

    const statusMeta = VISITOR_STATUS_MAP[statusKey] ?? VISITOR_STATUS_MAP.default;
    const visitorName = log.visitors?.name || log.guest_name || 'Visitante';
    const visitorDocument = log.visitors?.document || 'N/A';
    const visitorPhoto = log.visitors?.photo_url;

    return {
      id: log.id,
      type: 'visitor',
      title: visitorName,
      subtitle: `Apto ${log.apartments?.number || 'N/A'} • ${log.tipo_log === 'IN' ? 'Entrada' : 'Saída'}`,
      status: statusMeta.status,
      time: formatRelativeDate(log.log_time),
      icon: statusMeta.icon,
      color: statusMeta.color,
      photo_url: visitorPhoto,
      details: [
        `Documento: ${visitorDocument}`,
        `Tipo: ${log.entry_type || 'visitor'}`,
        `Status: ${log.notification_status}`,
        ...(log.purpose ? [`Motivo: ${log.purpose}`] : []),
      ],
      timestampISO: log.log_time,
    };
  });

  const deliveryLogs: PorteiroLogEntry[] = (deliveryResult.data ?? []).map((delivery: any) => {
    const isDelivered = delivery.status === 'entregue';

    return {
      id: delivery.id,
      type: 'delivery',
      title: `Encomenda - ${delivery.recipient_name}`,
      subtitle: `Apto ${delivery.apartments?.number || 'N/A'} • ${delivery.sender}`,
      status: isDelivered ? 'Entregue' : 'Recebida',
      time: formatRelativeDate(isDelivered && delivery.delivered_at ? delivery.delivered_at : delivery.created_at),
      icon: isDelivered ? '✅' : '📦',
      color: isDelivered ? '#4CAF50' : '#FF9800',
      details: [
        `Remetente: ${delivery.sender}`,
        ...(delivery.description ? [`Descrição: ${delivery.description}`] : []),
        `Recebida por: ${delivery.received_by || 'N/A'}`,
        ...(isDelivered ? [`Entregue por: ${delivery.delivered_by || 'N/A'}`] : []),
      ],
      timestampISO: isDelivered && delivery.delivered_at ? delivery.delivered_at : delivery.created_at,
    };
  });

  const logs = [...visitorLogs, ...deliveryLogs].sort(
    (a, b) => new Date(b.timestampISO).getTime() - new Date(a.timestampISO).getTime()
  );

  const pendingDeliveries = deliveryLogs.filter((log) => log.status === 'Recebida');
  const scheduledVisits = visitorLogs.filter(
    (log) => log.status === 'Aguardando aprovação' || log.status === 'Entrada autorizada'
  );

  return {
    logs,
    pendingDeliveries,
    scheduledVisits,
  };
}

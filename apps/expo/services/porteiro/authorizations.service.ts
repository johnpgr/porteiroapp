import { supabase } from '~/utils/supabase';
import { getPorteiroBuildingId } from './building.service';

export interface PorteiroAuthorization {
  id: string;
  tipo: 'Visitante' | 'Encomenda';
  nomeConvidado: string;
  apartamento: string;
  apartamento_id: string | null;
  statusLabel: string;
  statusColor: string;
  dataAprovacao: string;
  horaAprovacao: string;
  jaAutorizado: boolean;
  isEncomenda: boolean;
  cpf?: string;
  phone?: string;
  visitor_type?: string;
  delivery_destination?: string;
}

const APPROVED_LABEL = {
  statusLabel: 'Aprovado',
  statusColor: '#10B981',
};

export async function fetchPorteiroAuthorizations(
  userId: string,
  limit: number = 50
): Promise<PorteiroAuthorization[]> {
  const buildingId = await getPorteiroBuildingId(userId);

  if (!buildingId) {
    return [];
  }

  const { data, error } = await supabase
    .from('visitors')
    .select(
      `
        id,
        name,
        document,
        phone,
        visitor_type,
        apartment_id,
        created_at,
        status,
        apartments!inner(number, building_id),
        visitor_logs(delivery_destination)
      `
    )
    .eq('apartments.building_id', buildingId)
    .eq('status', 'aprovado')
    .neq('status', 'rejected')
    .neq('status', 'não autorizado')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((visitor) => {
    const createdAt = new Date(visitor.created_at);
    const day = createdAt.getDate().toString().padStart(2, '0');
    const month = (createdAt.getMonth() + 1).toString().padStart(2, '0');
    const year = createdAt.getFullYear();
    const hours = createdAt.getHours().toString().padStart(2, '0');
    const minutes = createdAt.getMinutes().toString().padStart(2, '0');

    const formattedDate = `${day}/${month}/${year}`;
    const formattedTime = `${hours}:${minutes}`;

    const isDelivery = visitor.visitor_type === 'delivery';

    // Get delivery_destination from first visitor_log if available
    const deliveryDest = Array.isArray(visitor.visitor_logs) && visitor.visitor_logs.length > 0
      ? visitor.visitor_logs[0]?.delivery_destination || 'PENDENTE'
      : 'PENDENTE';

    return {
      id: visitor.id,
      tipo: isDelivery ? 'Encomenda' : 'Visitante',
      nomeConvidado: visitor.name || 'N/A',
      apartamento: visitor.apartments?.number || 'N/A',
      apartamento_id: visitor.apartment_id || null,
      dataAprovacao: formattedDate,
      horaAprovacao: formattedTime,
      jaAutorizado: false,
      isEncomenda: isDelivery,
      cpf: visitor.document || '',
      phone: visitor.phone || '',
      visitor_type: visitor.visitor_type || 'comum',
      delivery_destination: deliveryDest,
      ...APPROVED_LABEL,
    };
  });
}

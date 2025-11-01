import { supabase } from '~/utils/supabase';
import { getPorteiroBuildingId } from './building.service';

export interface PorteiroCommunication {
  id: string;
  title: string;
  content: string;
  type: string | null;
  priority: string | null;
  created_at: string;
  authorName: string;
}

export async function fetchPorteiroCommunications(
  userId: string,
  limit: number = 20
): Promise<PorteiroCommunication[]> {
  const buildingId = await getPorteiroBuildingId(userId);

  if (!buildingId) {
    return [];
  }

  const { data, error } = await supabase
    .from('communications')
    .select(
      `
        id,
        title,
        content,
        type,
        priority,
        created_at,
        admin_profiles!communications_created_by_fkey(full_name)
      `
    )
    .eq('building_id', buildingId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((record) => ({
    id: record.id,
    title: record.title,
    content: record.content,
    type: record.type ?? null,
    priority: record.priority ?? null,
    created_at: record.created_at,
    authorName: record.admin_profiles?.full_name ?? 'Administração',
  }));
}

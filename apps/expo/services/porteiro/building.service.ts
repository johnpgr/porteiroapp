import { supabase } from '~/utils/supabase';

interface PorteiroBuildingRecord {
  building_id: string | null;
}

export async function getPorteiroBuildingId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('building_id')
    .eq('id', userId)
    .eq('user_type', 'porteiro')
    .maybeSingle<PorteiroBuildingRecord>();

  if (error) {
    throw error;
  }

  return data?.building_id ?? null;
}

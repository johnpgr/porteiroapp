import { supabase } from '~/utils/supabase';

export interface PorteiroResidentProfile {
  id: string;
  name?: string | null;
  full_name?: string | null;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  apartment?: {
    number: string | null;
    id: string;
  } | null;
  building?: {
    name: string | null;
    id: string;
  } | null;
  type: 'morador' | 'visitante_aprovado';
}

export interface PorteiroVehicleProfile {
  id: string;
  license_plate: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  type?: string | null;
  apartment?: {
    number: string | null;
    id: string;
  } | null;
  building?: {
    name: string | null;
    id: string;
  } | null;
}

export async function searchResidentByCPF(rawCpf: string): Promise<PorteiroResidentProfile | null> {
  const cleanCPF = rawCpf.replace(/[^0-9]/g, '');

  // First try to find in profiles (morador)
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select(`*`)
    .eq('cpf', cleanCPF)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (profileData) {
    const { data: residentData, error: residentError } = await supabase
      .from('apartment_residents')
      .select(`
        apartment_id,
        apartments!inner(
          id,
          number,
          building_id,
          buildings!inner(
            id,
            name
          )
        )
      `)
      .eq('profile_id', profileData.id)
      .maybeSingle();

    if (residentError && residentError.code !== 'PGRST116') {
      throw residentError;
    }

    return {
      ...profileData,
      apartment: residentData?.apartments
        ? {
            number: residentData.apartments.number,
            id: residentData.apartments.id,
          }
        : null,
      building: residentData?.apartments?.buildings
        ? {
            name: residentData.apartments.buildings.name,
            id: residentData.apartments.buildings.id,
          }
        : null,
      type: 'morador',
    };
  }

  // If not found in profiles, try visitors table (visitante_aprovado)
  const { data: visitorData, error: visitorError } = await supabase
    .from('visitors')
    .select(`
      id,
      name,
      document,
      phone,
      photo_url,
      status,
      apartment_id,
      apartments!inner(
        id,
        number,
        building_id,
        buildings!inner(
          id,
          name
        )
      )
    `)
    .eq('document', cleanCPF)
    .eq('status', 'aprovado')
    .maybeSingle();

  if (visitorError) {
    throw visitorError;
  }

  if (!visitorData) {
    return null;
  }

  return {
    id: visitorData.id,
    name: visitorData.name,
    full_name: visitorData.name,
    cpf: visitorData.document,
    email: null,
    phone: visitorData.phone,
    avatar_url: visitorData.photo_url,
    apartment: visitorData.apartments
      ? {
          number: visitorData.apartments.number,
          id: visitorData.apartments.id,
        }
      : null,
    building: visitorData.apartments?.buildings
      ? {
          name: visitorData.apartments.buildings.name,
          id: visitorData.apartments.buildings.id,
        }
      : null,
    type: 'visitante_aprovado',
  };
}

export async function searchVehicleByPlate(rawPlate: string): Promise<PorteiroVehicleProfile | null> {
  const cleanPlate = rawPlate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const formattedPlate =
    cleanPlate.length === 7 ? `${cleanPlate.slice(0, 3)}-${cleanPlate.slice(3)}` : cleanPlate;

  const { data: vehicleData, error: vehicleError } = await supabase
    .from('vehicles')
    .select(`
      id,
      license_plate,
      brand,
      model,
      color,
      type,
      apartment_id,
      apartments!inner(
        id,
        number,
        building_id,
        buildings!inner(
          id,
          name
        )
      )
    `)
    .or(`license_plate.ilike.%${cleanPlate}%,license_plate.ilike.%${formattedPlate}%`)
    .maybeSingle();

  if (vehicleError) {
    throw vehicleError;
  }

  if (!vehicleData) {
    return null;
  }

  return {
    ...vehicleData,
    apartment: vehicleData.apartments
      ? {
          number: vehicleData.apartments.number,
          id: vehicleData.apartments.id,
        }
      : null,
    building: vehicleData.apartments?.buildings
      ? {
          name: vehicleData.apartments.buildings.name,
          id: vehicleData.apartments.buildings.id,
        }
      : null,
  };
}

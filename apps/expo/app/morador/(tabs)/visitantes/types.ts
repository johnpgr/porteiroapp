export type VehicleType = 'car' | 'motorcycle' | 'truck' | 'van' | 'bus' | 'other';

export interface Visitor {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  photo_url: string | null;
  access_type?: 'direto' | 'com_aprovacao';
  status: string | null;
  visitor_type: string;
  created_at: string;
  updated_at: string;
  apartment_id: string;
  registration_token?: string;
  token_expires_at?: string;
  visit_date?: string | null;
  visit_start_time?: string | null;
  visit_end_time?: string | null;
}

export interface Vehicle {
  id: string;
  license_plate: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  type?: VehicleType | null;
  apartment_id: string;
  ownership_type: 'visita' | 'proprietario';
  created_at: string;
}

export interface PreRegistrationData {
  name: string;
  phone: string;
  visit_type: 'pontual' | 'frequente' | 'prestador_servico';
  access_type?: 'com_aprovacao' | 'direto';
  visit_date?: string;
  visit_start_time?: string;
  visit_end_time?: string;
  allowed_days?: string[];
  max_simultaneous_visits?: number;
  validity_start?: string;
  validity_end?: string;
}

export interface MultipleVisitor {
  name: string;
  phone: string;
}

export interface VehicleFormState {
  license_plate: string;
  brand: string;
  model: string;
  color: string;
  type: VehicleType | '';
}

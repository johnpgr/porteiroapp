import type { Tables } from '@porteiroapp/common/supabase';

export type AuthUserRole = 'morador' | 'porteiro' | 'admin' | 'visitante';

/**
 * Base profile fields shared between profiles and admin_profiles tables
 */
type BaseProfile = Pick<
  Tables<'profiles'>,
  'id' | 'email' | 'phone' | 'building_id' | 'push_token' | 'user_type' | 'role'
>;

/**
 * Admin-specific profile fields from admin_profiles table
 */
type AdminProfile = Pick<
  Tables<'admin_profiles'>,
  'id' | 'email' | 'phone' | 'push_token' | 'is_active'
>;

/**
 * Authenticated user with complete profile data.
 * Derived directly from database schema types (Tables<'profiles'> or Tables<'admin_profiles'>).
 * Represents a user that has successfully authenticated and has profile data loaded.
 */
export interface AuthUser {
  /** Auth user ID from auth.users table */
  id: string;
  
  /** Profile primary key from profiles.id or admin_profiles.id - always present after authentication */
  profile_id: string;
  
  /** User email from profile table */
  email: string;
  
  /** User type/role - determines access permissions and routing */
  user_type: AuthUserRole;
  
  /** Legacy role field - kept for backwards compatibility, prefer user_type */
  role?: AuthUserRole;
  
  // Fields from profiles table (database schema)
  /** Building ID from profiles.building_id */
  building_id: Tables<'profiles'>['building_id'];
  
  /** Push notification token from profiles.push_token or admin_profiles.push_token */
  push_token: Tables<'profiles'>['push_token'];
  
  /** User's phone from profiles.phone */
  telefone: Tables<'profiles'>['phone'];
  
  /** User's full name from profiles.full_name */
  nome: Tables<'profiles'>['full_name'];
  
  /** Whether user is active (from admin_profiles.is_active or defaults to true for profiles) */
  is_active?: boolean;
  
  /** Last login timestamp from profiles.last_seen */
  last_login: Tables<'profiles'>['last_seen'];
  
  // Computed/joined fields (not in single table)
  /** Apartment ID - resolved via apartment_residents join (only for moradores) */
  apartment_id?: string | null;
  
  /** Apartment number - resolved via apartments join (only for moradores) */
  apartment_number?: string | null;
  
  /** Legacy field - deprecated, kept for backwards compatibility */
  condominium_id?: string | null;
  
  /** Additional profile data - deprecated, prefer typed fields */
  profile?: Record<string, unknown>;
}

export interface TokenData {
  token: string;
  expiresAt: number;
  issuedAt: number;
}

export interface SessionState {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  isReadOnly: boolean;
}

export interface StorageAdapter {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  getUserData(): Promise<AuthUser | null>;
  setUserData(user: AuthUser): Promise<void>;
  clearAll(): Promise<void>;
}

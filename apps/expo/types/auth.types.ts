export type AuthUserRole = 'morador' | 'porteiro' | 'admin' | 'visitante';

export interface AuthUser {
  id: string;
  email: string;
  user_type: AuthUserRole;
  role?: AuthUserRole;
  condominium_id?: string;
  building_id?: string;
  apartment_id?: string;
  apartment_number?: string;
  nome?: string;
  telefone?: string;
  is_active?: boolean;
  last_login?: string;
  push_token?: string;
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

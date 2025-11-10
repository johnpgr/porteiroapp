import type { Tables } from '@porteiroapp/common/supabase';

/**
 * Authenticated profile with user_type discriminator
 */
export type AuthProfile = Tables<'profiles'> & {
  user_type: 'morador' | 'porteiro';
};

/**
 * Authenticated admin profile with user_type discriminator
 */
export type AuthAdminProfile = Tables<'admin_profiles'> & {
  user_type: 'admin';
};

/**
 * Discriminated union of all authenticated user types
 */
export type AuthUser = AuthProfile | AuthAdminProfile;

/**
 * Type guards for discriminating user types
 */
export const isAdminUser = (user: AuthUser): user is AuthAdminProfile =>
  user.user_type === 'admin';

export const isRegularUser = (user: AuthUser): user is AuthProfile =>
  user.user_type !== 'admin';

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

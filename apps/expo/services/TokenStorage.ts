import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import FeatureFlags from './FeatureFlags';
import type { AuthUser } from '~/types/auth.types';
import NativeSecureTokenStorage from '~/modules/SecureTokenStorage';

const TOKEN_KEY = '@porteiro_app:jwt_token';
const USER_DATA_KEY = '@porteiro_app:user_data';
const EXPIRY_KEY = '@porteiro_app:token_expiry';
const MIGRATION_KEY = '@porteiro_app:migrated_to_secure';
const CHUNK_SIZE = 1800;
const SECURE_STORE_SUPPORTED = Platform.OS !== 'web';

const getChunkCountKey = (key: string) => `${key}_chunk_count`;
const getChunkKey = (key: string, index: number) => `${key}_chunk_${index}`;

const sanitizeSecureKey = (key: string): string =>
  key.replace(/[^A-Za-z0-9._-]/g, '_');

type NativeModule = {
  getToken: (key: string) => Promise<string | null>;
  setToken: (key: string, value: string) => Promise<void>;
  deleteToken: (key: string) => Promise<void>;
};

const hasNativeSecureStore =
  !!NativeSecureTokenStorage &&
  typeof NativeSecureTokenStorage.getToken === 'function' &&
  typeof NativeSecureTokenStorage.setToken === 'function' &&
  typeof NativeSecureTokenStorage.deleteToken === 'function';

const nativeModule: NativeModule | null = hasNativeSecureStore
  ? ({
      getToken: NativeSecureTokenStorage!.getToken,
      setToken: NativeSecureTokenStorage!.setToken,
      deleteToken: NativeSecureTokenStorage!.deleteToken,
    } as NativeModule)
  : null;

const setSecureItem = async (key: string, value: string): Promise<void> => {
  const sanitized = sanitizeSecureKey(key);
  if (nativeModule) {
    await nativeModule.setToken(sanitized, value);
    if (sanitized !== key) {
      await nativeModule.deleteToken(key).catch(() => {});
    }
  } else {
    await SecureStore.setItemAsync(sanitized, value);
    if (sanitized !== key) {
      await SecureStore.deleteItemAsync(key).catch(() => {});
    }
  }
};

const getSecureItem = async (key: string): Promise<string | null> => {
  const sanitized = sanitizeSecureKey(key);
  if (nativeModule) {
    const value = await nativeModule.getToken(sanitized);
    if (value != null) {
      return value;
    }
    if (sanitized !== key) {
      return nativeModule.getToken(key).catch(() => null);
    }
    return null;
  }

  const value = await SecureStore.getItemAsync(sanitized);
  if (value != null) {
    return value;
  }
  if (sanitized !== key) {
    return SecureStore.getItemAsync(key).catch(() => null);
  }
  return null;
};

const deleteSecureItem = async (key: string): Promise<void> => {
  const sanitized = sanitizeSecureKey(key);
  if (nativeModule) {
    await nativeModule.deleteToken(sanitized).catch(() => {});
    if (sanitized !== key) {
      await nativeModule.deleteToken(key).catch(() => {});
    }
  } else {
    await SecureStore.deleteItemAsync(sanitized).catch(() => {});
    if (sanitized !== key) {
      await SecureStore.deleteItemAsync(key).catch(() => {});
    }
  }
};

export type StoredUserData = AuthUser & {
  role: 'morador' | 'porteiro' | 'admin';
  profile?: any;
};

async function saveTokenSecurely(key: string, value: string): Promise<void> {
  if (!SECURE_STORE_SUPPORTED) {
    throw new Error('SecureStore is not supported on this platform');
  }

  if (value.length <= CHUNK_SIZE) {
    await setSecureItem(key, value);
    await deleteSecureItem(getChunkCountKey(key));
    return;
  }

  const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
  await setSecureItem(getChunkCountKey(key), String(chunkCount));

  for (let i = 0; i < chunkCount; i += 1) {
    const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const chunkKey = getChunkKey(key, i);
    await setSecureItem(chunkKey, chunk);
  }
}

async function getTokenSecurely(key: string): Promise<string | null> {
  if (!SECURE_STORE_SUPPORTED) {
    return null;
  }

  const chunkCountRaw = await getSecureItem(getChunkCountKey(key));
  if (!chunkCountRaw) {
    return getSecureItem(key);
  }

  const chunkCount = parseInt(chunkCountRaw, 10);
  if (!Number.isFinite(chunkCount) || chunkCount <= 0) {
    await deleteSecureItem(getChunkCountKey(key));
    return null;
  }

  const chunks: string[] = [];
  for (let index = 0; index < chunkCount; index += 1) {
    const chunkKey = getChunkKey(key, index);
    const chunk = await getSecureItem(chunkKey);
    if (chunk) {
      chunks.push(chunk);
    }
  }

  if (!chunks.length) {
    return null;
  }

  return chunks.join('');
}

async function deleteTokenSecurely(key: string): Promise<void> {
  if (!SECURE_STORE_SUPPORTED) {
    return;
  }

  const chunkCountRaw = await getSecureItem(getChunkCountKey(key));
  if (chunkCountRaw) {
    const chunkCount = parseInt(chunkCountRaw, 10);
    for (let index = 0; index < chunkCount; index += 1) {
      await deleteSecureItem(getChunkKey(key, index));
    }
    await deleteSecureItem(getChunkCountKey(key));
  }

  await deleteSecureItem(key);
}

export class TokenStorage {
  private static lastSavedToken: string | null = null;
  private static lastSaveTime = 0;
  private static readonly SAVE_DEBOUNCE_MS = 1000;
  private static migrationPromise: Promise<void> | null = null;
  private static migrationCompleted = false;

  private static async shouldUseSecureStore(): Promise<boolean> {
    if (!SECURE_STORE_SUPPORTED) {
      return false;
    }

    try {
      return await FeatureFlags.isEnabled('use_secure_store', true);
    } catch (error) {
      console.error('[TokenStorage] Failed to read feature flag use_secure_store:', error);
      return true;
    }
  }

  private static async ensureMigration(): Promise<void> {
    if (this.migrationCompleted || !SECURE_STORE_SUPPORTED) {
      if (!SECURE_STORE_SUPPORTED) {
        this.migrationCompleted = true;
      }
      return;
    }

    if (this.migrationPromise) {
      await this.migrationPromise;
      return;
    }

    this.migrationPromise = (async () => {
      const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_KEY);
      if (alreadyMigrated === 'true') {
        this.migrationCompleted = true;
        return;
      }

      const useSecureStore = await this.shouldUseSecureStore();
      if (!useSecureStore) {
        return;
      }

      try {
        const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (legacyToken) {
          await saveTokenSecurely(TOKEN_KEY, legacyToken);
          await AsyncStorage.removeItem(TOKEN_KEY);
          console.log('[TokenStorage] Migrated legacy token to SecureStore');
        }

        await AsyncStorage.setItem(MIGRATION_KEY, 'true');
        this.migrationCompleted = true;
      } catch (error) {
        console.error('[TokenStorage] Failed to migrate token to SecureStore:', error);
      }
    })().finally(() => {
      this.migrationPromise = null;
    });

    await this.migrationPromise;
  }

  private static async storeTokenValue(token: string): Promise<void> {
    const useSecureStore = await this.shouldUseSecureStore();

    if (useSecureStore) {
      try {
        await saveTokenSecurely(TOKEN_KEY, token);
        await AsyncStorage.removeItem(TOKEN_KEY);
        return;
      } catch (error) {
        console.error('[TokenStorage] SecureStore save failed, falling back to AsyncStorage:', error);
        try {
          await deleteTokenSecurely(TOKEN_KEY);
        } catch (cleanupError) {
          console.warn('[TokenStorage] Failed to cleanup secure chunks after error:', cleanupError);
        }
      }
    }

    await AsyncStorage.setItem(TOKEN_KEY, token);
  }

  static async saveToken(token: string, expiresIn?: number): Promise<void> {
    try {
      if (this.lastSavedToken === token) {
        return;
      }

      const now = Date.now();
      if (now - this.lastSaveTime < this.SAVE_DEBOUNCE_MS) {
        return;
      }

      await this.ensureMigration();
      await this.storeTokenValue(token);

      if (expiresIn) {
        const expiryTime = now + expiresIn * 1000;
        await AsyncStorage.setItem(EXPIRY_KEY, expiryTime.toString());
      }

      this.lastSavedToken = token;
      this.lastSaveTime = now;
    } catch (error) {
      console.error('[TokenStorage] Error while saving token:', error);
      throw error;
    }
  }

  static async saveUserData(userData: StoredUserData): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    } catch (error) {
      console.error('[TokenStorage] Error while saving user data:', error);
      throw error;
    }
  }

  static async getToken(): Promise<string | null> {
    try {
      await this.ensureMigration();

      if (SECURE_STORE_SUPPORTED) {
        const secureToken = await getTokenSecurely(TOKEN_KEY);
        if (secureToken) {
          return secureToken;
        }
      }

      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('[TokenStorage] Error while retrieving token:', error);
      return null;
    }
  }

  static async getUserData(): Promise<StoredUserData | null> {
    try {
      const userDataRaw = await AsyncStorage.getItem(USER_DATA_KEY);
      if (!userDataRaw) {
        return null;
      }

      const parsed = JSON.parse(userDataRaw) as StoredUserData;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid user data payload');
      }

      if (!parsed.id || !parsed.email) {
        throw new Error('Missing required user fields');
      }

      return parsed;
    } catch (error) {
      console.error('[TokenStorage] Corrupted user data detected, clearing storage:', error);
      await this.clearAll();
      return null;
    }
  }

  static async isTokenExpired(): Promise<boolean> {
    try {
      const expiryTime = await AsyncStorage.getItem(EXPIRY_KEY);
      if (!expiryTime) {
        return false;
      }

      const expiry = parseInt(expiryTime, 10);
      if (!Number.isFinite(expiry)) {
        await AsyncStorage.removeItem(EXPIRY_KEY);
        return true;
      }

      return Date.now() >= expiry;
    } catch (error) {
      console.error('[TokenStorage] Error while checking token expiry:', error);
      return true;
    }
  }

  static isTokenValid(token: string): boolean {
    if (!token) {
      return false;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      return typeof payload.exp === 'number' && payload.exp > now;
    } catch (error) {
      console.error('[TokenStorage] Failed to validate token:', error);
      return false;
    }
  }

  static async hasValidToken(): Promise<boolean> {
    try {
      const token = await this.getToken();
      return token !== null && this.isTokenValid(token);
    } catch (error) {
      console.error('[TokenStorage] Error while checking stored token:', error);
      return false;
    }
  }

  static async clearToken(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.multiRemove([TOKEN_KEY, EXPIRY_KEY]),
        deleteTokenSecurely(TOKEN_KEY),
      ]);
      this.lastSavedToken = null;
      this.lastSaveTime = 0;
    } catch (error) {
      console.error('[TokenStorage] Error while clearing token:', error);
      throw error;
    }
  }

  static async clearAll(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.multiRemove([TOKEN_KEY, EXPIRY_KEY, USER_DATA_KEY, MIGRATION_KEY]),
        deleteTokenSecurely(TOKEN_KEY),
      ]);

      this.lastSavedToken = null;
      this.lastSaveTime = 0;
      this.migrationCompleted = false;
    } catch (error) {
      console.error('[TokenStorage] Error while clearing all storage:', error);
      throw error;
    }
  }

  static async updateUserData(userData: Partial<StoredUserData>): Promise<void> {
    try {
      const currentData = await this.getUserData();
      const mergedData = {
        ...(currentData ?? {}),
        ...userData,
      } as StoredUserData;

      await this.saveUserData(mergedData);
    } catch (error) {
      console.error('[TokenStorage] Error while updating user data:', error);
      throw error;
    }
  }

  static async getStorageInfo(): Promise<{
    hasToken: boolean;
    hasUserData: boolean;
    isExpired: boolean;
    userData?: StoredUserData;
  }> {
    try {
      const [token, userData, isExpired] = await Promise.all([
        this.getToken(),
        this.getUserData(),
        this.isTokenExpired(),
      ]);

      return {
        hasToken: !!token,
        hasUserData: !!userData,
        isExpired,
        userData: userData ?? undefined,
      };
    } catch (error) {
      console.error('[TokenStorage] Error while collecting storage info:', error);
      return {
        hasToken: false,
        hasUserData: false,
        isExpired: true,
      };
    }
  }
}

export default TokenStorage;

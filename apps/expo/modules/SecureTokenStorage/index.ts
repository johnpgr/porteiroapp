import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeSecureTokenStorage = {
  getToken(key: string): Promise<string | null>;
  setToken(key: string, value: string): Promise<void>;
  deleteToken(key: string): Promise<void>;
};

const SecureTokenStorage =
  requireOptionalNativeModule<NativeSecureTokenStorage>('SecureTokenStorage');

export default SecureTokenStorage;

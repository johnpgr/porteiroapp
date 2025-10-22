import { TypedSupabaseClient } from '../core/client';
import { UnifiedSupabaseClient, UnifiedSupabaseClientOptions } from '../client/unifiedClient';
import { 
  BrowserPlatformDetector, 
  ReactNativePlatformDetector, 
  ServerPlatformDetector,
  PlatformDetector 
} from '../utils/platform';

export interface ClientFactoryOptions {
  url: string;
  anonKey: string;
  storage?: any;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Factory para criar clientes Supabase para diferentes ambientes
 */
export class SupabaseClientFactory {
  /**
   * Criar cliente para ambiente React Native
   */
  static createReactNativeClient(
    platformOS: string,
    options: ClientFactoryOptions
  ): { client: TypedSupabaseClient; unified: UnifiedSupabaseClient } {
    const platformDetector = new ReactNativePlatformDetector(platformOS);
    
    const unified = new UnifiedSupabaseClient({
      url: options.url,
      anonKey: options.anonKey,
      platformDetector,
      storage: options.storage,
      logLevel: options.logLevel,
    });

    return {
      client: unified.getClient(),
      unified,
    };
  }

  /**
   * Criar cliente para ambiente Browser/Web
   */
  static createBrowserClient(
    options: ClientFactoryOptions
  ): { client: TypedSupabaseClient; unified: UnifiedSupabaseClient } {
    const platformDetector = new BrowserPlatformDetector();
    
    const unified = new UnifiedSupabaseClient({
      url: options.url,
      anonKey: options.anonKey,
      platformDetector,
      storage: options.storage,
      logLevel: options.logLevel,
    });

    return {
      client: unified.getClient(),
      unified,
    };
  }

  /**
   * Criar cliente para ambiente Server
   */
  static createServerClient(
    options: ClientFactoryOptions
  ): { client: TypedSupabaseClient; unified: UnifiedSupabaseClient } {
    const platformDetector = new ServerPlatformDetector();
    
    const unified = new UnifiedSupabaseClient({
      url: options.url,
      anonKey: options.anonKey,
      platformDetector,
      logLevel: options.logLevel,
    });

    return {
      client: unified.getClient(),
      unified,
    };
  }

  /**
   * Criar cliente com detector customizado
   */
  static createCustomClient(
    platformDetector: PlatformDetector,
    options: ClientFactoryOptions
  ): { client: TypedSupabaseClient; unified: UnifiedSupabaseClient } {
    const unified = new UnifiedSupabaseClient({
      url: options.url,
      anonKey: options.anonKey,
      platformDetector,
      storage: options.storage,
      logLevel: options.logLevel,
    });

    return {
      client: unified.getClient(),
      unified,
    };
  }
}

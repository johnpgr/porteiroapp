import type { TypedSupabaseClient } from '../core/client.ts';
import { UnifiedSupabaseClient } from '../client/unifiedClient.ts';
import { 
  BrowserPlatformDetector, 
  ReactNativePlatformDetector, 
  ServerPlatformDetector,
  type PlatformDetector 
} from '../utils/platform.ts';

export interface ClientFactoryOptions {
  url: string;
  key: string;
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
      key: options.key,
      platformDetector,
      ...(options.storage !== undefined && { storage: options.storage }),
      ...(options.logLevel !== undefined && { logLevel: options.logLevel }),
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
      key: options.key,
      platformDetector,
      ...(options.storage !== undefined && { storage: options.storage }),
      ...(options.logLevel !== undefined && { logLevel: options.logLevel }),
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
      key: options.key,
      platformDetector,
      ...(options.logLevel !== undefined && { logLevel: options.logLevel }),
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
      key: options.key,
      platformDetector,
      ...(options.storage !== undefined && { storage: options.storage }),
      ...(options.logLevel !== undefined && { logLevel: options.logLevel }),
    });

    return {
      client: unified.getClient(),
      unified,
    };
  }
}

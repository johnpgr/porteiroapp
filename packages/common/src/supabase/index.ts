// Export core client and types
export {
  createSupabaseClient,
  createBrowserClient,
  createServerClient,
} from './core/client';
export type { TypedSupabaseClient, SupabaseConfig } from './core/client';
export type { Database, Json } from './types/database';

// Export main factory
export { SupabaseClientFactory } from './factories/clientFactory';
export type { ClientFactoryOptions } from './factories/clientFactory';

// Export unified client
export { UnifiedSupabaseClient } from './client/unifiedClient';
export type { UnifiedSupabaseClientOptions } from './client/unifiedClient';

// Export platform utilities
export {
  BrowserPlatformDetector,
  ReactNativePlatformDetector,
  ServerPlatformDetector,
} from './utils/platform';
export type { PlatformDetector, PlatformType } from './utils/platform';

// Export config manager
export { PlatformConfigManager } from './config/platformConfig';
export type { PlatformAuthConfig } from './config/platformConfig';

// Export logger
export { AuthLogger } from './utils/logger';
export type { LogLevel, LogEntry } from './utils/logger';

export type { RealtimeChannel } from '@supabase/supabase-js';

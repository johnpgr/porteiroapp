# Unified Supabase Client

This module provides a unified Supabase client configuration that works across all platforms (iOS, Android, Web, and Server) with platform-specific optimizations.

**Location:** `@porteiroapp/common/supabase`

This consolidates all Supabase-related functionality (types, client creation, and platform optimizations) into a single, well-organized module within the common package.

## Features

- **Platform Detection**: Automatically detects the platform and applies appropriate configurations
- **Adaptive Timeouts**: Different timeout values based on platform (iOS has longer timeouts due to known connectivity issues)
- **Automatic Retry**: Built-in retry logic with exponential backoff for network errors
- **Logging**: Comprehensive logging system with different log levels
- **Type Safety**: Full TypeScript support with typed Supabase client

## Usage

### React Native (Expo)

```typescript
import { Platform } from 'react-native';
import { SupabaseClientFactory } from '@porteiroapp/common';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { client, unified } = SupabaseClientFactory.createReactNativeClient(
  Platform.OS,
  {
    url: 'YOUR_SUPABASE_URL',
    key: 'YOUR_SUPABASE_ANON_KEY',
    storage: AsyncStorage,
    logLevel: 'info',
  }
);

// Use the client directly
const { data, error } = await client.from('table').select('*');

// Or use unified methods with automatic retry and timeout
const result = await unified.signInWithPassword(email, password);
```

### Next.js / Browser

```typescript
import { SupabaseClientFactory } from '@porteiroapp/common';

const { client, unified } = SupabaseClientFactory.createBrowserClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  logLevel: 'error',
});

export const supabase = client;
```

### Server (Node.js)

```typescript
import { SupabaseClientFactory } from '@porteiroapp/common';

const { client, unified } = SupabaseClientFactory.createServerClient({
  url: process.env.SUPABASE_URL!,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  logLevel: 'error',
});
```

## Platform-Specific Configurations

### iOS
- **Auth Timeout**: 25s (longer due to connectivity issues)
- **Max Retries**: 3
- **PKCE**: Enabled
- **Heartbeat**: 30s
- **Detailed Logs**: Enabled in development

### Android
- **Auth Timeout**: 20s
- **Max Retries**: 2
- **PKCE**: Enabled
- **Heartbeat**: 45s

### Web
- **Auth Timeout**: 15s
- **Max Retries**: 2
- **PKCE**: Enabled
- **Heartbeat**: 60s

### Server
- **Auth Timeout**: 10s
- **Max Retries**: 1
- **PKCE**: Disabled
- **Heartbeat**: Disabled

## Advanced Usage

### Custom Timeout

```typescript
// Use custom timeout for specific operations
const result = await unified.withTimeout(
  client.from('table').select('*'),
  'profile' // 'auth' | 'profile' | 'refresh'
);
```

### Manual Retry

```typescript
// Retry any operation
const result = await unified.withRetry(
  async () => {
    return await client.from('table').select('*');
  },
  'custom-operation'
);
```

### Access Configuration

```typescript
const configManager = unified.getConfigManager();
const config = configManager.getConfig();

console.log('Auth timeout:', config.authTimeout);
console.log('Max retries:', config.maxRetries);
```

### Logging

```typescript
const logger = unified.getLogger();

// Get all logs
const logs = logger.getLogs();

// Get error logs only
const errors = logger.getLogs('error');

// Export logs
const logsString = logger.exportLogs();
```

## Migration Guide

### From Old Expo Implementation

**Before:**
```typescript
import { supabase } from './utils/supabase';
```

**After:**
```typescript
import { supabase } from './utils/supabaseUnified';
```

The API remains the same, but now you get automatic retry, timeout, and platform-specific optimizations.

### From Old Next.js Implementation

**Before:**
```typescript
import { supabase } from '@/lib/supabase';
```

**After:**
```typescript
import { supabase } from '@/lib/supabaseUnified';
```

No changes needed in your application code.

## Architecture

```
@porteiroapp/common/src/supabase/
├── client/
│   └── unifiedClient.ts      # Main unified client implementation
├── config/
│   └── platformConfig.ts     # Platform-specific configurations
├── factories/
│   └── clientFactory.ts      # Factory for creating clients
├── utils/
│   ├── logger.ts             # Logging utility
│   └── platform.ts           # Platform detection
└── index.ts                  # Public API
```

## Benefits

1. **Single Source of Truth**: All Supabase configuration in one place
2. **Platform Optimizations**: Automatic platform-specific optimizations
3. **Better Error Handling**: Built-in retry and timeout logic
4. **Easier Testing**: Mock platform detector for testing
5. **Maintainability**: Update configuration once, applies everywhere
6. **Type Safety**: Full TypeScript support across all platforms

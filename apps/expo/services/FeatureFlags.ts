import { supabase } from '../utils/supabase';

interface FeatureFlagRecord {
  feature_key: string;
  enabled: boolean;
  metadata?: Record<string, unknown> | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class FeatureFlagService {
  private cache = new Map<string, boolean>();
  private metadata = new Map<string, Record<string, unknown>>();
  private lastFetch = 0;
  private pendingFetch: Promise<void> | null = null;

  async preload(): Promise<void> {
    await this.ensureFreshFlags();
  }

  async isEnabled(featureKey: string, fallback = false): Promise<boolean> {
    await this.ensureFreshFlags();
    if (this.cache.has(featureKey)) {
      return this.cache.get(featureKey) ?? fallback;
    }
    return fallback;
  }

  getMetadata(featureKey: string): Record<string, unknown> | undefined {
    return this.metadata.get(featureKey);
  }

  private async ensureFreshFlags(): Promise<void> {
    if (Date.now() - this.lastFetch < CACHE_TTL_MS && this.cache.size > 0) {
      return;
    }

    if (this.pendingFetch) {
      await this.pendingFetch;
      return;
    }

    this.pendingFetch = this.fetchFlags().finally(() => {
      this.pendingFetch = null;
    });

    await this.pendingFetch;
  }

  private async fetchFlags(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('feature_key, enabled, metadata');

      if (error) {
        throw error;
      }

      this.cache.clear();
      this.metadata.clear();

      data?.forEach((flag) => {
        this.cache.set(flag.feature_key, flag.enabled);
        if (flag.metadata) {
          this.metadata.set(flag.feature_key, flag.metadata as Record<string, unknown>);
        }
      });

      this.lastFetch = Date.now();
      console.log('[FeatureFlags] Loaded flags:', this.cache.size);
    } catch (error) {
      const errorCode = (error as { code?: string } | undefined)?.code;
      if (errorCode === 'PGRST205') {
        console.warn('[FeatureFlags] app_config table not found; using defaults');
      } else {
        console.error('[FeatureFlags] Failed to fetch flags:', error);
      }
      // Keep stale cache if available
      if (this.cache.size === 0) {
        this.lastFetch = 0;
      }
    }
  }
}

export default new FeatureFlagService();

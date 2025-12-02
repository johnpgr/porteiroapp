interface PerformanceMetric {
  event: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

class AnalyticsTracker {
  private startTimes: Map<string, number> = new Map();

  startTiming(event: string): void {
    this.startTimes.set(event, Date.now());
    console.log(`[Metrics] Started: ${event}`);
  }

  endTiming(event: string, metadata?: Record<string, unknown>): void {
    const startTime = this.startTimes.get(event);

    if (!startTime) {
      console.warn(`[Metrics] No start time for: ${event}`);
      return;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(event);

    const metric: PerformanceMetric = {
      event,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    console.log(`[Metrics] ${event}: ${duration}ms`, metadata ?? {});

    // Hook for future integrations (Datadog, Sentry, etc.)
    this.sendToAnalytics(metric).catch((error) => {
      console.error('[Metrics] Failed to forward metric:', error);
    });
  }

  trackEvent(event: string, metadata?: Record<string, unknown>): void {
    console.log(`[Analytics] ${event}`, metadata ?? {});
    this.sendToAnalytics({
      event,
      duration: 0,
      timestamp: Date.now(),
      metadata,
    }).catch((error) => {
      console.error('[Analytics] Failed to track event:', error);
    });
  }

  private async sendToAnalytics(metric: PerformanceMetric): Promise<void> {
    // Placeholder for future analytics sink.
    // Example: await AnalyticsClient.log(metric)
  }
}

export default new AnalyticsTracker();

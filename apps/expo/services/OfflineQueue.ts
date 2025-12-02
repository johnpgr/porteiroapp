import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { NotificationContentInput } from 'expo-notifications';
import * as Linking from 'expo-linking';
import AnalyticsTracker from './AnalyticsTracker';

const QUEUE_KEY = '@porteiro_app:offline_queue';

export type OfflineQueueItemType = 'notification_received' | 'deep_link';

export interface QueuedItem {
  id: string;
  type: OfflineQueueItemType;
  payload: Record<string, unknown> | null;
  timestamp: number;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getQueue = async (): Promise<QueuedItem[]> => {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  if (!data) {
    return [];
  }

  try {
    const parsed = JSON.parse(data) as QueuedItem[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.error('[OfflineQueue] Failed to parse queue, clearing:', error);
    await AsyncStorage.removeItem(QUEUE_KEY);
    return [];
  }
};

const saveQueue = async (items: QueuedItem[]): Promise<void> => {
  if (!items.length) {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return;
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
};

export const queueNotification = async (
  item: Omit<QueuedItem, 'id' | 'timestamp' | 'type'> & { id?: string; type?: 'notification_received' }
): Promise<void> => {
  const queue = await getQueue();
  queue.push({
    id: item.id || generateId(),
    type: 'notification_received',
    payload: item.payload ?? null,
    timestamp: Date.now(),
  });
  await saveQueue(queue);
  console.log('[OfflineQueue] Notification queued, size:', queue.length);
  AnalyticsTracker.trackEvent('offline_queue_enqueued', {
    type: 'notification',
    size: queue.length,
  });
};

export const queueDeepLink = async (url: string): Promise<void> => {
  const queue = await getQueue();
  queue.push({
    id: generateId(),
    type: 'deep_link',
    payload: { url },
    timestamp: Date.now(),
  });
  await saveQueue(queue);
  console.log('[OfflineQueue] Deep link queued:', url);
  AnalyticsTracker.trackEvent('offline_queue_enqueued', {
    type: 'deep_link',
    size: queue.length,
  });
};

const processQueuedItem = async (item: QueuedItem): Promise<void> => {
  switch (item.type) {
    case 'notification_received': {
      const content = (item.payload?.content as NotificationContentInput) ?? {
        title: 'Notificação recebida',
        body: 'Conteúdo disponível ao reconectar.',
      };
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      });
      break;
    }
    case 'deep_link': {
      const url = typeof item.payload?.url === 'string' ? item.payload.url : null;
      if (!url) {
        throw new Error('Missing URL in deep link payload');
      }
      await Linking.openURL(url);
      break;
    }
    default:
      throw new Error(`Unsupported queue item type: ${item.type}`);
  }
};

export const processQueue = async (): Promise<void> => {
  const queue = await getQueue();
  if (!queue.length) {
    return;
  }

  const remaining: QueuedItem[] = [];

  for (const item of queue) {
    try {
      await processQueuedItem(item);
      AnalyticsTracker.trackEvent('offline_queue_item_processed', {
        type: item.type,
      });
    } catch (error) {
      console.error('[OfflineQueue] Failed to process item:', item.id, error);
      AnalyticsTracker.trackEvent('offline_queue_item_failed', {
        type: item.type,
        message: error instanceof Error ? error.message : String(error),
      });
      remaining.push(item);
    }
  }

  await saveQueue(remaining);
  AnalyticsTracker.trackEvent('offline_queue_flush_complete', {
    remaining: remaining.length,
  });
};

export const clearQueue = async (): Promise<void> => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};

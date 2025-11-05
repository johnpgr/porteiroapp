import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ProtectedRoute from '~/components/ProtectedRoute';
import { callKeepService } from '~/services/CallKeepService';
import { foregroundService } from '~/services/AndroidForegroundService';
import RNCallKeep from 'react-native-callkeep';

interface StatusSnapshot {
  platform?: string;
  hasPermissions?: boolean;
  hasActiveCall?: boolean;
  currentUUID?: string;
  foregroundRunning?: boolean;
  timestamp?: string;
  error?: string;
  verboseLogging?: boolean;
}

export default function CallKeepStatus(): JSX.Element {
  const [status, setStatus] = useState<StatusSnapshot>({});
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      let hasPermissions = true;
      if (Platform.OS === 'android') {
        hasPermissions = await RNCallKeep.checkPhoneAccountEnabled();
      }

      const hasActiveCall = callKeepService.hasActiveCall();
      const currentUUID = callKeepService.getCurrentCallUUID();
      const foregroundRunning = Platform.OS === 'android' ? foregroundService.isServiceRunning() : false;

      setStatus({
        platform: Platform.OS,
        hasPermissions,
        hasActiveCall,
        currentUUID: currentUUID ?? 'None',
        foregroundRunning,
        verboseLogging: callKeepService.isVerboseLoggingEnabled(),
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (error) {
      console.error('[CallKeepStatus] Failed to check status:', error);
      setStatus({
        error: String(error),
        timestamp: new Date().toLocaleTimeString(),
        verboseLogging: callKeepService.isVerboseLoggingEnabled(),
      });
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await checkStatus();
    setRefreshing(false);
  };

  const toggleVerboseLogging = () => {
    const next = !status.verboseLogging;
    callKeepService.enableVerboseLogging(next);
    setStatus((prev) => ({
      ...prev,
      verboseLogging: next,
      timestamp: new Date().toLocaleTimeString(),
    }));
  };

  return (
    <ProtectedRoute requiredRole="morador">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>CallKeep Status</Text>

        {status.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Error: {status.error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.statusItem}>
              <Text style={styles.label}>Platform</Text>
              <Text style={styles.value}>{status.platform}</Text>
            </View>

            <View style={styles.statusItem}>
              <Text style={styles.label}>Permissions Granted</Text>
              <Text style={[styles.value, status.hasPermissions ? styles.success : styles.failure]}>
                {status.hasPermissions ? '✅ YES' : '❌ NO'}
              </Text>
            </View>

            <View style={styles.statusItem}>
              <Text style={styles.label}>Active Call</Text>
              <Text style={[styles.value, status.hasActiveCall ? styles.success : styles.normal]}>
                {status.hasActiveCall ? '📞 YES' : 'No'}
              </Text>
            </View>

            <View style={styles.statusItem}>
              <Text style={styles.label}>Current Call UUID</Text>
              <Text style={styles.value}>{status.currentUUID}</Text>
            </View>

            {Platform.OS === 'android' && (
              <View style={styles.statusItem}>
                <Text style={styles.label}>Foreground Service</Text>
                <Text style={[styles.value, status.foregroundRunning ? styles.success : styles.normal]}>
                  {status.foregroundRunning ? '🚀 Running' : 'Stopped'}
                </Text>
              </View>
            )}

            <View style={styles.statusItem}>
              <Text style={styles.label}>Verbose Logging</Text>
              <Text style={styles.value}>{status.verboseLogging ? 'ON' : 'OFF'}</Text>
            </View>

            <View style={styles.statusItem}>
              <Text style={styles.label}>Last Updated</Text>
              <Text style={styles.value}>{status.timestamp}</Text>
            </View>

            <View style={styles.actions}>
              <Button
                title={`Toggle Verbose Logging (${status.verboseLogging ? 'ON' : 'OFF'})`}
                onPress={toggleVerboseLogging}
              />
            </View>
          </>
        )}

        <Text style={styles.note}>Pull down to refresh status</Text>
      </ScrollView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
    color: '#333333',
  },
  statusItem: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 6,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  success: {
    color: '#4caf50',
  },
  failure: {
    color: '#e53935',
  },
  normal: {
    color: '#333333',
  },
  actions: {
    marginTop: 12,
  },
  note: {
    fontSize: 12,
    color: '#999999',
    marginTop: 24,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
});

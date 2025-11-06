import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import ProtectedRoute from '~/components/ProtectedRoute';
import { callKeepService } from '~/services/CallKeepService';

export default function MoradorSettings() {
  const handleTestCall = async () => {
    try {
      const testCallUUID = `test-${Date.now()}`;
      await callKeepService.displayIncomingCall(testCallUUID, 'Test Doorman', 'Apt 123', false);
      console.log('[MoradorSettings] ✅ Test CallKeep incoming call displayed');
    } catch (error) {
      console.error('[MoradorSettings] ❌ Test CallKeep incoming call failed:', error);
      Alert.alert('Test Failed', String(error));
    }
  };

  const navigateToStatus = () => {
    router.push('/morador/callkeep-status');
  };

  return (
    <ProtectedRoute requiredRole="morador">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Developer Tools</Text>
          <Text style={styles.subtitle}>
            Use these tools to debug CallKeep behaviour during intercom calls.
          </Text>

          <View style={styles.actions}>
            <Button title="🧪 Test CallKeep UI" onPress={handleTestCall} />
            <View style={styles.spacer} />
            <Button title="📊 View Status" onPress={navigateToStatus} />
          </View>
        </View>
      </ScrollView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#f5f5f5',
    justifyContent: 'flex-start',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    color: '#333333',
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'column',
  },
  spacer: {
    height: 12,
  },
});

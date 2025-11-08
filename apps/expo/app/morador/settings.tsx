import { ScrollView, StyleSheet } from 'react-native';
import ProtectedRoute from '~/components/ProtectedRoute';

export default function MoradorSettings() {
  return (
    <ProtectedRoute requiredRole="morador">
      <ScrollView contentContainerStyle={styles.container}>
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

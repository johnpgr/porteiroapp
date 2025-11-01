import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ProtectedRoute from '~/components/ProtectedRoute';

export default function CallsTab() {
  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <View style={styles.container}>
        <Text style={styles.placeholderText}>Em desenvolvimento</Text>
      </View>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
});

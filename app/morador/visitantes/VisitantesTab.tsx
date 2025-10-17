import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function VisitantesTab() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Gerenciar Visitantes</Text>
          <Text style={styles.sectionDescription}>
            Autorize visitantes e gerencie o acesso ao seu apartamento
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/morador/visitantes/nome')}>
            <Ionicons name="person-add" size={24} color="#fff" />
            <Text style={styles.primaryButtonText}>Autorizar Novo Visitante</Text>
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#2196F3" />
            <Text style={styles.infoText}>
              Você pode pré-autorizar visitantes para facilitar a entrada no condomínio.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976d2',
    marginLeft: 12,
    lineHeight: 20,
  },
});

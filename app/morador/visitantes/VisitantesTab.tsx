import React from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function VisitantesTab() {
  return (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👥 Pré-cadastro de Visitantes</Text>
        <Text style={styles.sectionDescription}>
          Cadastre visitantes esperados para facilitar a entrada
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/morador/visitantes/novo')}>
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.primaryButtonText}>Cadastrar Novo Visitante</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Visitantes Pré-cadastrados</Text>

        <View style={styles.visitorCard}>
          <Text style={styles.visitorName}>Carlos Silva</Text>
          <Text style={styles.visitorType}>🔧 Prestador de serviço</Text>
          <Text style={styles.visitorDate}>Válido até: 25/12/2024</Text>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>✏️ Editar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  visitorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  visitorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  visitorType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  visitorDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  editButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
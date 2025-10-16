import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ProtectedRoute from '~/components/ProtectedRoute';
import { useAuth } from '~/hooks/useAuth';
import NotificationTest from '~/components/NotificationTest';

export default function ConfiguracoesScreen() {
  const { user } = useAuth();
  const [showNotificationTest, setShowNotificationTest] = useState(false);

  return (
    <ProtectedRoute requiredRole="morador">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configurações</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content}>
          {/* Seção de Notificações */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notificações</Text>
            
            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => setShowNotificationTest(!showNotificationTest)}
            >
              <View style={styles.settingItemLeft}>
                <Ionicons name="notifications-outline" size={24} color="#007AFF" />
                <View style={styles.settingItemText}>
                  <Text style={styles.settingItemTitle}>Teste de Notificações</Text>
                  <Text style={styles.settingItemSubtitle}>
                    Testar funcionamento das notificações push
                  </Text>
                </View>
              </View>
              <Ionicons 
                name={showNotificationTest ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>

            {showNotificationTest && (
              <View style={styles.testContainer}>
                <NotificationTest />
              </View>
            )}

            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => router.push('/morador/testes')}
            >
              <View style={styles.settingItemLeft}>
                <Ionicons name="bug-outline" size={24} color="#FF6B35" />
                <View style={styles.settingItemText}>
                  <Text style={styles.settingItemTitle}>Sistema de Notas</Text>
                  <Text style={styles.settingItemSubtitle}>
                    Testar sistema completo de Notas e validação
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Seção de Conta */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conta</Text>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="person-outline" size={24} color="#007AFF" />
                <View style={styles.settingItemText}>
                  <Text style={styles.settingItemTitle}>Perfil</Text>
                  <Text style={styles.settingItemSubtitle}>
                    Editar informações pessoais
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="shield-outline" size={24} color="#007AFF" />
                <View style={styles.settingItemText}>
                  <Text style={styles.settingItemTitle}>Privacidade</Text>
                  <Text style={styles.settingItemSubtitle}>
                    Configurações de privacidade
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Seção de Suporte */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suporte</Text>
            
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="help-circle-outline" size={24} color="#007AFF" />
                <View style={styles.settingItemText}>
                  <Text style={styles.settingItemTitle}>Ajuda</Text>
                  <Text style={styles.settingItemSubtitle}>
                    Central de ajuda e FAQ
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="mail-outline" size={24} color="#007AFF" />
                <View style={styles.settingItemText}>
                  <Text style={styles.settingItemTitle}>Contato</Text>
                  <Text style={styles.settingItemSubtitle}>
                    Entre em contato conosco
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemText: {
    marginLeft: 12,
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingItemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  testContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
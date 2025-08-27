import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthForm from '../../components/AuthForm';
import { useAuth } from '../../hooks/useAuth';

export default function MoradorLogin() {
  const { signIn, user } = useAuth();

  // Removido useEffect de verificação automática - redirecionamento deve ocorrer apenas após login bem-sucedido

  const handleLogin = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await signIn(email, password);

      if (!result.success) {
        Alert.alert('Erro de Login', result.error || 'Erro desconhecido');
        return { success: false, error: result.error };
      }

      // Redirecionar após login bem-sucedido
      router.replace('/morador');
      return { success: true };
    } catch (error) {
      const errorMessage = 'Ocorreu um erro inesperado';
      Alert.alert('Erro', errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.push('/')}>
        <Ionicons name="arrow-back" size={24} color="#2196F3" />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>🏠 Login Morador</Text>
        <Text style={styles.subtitle}>Acesse sua área de morador</Text>
      </View>

      <AuthForm onSubmit={handleLogin} submitText="Entrar como Morador" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
    padding: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

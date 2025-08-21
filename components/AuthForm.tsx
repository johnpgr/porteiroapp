import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';

interface AuthFormProps {
  onSubmit: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loading?: boolean;
  submitText?: string;
  userType?: 'admin' | 'porteiro' | 'morador';
}

export default function AuthForm({
  onSubmit,
  loading = false,
  submitText = 'Entrar',
  userType,
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    // Prevenir múltiplos submits rápidos
    const now = Date.now();
    if (now - lastSubmitTime < 2000) {
      console.log('⚠️ Tentativa de submit muito rápida, ignorando...');
      return;
    }
    setLastSubmitTime(now);

    if (!email.trim() || !password.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Erro', 'Por favor, insira um email válido');
      return;
    }

    // Limpar timeout anterior
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }

    setIsSubmitting(true);
    console.log('📝 Iniciando submissão do formulário...');

    // Timeout de segurança para resetar submitting
    submitTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        console.warn('⏰ Timeout de segurança do formulário ativado');
        setIsSubmitting(false);
      }
    }, 20000);

    try {
      const result = await onSubmit(email.trim().toLowerCase(), password);

      // Limpar timeout se chegou até aqui
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }

      if (!result.success && result.error) {
        console.error('❌ Erro no resultado do login:', result.error);
        Alert.alert('Erro de Login', result.error);
      } else if (result.success) {
        console.log('✅ Login realizado com sucesso via formulário');
      }
    } catch (error) {
      console.error('💥 Erro inesperado no formulário:', error);
      Alert.alert('Erro', 'Erro inesperado durante o login');
    } finally {
      // Garantir que o submitting seja sempre resetado
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = null;
      }

      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const isLoading = loading || isSubmitting;

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, isLoading && styles.inputDisabled]}
        placeholder="Email ou Código"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!isLoading}
      />

      <TextInput
        style={[styles.input, isLoading && styles.inputDisabled]}
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
      />

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading}>
        <Text style={styles.buttonText}>{isLoading ? '⏳ Entrando...' : submitText}</Text>
      </TouchableOpacity>

      {isLoading && <Text style={styles.loadingHint}>Aguarde, processando sua solicitação...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ccc',
    color: '#999',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingHint: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  help: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  helpText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  helpDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

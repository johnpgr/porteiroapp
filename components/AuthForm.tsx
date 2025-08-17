import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '~/utils/supabase';

interface AuthFormProps {
  userType: 'admin' | 'porteiro' | 'morador';
  onSuccess: (user: any) => void;
}

export function AuthForm({ userType, onSuccess }: AuthFormProps) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!code.trim()) {
      Alert.alert('Erro', 'Por favor, insira o código');
      return;
    }

    setLoading(true);
    try {
      // Buscar usuário pelo código
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('code', code)
        .eq('role', userType)
        .single();

      if (error || !user) {
        Alert.alert('Erro', 'Código inválido ou usuário não encontrado');
        return;
      }

      // Verificar senha se necessário
      if (user.password && password !== user.password) {
        Alert.alert('Erro', 'Senha incorreta');
        return;
      }

      // Atualizar último login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      onSuccess(user);
    } catch (err) {
      console.error('Erro no login:', err);
      Alert.alert('Erro', 'Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (userType) {
      case 'admin': return '👨‍💼 Login Administrador';
      case 'porteiro': return '🛡️ Login Porteiro';
      case 'morador': return '🏠 Login Morador';
      default: return 'Login';
    }
  };

  const getColor = () => {
    switch (userType) {
      case 'admin': return '#9C27B0';
      case 'porteiro': return '#2196F3';
      case 'morador': return '#4CAF50';
      default: return '#2196F3';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: getColor() }]}>{getTitle()}</Text>
      
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Código de Acesso</Text>
          <TextInput
            style={[styles.input, { borderColor: getColor() }]}
            value={code}
            onChangeText={setCode}
            placeholder="Digite seu código"
            keyboardType="numeric"
            maxLength={6}
          />
        </View>

        {userType !== 'morador' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha (opcional)</Text>
            <TextInput
              style={[styles.input, { borderColor: getColor() }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Digite sua senha"
              secureTextEntry
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: getColor() }]}
          onPress={handleAuth}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.help}>
        <Text style={styles.helpText}>💡 Dica:</Text>
        <Text style={styles.helpDescription}>
          {userType === 'morador' 
            ? 'Use o código fornecido pela administração'
            : 'Entre com seu código de funcionário'
          }
        </Text>
      </View>
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
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
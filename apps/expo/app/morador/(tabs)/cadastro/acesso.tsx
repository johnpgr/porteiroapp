import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';

type AccessType = {
  id: string;
  label: string;
  icon: string;
  description: string;
  features: string[];
  color: string;
};

const accessTypes: AccessType[] = [
  {
    id: 'sem_acesso',
    label: 'Sem Acesso ao App',
    icon: '🚫',
    description: 'Pessoa não terá acesso ao aplicativo',
    features: [
      'Apenas acesso físico ao condomínio',
      'Não pode usar o aplicativo',
      'Controle apenas pelo morador responsável',
    ],
    color: '#9E9E9E',
  },
  {
    id: 'usuario',
    label: 'Usuário',
    icon: '👤',
    description: 'Acesso básico ao aplicativo',
    features: [
      'Pode usar o aplicativo',
      'Visualizar notificações',
      'Pré-cadastrar visitantes',
      'Ver histórico de acessos',
    ],
    color: '#2196F3',
  },
  {
    id: 'administrador',
    label: 'Administrador',
    icon: '👑',
    description: 'Acesso completo ao aplicativo',
    features: [
      'Todas as funcionalidades de usuário',
      'Gerenciar outros moradores',
      'Configurar permissões',
      'Acesso a relatórios avançados',
      'Gerenciar avisos do condomínio',
    ],
    color: '#FF9800',
  },
];

export function AcessoCadastro() {
  const { nome, relacionamento, telefone, placa } = useLocalSearchParams<{
    nome: string;
    relacionamento: string;
    telefone: string;
    placa: string;
  }>();
  const [selectedAccess, setSelectedAccess] = useState<string>('usuario'); // Default to 'usuario'

  const handleNext = () => {
    router.push({
      pathname: '/morador/cadastro/foto',
      params: {
        nome: nome || '',
        relacionamento: relacionamento || '',
        telefone: telefone || '',
        placa: placa || '',
        acesso: selectedAccess,
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  const getRelationshipLabel = (rel: string) => {
    const relationships: { [key: string]: string } = {
      conjuge: '💑 Cônjuge',
      filho: '👶 Filho(a)',
      pai_mae: '👨‍👩‍👧‍👦 Pai/Mãe',
      irmao: '👫 Irmão/Irmã',
      familiar: '👪 Outro Familiar',
      amigo: '👥 Amigo(a)',
      funcionario: '🏠 Funcionário',
      prestador: '🔧 Prestador de Serviço',
      motorista: '🚗 Motorista',
      outro: '👤 Outro',
    };
    return relationships[rel] || rel;
  };

  const selectedAccessData = accessTypes.find((a) => a.id === selectedAccess);

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <View style={styles.container}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>🔐 Novo Cadastro</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
              <View style={styles.progressStep} />
            </View>
            <Text style={styles.progressText}>Passo 5 de 8</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>👤 {nome}</Text>
              <Text style={styles.personRelationship}>
                {getRelationshipLabel(relacionamento || '')}
              </Text>
              <Text style={styles.personPhone}>📱 {telefone}</Text>
              {placa && <Text style={styles.personPlate}>🚗 {placa}</Text>}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tipo de Acesso</Text>
              <Text style={styles.sectionDescription}>
                Defina o nível de acesso desta pessoa ao aplicativo
              </Text>

              <ScrollView style={styles.accessList} showsVerticalScrollIndicator={false}>
                {accessTypes.map((access) => (
                  <TouchableOpacity
                    key={access.id}
                    style={[
                      styles.accessCard,
                      selectedAccess === access.id && styles.accessCardSelected,
                      { borderColor: selectedAccess === access.id ? access.color : '#e9ecef' },
                    ]}
                    onPress={() => setSelectedAccess(access.id)}>
                    <View style={styles.accessHeader}>
                      <View style={[styles.accessIcon, { backgroundColor: access.color + '20' }]}>
                        <Text style={styles.accessIconText}>{access.icon}</Text>
                      </View>

                      <View style={styles.accessInfo}>
                        <Text
                          style={[
                            styles.accessLabel,
                            selectedAccess === access.id && { color: access.color },
                          ]}>
                          {access.label}
                        </Text>
                        <Text
                          style={[
                            styles.accessDescription,
                            selectedAccess === access.id && { color: access.color + 'CC' },
                          ]}>
                          {access.description}
                        </Text>
                      </View>

                      <View style={styles.accessCheck}>
                        {selectedAccess === access.id && (
                          <Ionicons name="checkmark-circle" size={24} color={access.color} />
                        )}
                      </View>
                    </View>

                    <View style={styles.accessFeatures}>
                      {access.features.map((feature, index) => (
                        <View key={index} style={styles.featureItem}>
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={selectedAccess === access.id ? access.color : '#666'}
                          />
                          <Text
                            style={[
                              styles.featureText,
                              selectedAccess === access.id && { color: access.color },
                            ]}>
                            {feature}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedAccessData && (
                <View
                  style={[
                    styles.selectedInfo,
                    { backgroundColor: selectedAccessData.color + '15' },
                  ]}>
                  <Text style={[styles.selectedInfoText, { color: selectedAccessData.color }]}>
                    ✅ Selecionado: {selectedAccessData.icon} {selectedAccessData.label}
                  </Text>
                </View>
              )}

              <View style={styles.tipContainer}>
                <Ionicons name="information-circle" size={20} color="#2196F3" />
                <Text style={styles.tipText}>
                  Você pode alterar o tipo de acesso posteriormente nas configurações
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.backFooterButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color="#666" />
              <Text style={styles.backFooterButtonText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Continuar</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  progressStep: {
    width: 25,
    height: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#2196F3',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  personInfo: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  personName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  personRelationship: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  personPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  personPlate: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  accessList: {
    flex: 1,
    marginBottom: 20,
  },
  accessCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  accessCardSelected: {
    backgroundColor: '#fff',
  },
  accessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accessIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  accessIconText: {
    fontSize: 24,
  },
  accessInfo: {
    flex: 1,
  },
  accessLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  accessDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  accessCheck: {
    width: 30,
    alignItems: 'center',
  },
  accessFeatures: {
    paddingLeft: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  selectedInfo: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  selectedInfoText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    gap: 12,
  },
  backFooterButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFooterButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  nextButton: {
    flex: 2,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default AcessoCadastro;

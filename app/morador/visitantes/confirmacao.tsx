import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';

type VisitType = 'social' | 'service' | 'delivery' | 'car';

const visitTypeLabels = {
  social: '👥 Visita Social',
  service: '🔧 Prestador de Serviço',
  delivery: '📦 Entregador',
  car: '🚗 Carro',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConfirmacaoVisitante() {
  const { 
    tipo, 
    nome, 
    cpf, 
    foto, 
    data, 
    horaInicio, 
    horaFim, 
    observacoes, 
    autoAuthorize 
  } = useLocalSearchParams<{ 
    tipo: VisitType; 
    nome: string; 
    cpf: string;
    foto: string;
    data: string;
    horaInicio: string;
    horaFim: string;
    observacoes: string;
    autoAuthorize: string;
  }>();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        '✅ Visitante Cadastrado!',
        `${nome} foi pré-cadastrado com sucesso. ${autoAuthorize === 'true' ? 'A entrada será autorizada automaticamente no período definido.' : 'O porteiro será notificado quando o visitante chegar.'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to the main visitors screen
              router.replace('/morador');
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível cadastrar o visitante. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = () => {
    router.back();
  };

  const handleBack = () => {
    router.back();
  };

  const isAutoAuthorize = autoAuthorize === 'true';

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>👥 Novo Visitante</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
              <View style={[styles.progressStep, styles.progressStepActive]} />
            </View>
            <Text style={styles.progressText}>Passo 7 de 7 - Confirmação</Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>✅ Confirmar Cadastro</Text>
              <Text style={styles.sectionDescription}>
                Revise os dados do visitante antes de finalizar
              </Text>

              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <View style={styles.typeIndicator}>
                    <Text style={styles.typeIndicatorText}>
                      {visitTypeLabels[tipo as VisitType] || '👥 Visita Social'}
                    </Text>
                  </View>
                  {isAutoAuthorize && (
                    <View style={styles.autoAuthBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={styles.autoAuthText}>Auto</Text>
                    </View>
                  )}
                </View>

                <View style={styles.visitorMainInfo}>
                  {foto ? (
                    <Image source={{ uri: foto }} style={styles.visitorPhoto} />
                  ) : (
                    <View style={styles.visitorPhotoPlaceholder}>
                      <Ionicons name="person" size={40} color="#ccc" />
                    </View>
                  )}
                  
                  <View style={styles.visitorDetails}>
                    <Text style={styles.visitorName}>{nome}</Text>
                    {cpf && <Text style={styles.visitorCpf}>📄 {cpf}</Text>}
                  </View>
                </View>

                <View style={styles.visitDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar" size={20} color="#4CAF50" />
                    <Text style={styles.detailText}>
                      {formatDate(data || '')}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={20} color="#4CAF50" />
                    <Text style={styles.detailText}>
                      {formatTime(horaInicio || '')} - {formatTime(horaFim || '')}
                    </Text>
                  </View>
                  
                  {observacoes && (
                    <View style={styles.detailRow}>
                      <Ionicons name="document-text" size={20} color="#4CAF50" />
                      <Text style={styles.detailText}>{observacoes}</Text>
                    </View>
                  )}
                </View>

                {isAutoAuthorize && (
                  <View style={styles.autoAuthInfo}>
                    <Ionicons name="information-circle" size={20} color="#FF9800" />
                    <Text style={styles.autoAuthInfoText}>
                      Este visitante poderá entrar automaticamente no período definido, sem necessidade de aprovação manual.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
                  <Ionicons name="pencil" size={20} color="#2196F3" />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
                  onPress={handleConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Text style={styles.confirmButtonText}>Cadastrando...</Text>
                      <Ionicons name="hourglass" size={20} color="#fff" />
                    </>
                  ) : (
                    <>
                      <Text style={styles.confirmButtonText}>Confirmar Cadastro</Text>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.tipContainer}>
                <Ionicons name="information-circle" size={20} color="#2196F3" />
                <Text style={styles.tipText}>
                  Após confirmar, o visitante será notificado e poderá acessar o condomínio no período definido.
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.backFooterButton}
              onPress={handleBack}
              disabled={isSubmitting}
            >
              <Ionicons name="arrow-back" size={20} color="#666" />
              <Text style={styles.backFooterButtonText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmFooterButton,
                isSubmitting && styles.confirmFooterButtonDisabled
              ]}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Text style={styles.confirmFooterButtonText}>Cadastrando...</Text>
              ) : (
                <>
                  <Text style={styles.confirmFooterButtonText}>Confirmar</Text>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#4CAF50',
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
    width: 30,
    height: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  typeIndicator: {
    backgroundColor: '#e8f5e8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typeIndicatorText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  autoAuthBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoAuthText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  visitorMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  visitorPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  visitorPhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  visitorDetails: {
    flex: 1,
  },
  visitorName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  visitorCpf: {
    fontSize: 14,
    color: '#666',
  },
  visitDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
    lineHeight: 22,
  },
  autoAuthInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  autoAuthInfoText: {
    fontSize: 14,
    color: '#E65100',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  editButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
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
  confirmFooterButton: {
    flex: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmFooterButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmFooterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});
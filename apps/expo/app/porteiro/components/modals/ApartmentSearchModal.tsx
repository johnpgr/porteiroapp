import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { Modal } from '~/components/Modal';

interface ApartmentSearchModalProps {
  visible: boolean;
  onClose: () => void;
  apartmentNumber: string;
  apartmentVisitors: any[];
  expandedCards: Set<string>;
  onNumberPress: (num: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSearch: () => void;
  onToggleCardExpansion: (id: string) => void;
  onOpenImageModal: (url: string) => void;
  onCheckIn: (id: string) => void;
  onNotifyResident: (id: string) => void;
}

const ApartmentSearchModal: React.FC<ApartmentSearchModalProps> = ({
  visible,
  onClose,
  apartmentNumber,
  apartmentVisitors,
  expandedCards,
  onNumberPress,
  onBackspace,
  onClear,
  onSearch,
  onToggleCardExpansion,
  onOpenImageModal,
  onCheckIn,
  onNotifyResident,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.apartmentModalOverlay}>
        <View style={styles.apartmentModalContent}>
          {/* Cabeçalho */}
          <View style={styles.apartmentModalHeader}>
            <Text style={styles.apartmentModalTitle}>🏠 Buscar por Apartamento</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.apartmentModalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Display do número */}
          <View style={styles.apartmentNumberDisplay}>
            <Text style={styles.apartmentNumberText}>
              {apartmentNumber || 'Digite o número'}
            </Text>
          </View>

          {/* Teclado Numérico */}
          <View style={styles.numericKeypad}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['⌫', '0', 'C']].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.keypadButton,
                      (key === '⌫' || key === 'C') && styles.keypadButtonSpecial
                    ]}
                    onPress={() => {
                      if (key === '⌫') onBackspace();
                      else if (key === 'C') onClear();
                      else onNumberPress(key);
                    }}>
                    <Text style={[
                      styles.keypadButtonText,
                      (key === '⌫' || key === 'C') && styles.keypadButtonTextSpecial
                    ]}>
                      {key}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {/* Botão de Buscar */}
          <TouchableOpacity
            style={styles.apartmentSearchActionButton}
            onPress={onSearch}>
            <Text style={styles.apartmentSearchActionButtonText}>
              🔍 Buscar Visitantes
            </Text>
          </TouchableOpacity>

          {/* Lista de Visitantes Encontrados */}
          {apartmentVisitors.length > 0 && (
            <ScrollView style={styles.apartmentVisitorsList}>
              <Text style={styles.apartmentVisitorsTitle}>
                Visitantes Pré-autorizados ({apartmentVisitors.length})
              </Text>
              {apartmentVisitors.map((activity) => (
                <TouchableOpacity
                  key={activity.id}
                  style={styles.activityCard}
                  onPress={() => onToggleCardExpansion(activity.id)}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityIcon}>{activity.icon}</Text>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
                      <Text style={styles.activitySubtitle} numberOfLines={1}>{activity.subtitle}</Text>
                    </View>
                    <View style={styles.activityMeta}>
                      <Text style={[styles.activityStatus, { color: activity.color }]}>{activity.status}</Text>
                      <Text style={styles.activityTime}>{activity.time}</Text>
                    </View>
                  </View>
                  {/* Detalhes expandidos */}
                  {expandedCards.has(activity.id) && (
                    <View style={styles.activityDetails}>
                      {activity.details.map((detail: string, index: number) => (
                        <Text key={index} style={styles.activityDetail}>{detail}</Text>
                      ))}

                      {/* Botão Ver Foto */}
                      <TouchableOpacity
                        style={styles.viewPhotoActionButton}
                        onPress={() => {
                          if (activity.photo_url) {
                            onClose();
                            onOpenImageModal(activity.photo_url);
                          } else {
                            Alert.alert('Sem Foto', 'Visitante está sem foto');
                          }
                        }}>
                        <Text style={styles.viewPhotoActionButtonText}>
                          📷 Ver Foto
                        </Text>
                      </TouchableOpacity>

                      {/* Botões de ação */}
                      {(() => {
                        const canEnterDirectly = activity.status === 'Aprovado' ||
                                               activity.status === 'direto' ||
                                               activity.status === 'Liberado para Entrada Direta';

                        if (canEnterDirectly) {
                          return (
                            <TouchableOpacity
                              style={styles.checkInButton}
                              onPress={() => {
                                onClose();
                                onCheckIn(activity.id);
                              }}>
                              <Text style={styles.checkInButtonText}>
                                ✅ {activity.status === 'direto' ? 'Check de Entrada' : 'Confirmar Entrada'}
                              </Text>
                            </TouchableOpacity>
                          );
                        } else {
                          return (
                            <TouchableOpacity
                              style={styles.notifyResidentButton}
                              onPress={() => {
                                onClose();
                                onNotifyResident(activity.id);
                              }}>
                              <Text style={styles.notifyResidentButtonText}>
                                🔔 Avisar Morador
                              </Text>
                            </TouchableOpacity>
                          );
                        }
                      })()}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Estilos para o modal de busca por apartamento
  apartmentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  apartmentModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '85%',
  },
  apartmentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  apartmentModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  apartmentModalClose: {
    fontSize: 28,
    color: '#666',
    fontWeight: 'bold',
  },
  apartmentNumberDisplay: {
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  apartmentNumberText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    minHeight: 40,
  },
  numericKeypad: {
    marginBottom: 20,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  keypadButton: {
    flex: 1,
    aspectRatio: 1.5,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  keypadButtonSpecial: {
    backgroundColor: '#e0e0e0',
  },
  keypadButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  keypadButtonTextSpecial: {
    fontSize: 20,
    color: '#666',
  },
  apartmentSearchActionButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  apartmentSearchActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  apartmentVisitorsList: {
    flex: 1,
  },
  apartmentVisitorsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  // Estilos dos cards de atividade
  activityCard: {
    backgroundColor: '#fff',
    marginHorizontal: 8,
    marginVertical: 12, 
    borderRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  activityHeader: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  activityIcon: {
    fontSize: 20,
    marginRight: 8,
    width: 32,
    textAlign: 'center',
    flexShrink: 0,
  },
  activityInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
    flexShrink: 1,
    lineHeight: 18,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#666',
    flexShrink: 1,
    lineHeight: 16,
  },
  activityMeta: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 70,
    maxWidth: 100,
  },
  activityStatus: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 3,
    textAlign: 'right',
    flexWrap: 'wrap',
    maxWidth: 100,
    lineHeight: 12,
  },
  activityTime: {
    fontSize: 10,
    color: '#999',
    textAlign: 'right',
    lineHeight: 14,
  },
  activityDetails: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  activityDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    paddingLeft: 8,
  },
  viewPhotoActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginTop: 14,
  },
  viewPhotoActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  // Estilos para os botões de ação
  notifyResidentButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FF9800',
    marginTop: 8,
  },
  notifyResidentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  checkInButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    marginTop: 8,
  },
  checkInButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ApartmentSearchModal;

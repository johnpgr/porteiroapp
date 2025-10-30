import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Image,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useVisitorSearch, formatCPFValue, formatPlateValue } from '~/hooks/porteiro/useVisitorSearch';

const searchTypeLabels: Record<'cpf' | 'placa', string> = {
  cpf: 'CPF',
  placa: 'Placa',
};

export default function PorteiroConsultaTab() {
  const {
    searchType,
    setSearchType,
    searchQuery,
    setSearchQuery,
    searchError,
    isSearching,
    profileResult,
    vehicleResult,
    handleInputChange,
    performSearch,
    resetResults,
  } = useVisitorSearch();

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // reset results when tab gains focus to avoid stale data
      resetResults();
      setSearchQuery('');
      setShowPhotoModal(false);
      setShowImageModal(false);
      setSelectedImageUrl(null);
    }, [resetResults, setSearchQuery])
  );

  const handleSearchTypeChange = (type: 'cpf' | 'placa') => {
    setSearchType(type);
    setSearchQuery('');
    resetResults();
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              setSearchQuery('');
              resetResults();
            }}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔍 Consulta</Text>
          <Text style={styles.headerSubtitle}>Buscar moradores e veículos cadastrados</Text>
        </View>

        <View style={styles.searchTypeContainer}>
          {(['cpf', 'placa'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.searchTypeButton,
                searchType === type && styles.searchTypeButtonActive,
              ]}
              onPress={() => handleSearchTypeChange(type)}
            >
              <Text
                style={[
                  styles.searchTypeButtonText,
                  searchType === type && styles.searchTypeButtonTextActive,
                ]}
              >
                {type === 'cpf' ? '👤 CPF' : '🚗 Placa'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={
              searchType === 'cpf'
                ? 'Digite o CPF (000.000.000-00)'
                : 'Digite a placa (ABC-1234)'
            }
            value={searchQuery}
            onChangeText={handleInputChange}
            keyboardType={searchType === 'cpf' ? 'numeric' : 'default'}
            maxLength={searchType === 'cpf' ? 14 : 8}
            editable={!isSearching}
            autoCapitalize={searchType === 'placa' ? 'characters' : 'none'}
          />
          <TouchableOpacity
            style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
            onPress={performSearch}
            disabled={isSearching}
          >
            <Text style={styles.searchButtonText}>
              {isSearching ? '⏳ Consultando...' : '🔍 Consultar'}
            </Text>
          </TouchableOpacity>
        </View>

        {searchError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>❌ {searchError}</Text>
          </View>
        )}

        {profileResult && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultIcon}>
                {profileResult.type === 'visitante_aprovado' ? '👥' : '👤'}
              </Text>
              <View style={styles.resultHeaderInfo}>
                <Text style={styles.resultTitle}>
                  {profileResult.type === 'visitante_aprovado'
                    ? 'Visitante Pré-Aprovado'
                    : 'Morador Encontrado'}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    profileResult.type === 'visitante_aprovado' && styles.visitanteStatusBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      profileResult.type === 'visitante_aprovado' && styles.visitanteStatusText,
                    ]}
                  >
                    ✓ {profileResult.type === 'visitante_aprovado' ? 'Aprovado' : 'Ativo'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.resultName}>{profileResult.full_name || profileResult.name}</Text>
            <Text style={styles.resultLocation}>
              🏠 Apartamento {profileResult.apartment?.number || 'N/A'} -{' '}
              {profileResult.building?.name || 'N/A'}
            </Text>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>CPF</Text>
                <Text style={styles.infoValue}>
                  {profileResult.cpf ? formatCPFValue(profileResult.cpf) : 'Não informado'}
                </Text>
              </View>
              {profileResult.phone && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Telefone</Text>
                  <Text style={styles.infoValue}>{profileResult.phone}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={() => setShowPhotoModal(true)}
              >
                <Text style={styles.photoButtonIcon}>📷</Text>
                <Text style={styles.photoButtonText}>Ver Foto</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {vehicleResult && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultIcon}>🚗</Text>
              <View style={styles.resultHeaderInfo}>
                <Text style={styles.resultTitle}>Veículo Encontrado</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>✓ Ativo</Text>
                </View>
              </View>
            </View>

            <Text style={styles.resultName}>
              {vehicleResult.brand} {vehicleResult.model}
            </Text>
            <Text style={styles.resultLocation}>
              🏠 Apartamento {vehicleResult.apartment?.number || 'N/A'} -{' '}
              {vehicleResult.building?.name || 'N/A'}
            </Text>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Placa</Text>
                <Text style={styles.infoValue}>
                  {vehicleResult.license_plate
                    ? formatPlateValue(vehicleResult.license_plate)
                    : 'Não informado'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Cor</Text>
                <Text style={styles.infoValue}>{vehicleResult.color || 'Não informada'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Tipo</Text>
                <Text style={styles.infoValue}>{vehicleResult.type || 'Carro'}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.photoModalContainer}>
            <View style={styles.photoModalHeader}>
              <Text style={styles.photoModalTitle}>
                {profileResult?.full_name || 'Morador'}
              </Text>
              <TouchableOpacity
                style={styles.photoModalCloseButton}
                onPress={() => setShowPhotoModal(false)}
              >
                <Text style={styles.photoModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.photoContainer}>
              {profileResult?.avatar_url ? (
                <Image
                  source={{ uri: profileResult.avatar_url }}
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderIcon}>👤</Text>
                  <Text style={styles.photoPlaceholderText}>Foto não disponível</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.photoModalButton}
              onPress={() => setShowPhotoModal(false)}
            >
              <Text style={styles.photoModalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowImageModal(false);
          setSelectedImageUrl(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.photoModalContainer}>
            <View style={styles.photoModalHeader}>
              <Text style={styles.photoModalTitle}>Imagem</Text>
              <TouchableOpacity
                style={styles.photoModalCloseButton}
                onPress={() => {
                  setShowImageModal(false);
                  setSelectedImageUrl(null);
                }}
              >
                <Text style={styles.photoModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.photoContainer}>
              {selectedImageUrl ? (
                <Image
                  source={{ uri: selectedImageUrl }}
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderIcon}>🖼️</Text>
                  <Text style={styles.photoPlaceholderText}>Imagem não disponível</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.photoModalButton}
              onPress={() => {
                setShowImageModal(false);
                setSelectedImageUrl(null);
              }}
            >
              <Text style={styles.photoModalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  searchTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchTypeButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  searchTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
  },
  searchTypeButtonTextActive: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
  },
  searchButton: {
    backgroundColor: '#2196F3',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  searchButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultIcon: {
    fontSize: 32,
  },
  resultHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  visitanteStatusBadge: {
    backgroundColor: '#4CAF50',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  visitanteStatusText: {
    color: '#fff',
  },
  resultName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  resultLocation: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  infoItem: {
    flexBasis: '48%',
    backgroundColor: '#f6f8fa',
    borderRadius: 12,
    padding: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  photoButtonIcon: {
    fontSize: 18,
    color: '#fff',
  },
  photoButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  photoModalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  photoModalCloseButton: {
    padding: 6,
  },
  photoModalCloseText: {
    fontSize: 18,
    color: '#666',
  },
  photoContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    marginBottom: 16,
  },
  photoModalImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  photoPlaceholderIcon: {
    fontSize: 42,
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: '#666',
  },
  photoModalButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  photoModalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import BottomSheetModal, { BottomSheetModalRef } from '~/components/BottomSheetModal';

type StatusFilter = 'todos' | 'pendente' | 'expirado';
type TypeFilter = 'todos' | 'visitantes' | 'veiculos';

interface FiltersBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModalRef>;
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (status: StatusFilter, type: TypeFilter) => void;
}

export const FiltersBottomSheet: React.FC<FiltersBottomSheetProps> = ({
  bottomSheetRef,
  visible,
  onClose,
  onApplyFilters,
}) => {
  const [tempStatusFilter, setTempStatusFilter] = useState<StatusFilter>('pendente');
  const [tempTypeFilter, setTempTypeFilter] = useState<TypeFilter>('todos');

  const handleCancel = useCallback(() => {
    // Reset to default filters
    setTempStatusFilter('pendente');
    setTempTypeFilter('todos');
    onClose();
  }, [onClose]);

  const handleApply = useCallback(() => {
    onApplyFilters(tempStatusFilter, tempTypeFilter);
    onClose();
  }, [tempStatusFilter, tempTypeFilter, onApplyFilters, onClose]);
  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      visible={visible}
      onClose={onClose}
      snapPoints={40}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Filtros</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.chipsContainer}>
            <TouchableOpacity
              style={[styles.chip, tempStatusFilter === 'todos' && styles.chipActive]}
              onPress={() => setTempStatusFilter('todos')}
            >
              <Text style={[styles.chipText, tempStatusFilter === 'todos' && styles.chipTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, tempStatusFilter === 'pendente' && styles.chipActive]}
              onPress={() => setTempStatusFilter('pendente')}
            >
              <Text
                style={[
                  styles.chipText,
                  tempStatusFilter === 'pendente' && styles.chipTextActive,
                ]}
              >
                Pendentes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, tempStatusFilter === 'expirado' && styles.chipActive]}
              onPress={() => setTempStatusFilter('expirado')}
            >
              <Text
                style={[
                  styles.chipText,
                  tempStatusFilter === 'expirado' && styles.chipTextActive,
                ]}
              >
                Expirados
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo</Text>
          <View style={styles.chipsContainer}>
            <TouchableOpacity
              style={[styles.chip, tempTypeFilter === 'todos' && styles.chipActive]}
              onPress={() => setTempTypeFilter('todos')}
            >
              <Text style={[styles.chipText, tempTypeFilter === 'todos' && styles.chipTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, tempTypeFilter === 'visitantes' && styles.chipActive]}
              onPress={() => setTempTypeFilter('visitantes')}
            >
              <Text
                style={[
                  styles.chipText,
                  tempTypeFilter === 'visitantes' && styles.chipTextActive,
                ]}
              >
                Visitantes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, tempTypeFilter === 'veiculos' && styles.chipActive]}
              onPress={() => setTempTypeFilter('veiculos')}
            >
              <Text
                style={[
                  styles.chipText,
                  tempTypeFilter === 'veiculos' && styles.chipTextActive,
                ]}
              >
                Veículos
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <Text style={styles.applyButtonText}>Aplicar</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  chipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import type { PorteiroShift } from '~/services/shiftService';

interface ShiftModalProps {
  visible: boolean;
  mandatory?: boolean;
  isLoading?: boolean;
  currentShift: PorteiroShift | null;
  onStartShift: () => void;
  onEndShift: () => void;
  onLogout?: () => void;
  onClose?: () => void;
}

function formatDuration(durationMs: number) {
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export function ShiftModal({
  visible,
  mandatory = false,
  isLoading = false,
  currentShift,
  onStartShift,
  onEndShift,
  onLogout,
  onClose,
}: ShiftModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!mandatory) {
          onClose?.();
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Controle de Turno</Text>
            {!mandatory && (
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {mandatory && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Você deve iniciar o turno para usar as funções do sistema.
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status do Turno</Text>
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    currentShift ? styles.statusActive : styles.statusInactive,
                  ]}
                />
                <Text style={styles.statusText}>
                  {currentShift ? 'Turno Ativo' : 'Fora de Turno'}
                </Text>
              </View>

              {currentShift && (
                <View style={styles.shiftDetails}>
                  <Text style={styles.detailLabel}>Início:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(currentShift.shift_start).toLocaleString('pt-BR')}
                  </Text>

                  <Text style={styles.detailLabel}>Duração:</Text>
                  <Text style={styles.detailValue}>
                    {formatDuration(Date.now() - new Date(currentShift.shift_start).getTime())}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Controles</Text>
            {!currentShift ? (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.startButton]}
                  onPress={onStartShift}
                  disabled={isLoading}
                >
                  <Text style={styles.actionIcon}>▶️</Text>
                  <Text style={styles.actionText}>
                    {isLoading ? 'Iniciando...' : 'Iniciar Turno'}
                  </Text>
                </TouchableOpacity>
                {mandatory && onLogout && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.logoutButton]}
                    onPress={onLogout}
                  >
                    <Text style={styles.actionIcon}>🚪</Text>
                    <Text style={styles.actionText}>Sair do Sistema</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.endButton]}
                onPress={onEndShift}
                disabled={isLoading}
              >
                <Text style={styles.actionIcon}>⏹️</Text>
                <Text style={styles.actionText}>
                  {isLoading ? 'Finalizando...' : 'Finalizar Turno'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
    color: '#94A3B8',
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#10B981',
  },
  statusInactive: {
    backgroundColor: '#F97316',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  shiftDetails: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    marginBottom: 12,
  },
  startButton: {
    backgroundColor: '#22C55E',
  },
  endButton: {
    backgroundColor: '#F97316',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
  },
  actionIcon: {
    fontSize: 18,
    color: '#fff',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ShiftModal;

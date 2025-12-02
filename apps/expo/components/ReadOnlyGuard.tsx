import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useAuth } from '~/hooks/useAuth';

interface ReadOnlyGuardProps {
  children: React.ReactNode;
}

export const ReadOnlyGuard: React.FC<ReadOnlyGuardProps> = ({ children }) => {
  const { isReadOnly, signOut, isOffline } = useAuth();

  const handleUnlockPress = useCallback(() => {
    Alert.alert(
      'Modo somente leitura',
      isOffline
        ? 'Reative sua conexão com a internet para continuar.'
        : 'Faça login novamente para continuar utilizando todos os recursos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fazer login',
          style: 'default',
          onPress: () => {
            signOut().catch((error) => {
              console.error('[ReadOnlyGuard] Failed to sign out from banner action:', error);
            });
          },
        },
      ]
    );
  }, [isOffline, signOut]);

  if (!isReadOnly) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Modo somente leitura</Text>
        <Text style={styles.bannerSubtitle}>
          Reconecte-se à internet e faça login novamente para continuar realizando ações.
        </Text>
      </View>
      <View style={styles.contentWrapper} pointerEvents="box-none">
        {children}
      </View>
      <Pressable style={styles.blockingOverlay} onPress={handleUnlockPress}>
        <View style={styles.overlayMessage} pointerEvents="none">
          <Text style={styles.overlayText}>Conteúdo em modo somente leitura</Text>
          <Text style={styles.overlayHint}>Toque para fazer login novamente</Text>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    backgroundColor: '#FFF4E5',
    borderColor: '#FF9800',
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#8D6E63',
    marginTop: 4,
  },
  contentWrapper: {
    flex: 1,
  },
  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  overlayMessage: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFB74D',
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D84315',
    textAlign: 'center',
  },
  overlayHint: {
    marginTop: 4,
    fontSize: 13,
    color: '#6D4C41',
    textAlign: 'center',
  },
});

export default ReadOnlyGuard;

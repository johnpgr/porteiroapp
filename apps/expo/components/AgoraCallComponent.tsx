import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import AgoraUIKit from 'agora-rn-uikit';
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff } from 'lucide-react-native';
import { useAgora } from '~/hooks/useAgora';

const { width, height } = Dimensions.get('window');

export interface AgoraCallComponentProps {
  channelName: string;
  uid: number;
  callerName?: string;
  onEndCall: () => void;
  onCallConnected?: () => void;
  onCallFailed?: (error: string) => void;
  isVisible: boolean;
}

export const AgoraCallComponent: React.FC<AgoraCallComponentProps> = ({
  channelName,
  uid,
  callerName = 'Usuário',
  onEndCall,
  onCallConnected,
  onCallFailed,
  isVisible,
}) => {
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [showUIKit, setShowUIKit] = useState(false);
  const [connectionData, setConnectionData] = useState<any>(null);

  const {
    isJoined,
    isConnecting,
    isMuted,
    isSpeakerOn,
    error,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleSpeaker,
    cleanup,
  } = useAgora();

  // Configurar dados de conexão para AgoraUIKit
  useEffect(() => {
    if (channelName && uid) {
      setConnectionData({
        appId: 'f9e7edb820194834801f62707068743d',
        channel: channelName,
        uid: uid,
        // Token será obtido automaticamente pelo hook useAgora
      });
    }
  }, [channelName, uid]);

  // Iniciar chamada quando o componente fica visível
  useEffect(() => {
    if (isVisible && connectionData && !isJoined && !isConnecting) {
      handleStartCall();
    }
  }, [isVisible, connectionData, isJoined, isConnecting]);

  // Monitorar estado da conexão
  useEffect(() => {
    if (isJoined && callState !== 'connected') {
      setCallState('connected');
      setShowUIKit(true);
      onCallConnected?.();
    }
  }, [isJoined, callState, onCallConnected]);

  // Monitorar erros
  useEffect(() => {
    if (error) {
      console.error('🔥 Erro na chamada:', error);
      Alert.alert('Erro na Chamada', error, [{ text: 'OK', onPress: handleEndCall }]);
      onCallFailed?.(error);
    }
  }, [error]);

  // Iniciar chamada
  const handleStartCall = useCallback(async () => {
    try {
      console.log('🚀 Iniciando chamada no canal:', channelName);
      setCallState('connecting');

      await joinChannel({
        appId: 'f9e7edb820194834801f62707068743d',
        channelName,
        uid,
      });
    } catch (err) {
      console.error('❌ Erro ao iniciar chamada:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      onCallFailed?.(errorMessage);
    }
  }, [channelName, uid, joinChannel, onCallFailed]);

  // Encerrar chamada
  const handleEndCall = useCallback(async () => {
    try {
      console.log('📞 Encerrando chamada...');
      setCallState('ended');
      setShowUIKit(false);

      await leaveChannel();
      await cleanup();

      onEndCall();
    } catch (err) {
      console.error('❌ Erro ao encerrar chamada:', err);
      // Mesmo com erro, encerrar a chamada
      onEndCall();
    }
  }, [leaveChannel, cleanup, onEndCall]);

  // Callbacks para AgoraUIKit
  const rtcCallbacks = {
    EndCall: handleEndCall,
    UserJoined: (uid: number) => {
      console.log('👤 Usuário entrou na chamada:', uid);
    },
    UserOffline: (uid: number) => {
      console.log('👤 Usuário saiu da chamada:', uid);
    },
  };

  // Não renderizar se não estiver visível
  if (!isVisible) {
    return null;
  }

  // Renderizar AgoraUIKit quando conectado
  if (showUIKit && connectionData && isJoined) {
    return (
      <View style={styles.container}>
        <AgoraUIKit
          connectionData={connectionData}
          rtcCallbacks={rtcCallbacks}
          settings={{
            displayUsername: false,
            enableAudio: true,
            enableVideo: false, // Apenas áudio
          }}
        />

        {/* Controles customizados sobrepostos */}
        <View style={styles.controlsOverlay}>
          <View style={styles.topBar}>
            <Text style={styles.callerName}>{callerName}</Text>
            <Text style={styles.callStatus}>Conectado</Text>
          </View>

          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={toggleMute}>
              {isMuted ? <MicOff size={24} color="#fff" /> : <Mic size={24} color="#fff" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.endCallButton]}
              onPress={handleEndCall}>
              <PhoneOff size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, !isSpeakerOn && styles.controlButtonActive]}
              onPress={toggleSpeaker}>
              {isSpeakerOn ? (
                <Volume2 size={24} color="#fff" />
              ) : (
                <VolumeX size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Tela de conexão
  return (
    <View style={styles.container}>
      <View style={styles.connectingContainer}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Phone size={40} color="#007AFF" />
          </View>
        </View>

        <Text style={styles.callerNameLarge}>{callerName}</Text>

        {callState === 'connecting' && (
          <>
            <Text style={styles.callStatusConnecting}>
              {isConnecting ? 'Conectando...' : 'Chamando...'}
            </Text>
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
          </>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.connectingControls}>
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={handleEndCall}>
            <PhoneOff size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  connectingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  callerNameLarge: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  callStatusConnecting: {
    fontSize: 18,
    color: '#999',
    marginBottom: 20,
    textAlign: 'center',
  },
  loader: {
    marginBottom: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  connectingControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  topBar: {
    alignItems: 'center',
  },
  callerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  callStatus: {
    fontSize: 16,
    color: '#4CAF50',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  controlButtonActive: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
  endCallButton: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
});

export default AgoraCallComponent;

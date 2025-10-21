import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import RtcEngine, { 
  RtcEngineContext, 
  ChannelProfileType, 
  ClientRoleType,
  AudioProfileType,
  AudioScenarioType,
  IRtcEngineEventHandler
} from 'react-native-agora';

// Configurações do Agora
const AGORA_APP_ID = 'f9e7edb820194834801f62707068743d';
const API_BASE_URL = 'http://localhost:3001/api';

export interface AgoraConfig {
  appId: string;
  channelName: string;
  uid: number;
  token?: string;
}

export interface UseAgoraReturn {
  engine: RtcEngine | null;
  isJoined: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isSpeakerOn: boolean;
  error: string | null;
  joinChannel: (config: AgoraConfig) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export const useAgora = (): UseAgoraReturn => {
  const [engine, setEngine] = useState<RtcEngine | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const engineRef = useRef<RtcEngine | null>(null);

  // Inicializar o engine do Agora
  const initializeEngine = async (): Promise<RtcEngine> => {
    try {
      if (engineRef.current) {
        return engineRef.current;
      }

      console.log('🎙️ Inicializando Agora Engine...');
      
      const agoraEngine = RtcEngine.create({
        appId: AGORA_APP_ID,
        logConfig: {
          level: __DEV__ ? 0x0001 : 0x0000, // Debug em desenvolvimento
        },
      } as RtcEngineContext);

      // Configurar perfil de áudio para chamadas de voz
      await agoraEngine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
      await agoraEngine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      
      // Configurações de áudio otimizadas para voz
      await agoraEngine.setAudioProfile(
        AudioProfileType.AudioProfileDefault,
        AudioScenarioType.AudioScenarioDefault
      );

      // Habilitar áudio
      await agoraEngine.enableAudio();
      
      // Configurar alto-falante por padrão
      await agoraEngine.setDefaultAudioRouteToSpeakerphone(true);

      // Event handlers
      const eventHandler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: (connection, elapsed) => {
          console.log('✅ Conectado ao canal:', connection.channelId);
          setIsJoined(true);
          setIsConnecting(false);
          setError(null);
        },
        
        onLeaveChannel: (connection, stats) => {
          console.log('👋 Saiu do canal:', connection.channelId);
          setIsJoined(false);
          setIsConnecting(false);
        },
        
        onUserJoined: (connection, remoteUid, elapsed) => {
          console.log('👤 Usuário entrou no canal:', remoteUid);
        },
        
        onUserOffline: (connection, remoteUid, reason) => {
          console.log('👤 Usuário saiu do canal:', remoteUid, 'Razão:', reason);
        },
        
        onError: (err, msg) => {
          console.error('❌ Erro no Agora:', err, msg);
          setError(`Erro de conexão: ${msg || err}`);
          setIsConnecting(false);
        },
        
        onConnectionStateChanged: (connection, state, reason) => {
          console.log('🔄 Estado da conexão mudou:', state, 'Razão:', reason);
        },
        
        onAudioRouteChanged: (routing) => {
          console.log('🔊 Rota de áudio mudou:', routing);
          setIsSpeakerOn(routing === 1); // 1 = Speaker, 0 = Earpiece
        }
      };

      agoraEngine.registerEventHandler(eventHandler);
      
      engineRef.current = agoraEngine;
      setEngine(agoraEngine);
      
      console.log('✅ Agora Engine inicializado com sucesso');
      return agoraEngine;
      
    } catch (err) {
      console.error('❌ Erro ao inicializar Agora Engine:', err);
      setError('Falha ao inicializar sistema de áudio');
      throw err;
    }
  };

  // Buscar token RTC do backend
  const fetchRtcToken = async (channelName: string, uid: number): Promise<string> => {
    try {
      console.log('🔑 Buscando token RTC para canal:', channelName, 'UID:', uid);
      
      const response = await fetch(`${API_BASE_URL}/agora/rtc?channelName=${channelName}&uid=${uid}`);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.rtcToken) {
        throw new Error('Token RTC não recebido do servidor');
      }
      
      console.log('✅ Token RTC obtido com sucesso');
      return data.rtcToken;
      
    } catch (err) {
      console.error('❌ Erro ao buscar token RTC:', err);
      throw new Error('Falha ao obter autorização para chamada');
    }
  };

  // Entrar no canal
  const joinChannel = async (config: AgoraConfig): Promise<void> => {
    try {
      setIsConnecting(true);
      setError(null);
      
      console.log('🚀 Iniciando conexão ao canal:', config.channelName);
      
      // Inicializar engine se necessário
      const agoraEngine = await initializeEngine();
      
      // Buscar token se não fornecido
      let token = config.token;
      if (!token) {
        token = await fetchRtcToken(config.channelName, config.uid);
      }
      
      // Entrar no canal
      await agoraEngine.joinChannel(token, config.channelName, config.uid, {
        // Configurações do canal
        autoSubscribeAudio: true,
        autoSubscribeVideo: false, // Apenas áudio
        publishMicrophoneTrack: true,
        publishCameraTrack: false,
      });
      
      console.log('🎙️ Tentando entrar no canal...');
      
    } catch (err) {
      console.error('❌ Erro ao entrar no canal:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setIsConnecting(false);
      throw err;
    }
  };

  // Sair do canal
  const leaveChannel = async (): Promise<void> => {
    try {
      if (engineRef.current && isJoined) {
        console.log('👋 Saindo do canal...');
        await engineRef.current.leaveChannel();
      }
    } catch (err) {
      console.error('❌ Erro ao sair do canal:', err);
    }
  };

  // Alternar mudo
  const toggleMute = async (): Promise<void> => {
    try {
      if (engineRef.current) {
        const newMutedState = !isMuted;
        await engineRef.current.muteLocalAudioStream(newMutedState);
        setIsMuted(newMutedState);
        console.log('🔇 Microfone:', newMutedState ? 'Mutado' : 'Ativo');
      }
    } catch (err) {
      console.error('❌ Erro ao alternar mudo:', err);
    }
  };

  // Alternar alto-falante
  const toggleSpeaker = async (): Promise<void> => {
    try {
      if (engineRef.current) {
        const newSpeakerState = !isSpeakerOn;
        await engineRef.current.setDefaultAudioRouteToSpeakerphone(newSpeakerState);
        setIsSpeakerOn(newSpeakerState);
        console.log('🔊 Alto-falante:', newSpeakerState ? 'Ativo' : 'Inativo');
      }
    } catch (err) {
      console.error('❌ Erro ao alternar alto-falante:', err);
    }
  };

  // Limpeza
  const cleanup = async (): Promise<void> => {
    try {
      console.log('🧹 Limpando recursos do Agora...');
      
      if (engineRef.current) {
        if (isJoined) {
          await engineRef.current.leaveChannel();
        }
        
        await engineRef.current.release();
        engineRef.current = null;
        setEngine(null);
      }
      
      setIsJoined(false);
      setIsConnecting(false);
      setIsMuted(false);
      setIsSpeakerOn(true);
      setError(null);
      
      console.log('✅ Recursos do Agora limpos');
      
    } catch (err) {
      console.error('❌ Erro na limpeza:', err);
    }
  };

  // Limpeza automática no unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    engine,
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
  };
};

export default useAgora;
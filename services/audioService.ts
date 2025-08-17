import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface AudioRecording {
  uri: string;
  duration: number;
  size: number;
}

export interface AudioPlayback {
  sound: Audio.Sound;
  status: Audio.AVPlaybackStatus;
}

class AudioService {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private isRecording: boolean = false;
  private isPlaying: boolean = false;

  constructor() {
    // Evitar inicialização de áudio em ambiente web/SSR
    if (Platform.OS !== 'web') {
      this.initializeAudio();
    }
  }

  /**
   * Inicializa as configurações de áudio
   */
  private async initializeAudio(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (error) {
      console.error('Erro ao inicializar áudio:', error);
    }
  }

  /**
   * Solicita permissões de áudio
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        console.warn('Permissões de áudio não são necessárias/suportadas na Web pelo expo-av.');
        return true;
      }
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permissão de áudio negada');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Erro ao solicitar permissões de áudio:', error);
      return false;
    }
  }

  /**
   * Inicia a gravação de áudio
   */
  async startRecording(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        console.warn('Gravação de áudio não suportada via expo-av na Web.');
        return false;
      }
      if (this.isRecording) {
        console.log('Já está gravando');
        return false;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      } as const;

      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(recordingOptions as any);
      await this.recording.startAsync();

      this.isRecording = true;
      console.log('Gravação iniciada');
      return true;
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Reproduz um arquivo de áudio
   */
  async playAudio(uri: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        console.warn('Reprodução de áudio via expo-av não suportada na Web.');
        return false;
      }
      if (this.isPlaying) {
        await this.stopAudio();
      }

      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });

      this.sound = sound;
      this.isPlaying = true;

      // Listener para quando o áudio terminar
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && (status as any).didJustFinish) {
          this.isPlaying = false;
          this.sound?.unloadAsync();
          this.sound = null;
        }
      });

      console.log('Reprodução iniciada');
      return true;
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
      this.isPlaying = false;
      return false;
    }
  }

  /**
   * Para a reprodução de áudio
   */
  async stopAudio(): Promise<void> {
    try {
      if (Platform.OS === 'web') return;
      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
      }
      this.isPlaying = false;
      console.log('Reprodução parada');
    } catch (error) {
      console.error('Erro ao parar reprodução:', error);
    }
  }

  /**
   * Pausa a reprodução de áudio
   */
  async pauseAudio(): Promise<void> {
    try {
      if (Platform.OS === 'web') return;
      if (this.sound && this.isPlaying) {
        await this.sound.pauseAsync();
        console.log('Reprodução pausada');
      }
    } catch (error) {
      console.error('Erro ao pausar reprodução:', error);
    }
  }

  /**
   * Resume a reprodução de áudio
   */
  async resumeAudio(): Promise<void> {
    try {
      if (Platform.OS === 'web') return;
      if (this.sound && !this.isPlaying) {
        await this.sound.playAsync();
        this.isPlaying = true;
        console.log('Reprodução resumida');
      }
    } catch (error) {
      console.error('Erro ao resumir reprodução:', error);
    }
  }

  /**
   * Obtém o status da gravação
   */
  async getRecordingStatus(): Promise<Audio.RecordingStatus | null> {
    try {
      if (Platform.OS === 'web') return null;
      if (this.recording) {
        return await this.recording.getStatusAsync();
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter status da gravação:', error);
      return null;
    }
  }

  /**
   * Obtém o status da reprodução
   */
  async getPlaybackStatus(): Promise<Audio.AVPlaybackStatus | null> {
    try {
      if (Platform.OS === 'web') return null;
      if (this.sound) {
        return await this.sound.getStatusAsync();
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter status da reprodução:', error);
      return null;
    }
  }

  /**
   * Salva o arquivo de áudio
   */
  async saveAudioFile(uri: string, filename: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        console.warn('Salvar arquivo de áudio não suportado via expo-file-system na Web.');
        return null;
      }
      const directory = `${FileSystem.documentDirectory}audio/`;
      const dest = `${directory}${filename}`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      await FileSystem.copyAsync({ from: uri, to: dest });
      return dest;
    } catch (error) {
      console.error('Erro ao salvar arquivo de áudio:', error);
      return null;
    }
  }

  async deleteAudioFile(uri: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') return false;
      await FileSystem.deleteAsync(uri, { idempotent: true });
      return true;
    } catch (error) {
      console.error('Erro ao deletar arquivo de áudio:', error);
      return false;
    }
  }

  async listAudioFiles(): Promise<string[]> {
    try {
      if (Platform.OS === 'web') return [];
      const directory = `${FileSystem.documentDirectory}audio/`;
      const files = await FileSystem.readDirectoryAsync(directory);
      return files;
    } catch (error) {
      console.error('Erro ao listar arquivos de áudio:', error);
      return [];
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (Platform.OS === 'web') return;
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }
    } catch (error) {
      console.error('Erro ao limpar recursos de áudio:', error);
    } finally {
      this.isRecording = false;
      this.isPlaying = false;
    }
  }
}

export const audioService = new AudioService();
export default audioService;

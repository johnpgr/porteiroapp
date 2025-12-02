import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { audioService, AudioRecording } from '../services/audioService';
import { flattenStyles } from '../utils/styles';

interface AudioRecorderProps {
  onRecordingComplete?: (recording: AudioRecording) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  maxDuration?: number; // em segundos
  disabled?: boolean;
  style?: any;
}

export default function AudioRecorder({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  maxDuration = 300, // 5 minutos por padrão
  disabled = false,
  style,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const handleStopRecording = useCallback(async () => {
    try {
      // The audioService doesn't have a stopRecording method yet
      // We'll need to implement it or use cleanup
      await audioService.cleanup();
      setIsRecording(false);
      setRecordingDuration(0);
      onRecordingStop?.();

      // TODO: Implement stopRecording in audioService to return recording data
      // if (recording) {
      //   onRecordingComplete?.(recording);
      // }
    } catch (error) {
      console.error('Erro ao parar gravação:', error);
      Alert.alert('Erro', 'Erro ao finalizar a gravação.');
    }
  }, [onRecordingStop]);

  useEffect(() => {
    checkPermissions();
    return () => {
      // Cleanup ao desmontar o componente
      if (isRecording) {
        handleStopRecording();
      }
    };
  }, [isRecording, handleStopRecording]);

  useEffect(() => {
    if (recordingDuration >= maxDuration) {
      handleStopRecording();
    }
  }, [recordingDuration, maxDuration, handleStopRecording]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRecording) {
      interval = setInterval(async () => {
        const status = await audioService.getRecordingStatus();
        if (status && status.durationMillis) {
          const duration = Math.floor(status.durationMillis / 1000);
          setRecordingDuration(duration);

          // Parar automaticamente se atingir duração máxima
          if (duration >= maxDuration) {
            handleStopRecording();
          }
        }
      }, 100);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording, maxDuration, handleStopRecording]);

  const checkPermissions = async () => {
    const permission = await audioService.requestPermissions();
    setHasPermission(permission);
  };

  const handleStartRecording = async () => {
    if (!hasPermission) {
      Alert.alert(
        'Permissão Necessária',
        'É necessário permitir o acesso ao microfone para gravar áudio.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Tentar Novamente', onPress: checkPermissions },
        ]
      );
      return;
    }

    try {
      const success = await audioService.startRecording();
      if (success) {
        setIsRecording(true);
        setRecordingDuration(0);
        onRecordingStart?.();
      } else {
        Alert.alert('Erro', 'Não foi possível iniciar a gravação.');
      }
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      Alert.alert('Erro', 'Erro ao iniciar a gravação.');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getRecordingColor = (): string => {
    if (recordingDuration > maxDuration * 0.8) return '#F44336'; // Vermelho
    if (recordingDuration > maxDuration * 0.6) return '#FF9800'; // Laranja
    return '#4CAF50'; // Verde
  };

  if (hasPermission === null) {
    return (
      <View style={flattenStyles([styles.container, style])}>
        <Text style={styles.permissionText}>Verificando permissões...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={flattenStyles([styles.container, style])}>
        <TouchableOpacity style={styles.permissionButton} onPress={checkPermissions}>
          <Ionicons name="mic-off" size={24} color="#F44336" />
          <Text style={styles.permissionText}>Permitir Microfone</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={flattenStyles([styles.container, style])}>
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordingButton,
          disabled && styles.disabledButton,
        ]}
        onPress={isRecording ? handleStopRecording : handleStartRecording}
        disabled={disabled}
        activeOpacity={0.7}>
        <Ionicons
          name={isRecording ? 'stop' : 'mic'}
          size={32}
          color={disabled ? '#999' : '#fff'}
        />
      </TouchableOpacity>

      {isRecording && (
        <View style={styles.recordingInfo}>
          <View style={styles.recordingIndicator}>
            <View
              style={flattenStyles([styles.recordingDot, { backgroundColor: getRecordingColor() }])}
            />
            <Text style={flattenStyles([styles.recordingText, { color: getRecordingColor() }])}>
              REC
            </Text>
          </View>

          <Text style={styles.durationText}>{formatTime(recordingDuration)}</Text>

          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${(recordingDuration / maxDuration) * 100}%`,
                  backgroundColor: getRecordingColor(),
                },
              ]}
            />
          </View>

          <Text style={styles.maxDurationText}>Máx: {formatTime(maxDuration)}</Text>
        </View>
      )}

      <Text style={styles.instructionText}>
        {isRecording ? 'Toque para parar a gravação' : 'Toque para iniciar gravação'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  recordingButton: {
    backgroundColor: '#F44336',
    transform: [{ scale: 1.1 }],
  },
  disabledButton: {
    backgroundColor: '#ccc',
    elevation: 0,
    shadowOpacity: 0,
  },
  recordingInfo: {
    alignItems: 'center',
    marginTop: 16,
    minHeight: 80,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  durationText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  progressContainer: {
    width: 200,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  maxDurationText: {
    fontSize: 12,
    color: '#666',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  permissionText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 8,
  },
});

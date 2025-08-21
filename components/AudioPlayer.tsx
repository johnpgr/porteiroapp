import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { audioService } from '../services/audioService';

interface AudioPlayerProps {
  uri: string;
  duration?: number;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: string) => void;
  style?: any;
  showDuration?: boolean;
  autoPlay?: boolean;
}

export default function AudioPlayer({
  uri,
  duration = 0,
  onPlayStart,
  onPlayEnd,
  onError,
  style,
  showDuration = true,
  autoPlay = false,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (autoPlay && uri) {
      handlePlay();
    }

    return () => {
      // Cleanup ao desmontar
      handleStop();
    };
  }, [uri, autoPlay, handlePlay, handleStop]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPlaying && !isPaused) {
      interval = setInterval(async () => {
        const status = await audioService.getPlaybackStatus();
        if (status && status.isLoaded) {
          setCurrentPosition(status.positionMillis || 0);
          setTotalDuration(status.durationMillis || duration);

          // Verificar se terminou
          if (status.didJustFinish) {
            setIsPlaying(false);
            setIsPaused(false);
            setCurrentPosition(0);
            onPlayEnd?.();
          }
        }
      }, 100);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, isPaused, duration, onPlayEnd, handlePlay]);

  const handlePlay = useCallback(async () => {
    if (!uri) {
      onError?.('URI do áudio não fornecida');
      return;
    }

    try {
      setIsLoading(true);

      if (isPaused) {
        // Resumir reprodução
        await audioService.resumeAudio();
        setIsPaused(false);
      } else {
        // Iniciar nova reprodução
        const success = await audioService.playAudio(uri);
        if (success) {
          setIsPlaying(true);
          setIsPaused(false);
          onPlayStart?.();
        } else {
          onError?.('Erro ao reproduzir áudio');
        }
      }
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
      onError?.('Erro ao reproduzir áudio');
    } finally {
      setIsLoading(false);
    }
  }, [uri, isPaused, onError, onPlayStart]);

  const handlePause = async () => {
    try {
      await audioService.pauseAudio();
      setIsPaused(true);
    } catch (error) {
      console.error('Erro ao pausar áudio:', error);
      onError?.('Erro ao pausar áudio');
    }
  };

  const handleStop = useCallback(async () => {
    try {
      await audioService.stopAudio();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentPosition(0);
    } catch (error) {
      console.error('Erro ao parar áudio:', error);
    }
  }, []);

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    if (totalDuration === 0) return 0;
    return (currentPosition / totalDuration) * 100;
  };

  const renderPlayButton = () => {
    if (isLoading) {
      return (
        <View style={styles.playButton}>
          <Ionicons name="hourglass" size={24} color="#2196F3" />
        </View>
      );
    }

    if (isPlaying && !isPaused) {
      return (
        <TouchableOpacity style={styles.playButton} onPress={handlePause} activeOpacity={0.7}>
          <Ionicons name="pause" size={24} color="#2196F3" />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.7}>
        <Ionicons name="play" size={24} color="#2196F3" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.playerContainer}>
        {renderPlayButton()}

        <View style={styles.infoContainer}>
          {showDuration && (
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>
              {totalDuration > 0 && (
                <Text style={styles.timeText}>/ {formatTime(totalDuration)}</Text>
              )}
            </View>
          )}

          {totalDuration > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${getProgressPercentage()}%` }]} />
              </View>
            </View>
          )}
        </View>

        {(isPlaying || isPaused) && (
          <TouchableOpacity style={styles.stopButton} onPress={handleStop} activeOpacity={0.7}>
            <Ionicons name="stop" size={20} color="#F44336" />
          </TouchableOpacity>
        )}
      </View>

      {(isPlaying || isPaused) && (
        <View style={styles.statusContainer}>
          <View style={styles.statusIndicator}>
            <View
              style={[styles.statusDot, { backgroundColor: isPaused ? '#FF9800' : '#4CAF50' }]}
            />
            <Text style={[styles.statusText, { color: isPaused ? '#FF9800' : '#4CAF50' }]}>
              {isPaused ? 'PAUSADO' : 'REPRODUZINDO'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
  },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    marginRight: 12,
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    marginLeft: 8,
  },
  infoContainer: {
    flex: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  progressContainer: {
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
  statusContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { IconSymbol } from '~/components/ui/IconSymbol';
import { useShiftControl } from '../hooks/useShiftControl';
import { useAuth } from '../hooks/useAuth';

interface ShiftControlProps {
  buildingId: string;
}

export default function ShiftControl({ buildingId }: ShiftControlProps) {
  const { user } = useAuth();
  const {
    currentShift,
    isLoading,
    error,
    canStartShift,
    validationError,
    isRealtimeConnected,
    startShift,
    endShift,
    refreshShiftStatus
  } = useShiftControl({ porteiroId: user?.id || '', buildingId });

  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    // Atualizar status do turno quando o componente é montado
    refreshShiftStatus();
  }, [refreshShiftStatus]);

  const handleStartShift = async () => {
    if (!canStartShift) {
      Alert.alert(
        'Não é possível iniciar turno',
        validationError || 'Verifique se não há outro turno ativo.'
      );
      return;
    }

    Alert.alert(
      'Iniciar Turno',
      'Deseja iniciar seu turno de trabalho agora?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar',
          onPress: async () => {
            try {
              setIsStarting(true);
              await startShift();
              Alert.alert('Sucesso', 'Turno iniciado com sucesso!');
            } catch (error) {
              console.error('Erro ao iniciar turno:', error);
              Alert.alert('Erro', 'Falha ao iniciar turno. Tente novamente.');
            } finally {
              setIsStarting(false);
            }
          }
        }
      ]
    );
  };

  const handleEndShift = async () => {
    if (!currentShift) {
      Alert.alert('Erro', 'Nenhum turno ativo encontrado.');
      return;
    }

    Alert.alert(
      'Finalizar Turno',
      'Deseja finalizar seu turno de trabalho agora?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsEnding(true);
              await endShift();
              Alert.alert('Sucesso', 'Turno finalizado com sucesso!');
            } catch (error) {
              console.error('Erro ao finalizar turno:', error);
              Alert.alert('Erro', 'Falha ao finalizar turno. Tente novamente.');
            } finally {
              setIsEnding(false);
            }
          }
        }
      ]
    );
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <View className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <View className="flex-row items-center justify-center">
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text className="ml-2 text-gray-600">Carregando status do turno...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 shadow-lg border border-blue-200">
      {/* Compact Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="bg-white/20 rounded-full p-2 mr-3">
            <IconSymbol name="clock.fill" size={20} color="white" />
          </View>
          <View>
            <Text className="text-white font-bold text-base">
              Controle de Turno
            </Text>
            <View className="flex-row items-center mt-1">
              <View 
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  isRealtimeConnected ? 'bg-green-400' : 'bg-red-400'
                }`} 
              />
              <Text className="text-white/80 text-xs">
                {isRealtimeConnected ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* Compact Status Display */}
        <View className="flex-1">
          {currentShift ? (
            <View className="bg-white/10 rounded-lg p-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <IconSymbol name="checkmark.circle.fill" size={16} color="#10B981" />
                  <Text className="ml-2 text-white font-medium text-sm">
                    Turno Ativo
                  </Text>
                </View>
                <Text className="text-white/80 text-xs">
                  {formatDuration(currentShift.shift_start)}
                </Text>
              </View>
              <Text className="text-white/70 text-xs mt-1">
                Iniciado às {formatTime(currentShift.shift_start)}
              </Text>
            </View>
          ) : (
            <View className="bg-white/10 rounded-lg p-3">
              <View className="flex-row items-center">
                <IconSymbol name="person" size={16} color="#E5E7EB" />
                <Text className="ml-2 text-white/90 font-medium text-sm">
                  Fora de Turno
                </Text>
              </View>
              <Text className="text-white/70 text-xs mt-1">
                Inicie para receber notificações
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Error Messages - Compact */}
      {error && (
        <View className="bg-red-500/20 border border-red-400/30 rounded-lg p-2 mt-3">
          <Text className="text-red-100 text-xs text-center">{error}</Text>
        </View>
      )}

      {/* Action Button - Integrated */}
      <View className="mt-3">
        {currentShift ? (
          <TouchableOpacity
            onPress={handleEndShift}
            disabled={isEnding}
            className={`bg-red-500/20 border border-red-400/30 rounded-lg py-2.5 px-4 flex-row items-center justify-center ${
              isEnding ? 'opacity-50' : ''
            }`}
          >
            {isEnding ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <IconSymbol name="stop.circle.fill" size={16} color="#FCA5A5" />
                <Text className="ml-2 text-red-100 font-medium text-sm">
                  Finalizar Turno
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleStartShift}
            disabled={isStarting || !canStartShift}
            className={`bg-white/20 border border-white/30 rounded-lg py-2.5 px-4 flex-row items-center justify-center ${
              isStarting || !canStartShift ? 'opacity-50' : ''
            }`}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <IconSymbol name="play.circle.fill" size={16} color="white" />
                <Text className="ml-2 text-white font-medium text-sm">
                  Iniciar Turno
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

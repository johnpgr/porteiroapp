import { useState, useEffect, useRef, useCallback } from 'react';
import { shiftService, PorteiroShift, ShiftValidationResult } from '../services/shiftService';
import { Alert } from 'react-native';

interface UseShiftControlProps {
  porteiroId: string;
  buildingId: string;
  onShiftChange?: (shift: PorteiroShift | null) => void;
}

interface UseShiftControlReturn {
  // Estado atual
  currentShift: PorteiroShift | null;
  isOnDuty: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Ações
  startShift: () => Promise<void>;
  endShift: () => Promise<void>;
  refreshShiftStatus: () => Promise<void>;
  
  // Validação
  canStartShift: boolean;
  validationError: string | null;
  
  // Histórico
  shiftHistory: PorteiroShift[];
  loadShiftHistory: () => Promise<void>;
  
  // Realtime
  isRealtimeConnected: boolean;
}

export const useShiftControl = ({
  porteiroId,
  buildingId,
  onShiftChange
}: UseShiftControlProps): UseShiftControlReturn => {
  console.log('🎯 [useShiftControl] Hook executando para porteiro:', porteiroId, 'prédio:', buildingId);
  
  // Estados principais
  const [currentShift, setCurrentShift] = useState<PorteiroShift | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canStartShift, setCanStartShift] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [shiftHistory, setShiftHistory] = useState<PorteiroShift[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  
  // Refs para controle
  const isInitialized = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado derivado
  const isOnDuty = currentShift?.status === 'active';
  
  // Callback para mudanças de turno em tempo real
  const handleShiftChange = useCallback((shift: PorteiroShift) => {
    console.log('🔄 [useShiftControl] Mudança de turno detectada:', shift);
    
    // Atualizar apenas se for do porteiro atual
    if (shift.porteiro_id === porteiroId) {
      setCurrentShift(shift.status === 'active' ? shift : null);
      onShiftChange?.(shift.status === 'active' ? shift : null);
    }
    
    // Se for de outro porteiro no mesmo prédio, revalidar
    if (shift.building_id === buildingId && shift.porteiro_id !== porteiroId) {
      validateShiftStart();
    }
  }, [porteiroId, buildingId, onShiftChange]);
  
  // Validar se pode iniciar turno
  const validateShiftStart = useCallback(async () => {
    if (!porteiroId || !buildingId) return;
    
    try {
      const validation: ShiftValidationResult = await shiftService.validateShiftStart(porteiroId, buildingId);
      setCanStartShift(validation.isValid);
      setValidationError(validation.error || null);
    } catch (err) {
      console.error('❌ [useShiftControl] Erro na validação:', err);
      setCanStartShift(false);
      setValidationError('Erro ao validar turno');
    }
  }, [porteiroId, buildingId]);
  
  // Carregar turno ativo atual
  const refreshShiftStatus = useCallback(async () => {
    if (!porteiroId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { shift, error: shiftError } = await shiftService.getActiveShift(porteiroId);
      
      if (shiftError) {
        setError(shiftError);
        setCurrentShift(null);
      } else {
        setCurrentShift(shift || null);
        onShiftChange?.(shift || null);
      }
      
      // Validar se pode iniciar turno
      await validateShiftStart();
      
    } catch (err) {
      console.error('❌ [useShiftControl] Erro ao carregar turno:', err);
      setError('Erro ao carregar status do turno');
      setCurrentShift(null);
    } finally {
      setIsLoading(false);
    }
  }, [porteiroId, onShiftChange, validateShiftStart]);
  
  // Iniciar turno
  const startShift = useCallback(async () => {
    if (!porteiroId || !buildingId) {
      Alert.alert('Erro', 'Dados do porteiro não disponíveis');
      return;
    }
    
    if (!canStartShift) {
      Alert.alert('Não é possível iniciar turno', validationError || 'Validação falhou');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await shiftService.startShift(porteiroId, buildingId);
      
      if (result.success && result.shift) {
        setCurrentShift(result.shift);
        onShiftChange?.(result.shift);
        Alert.alert('Sucesso', 'Turno iniciado com sucesso!');
        console.log('✅ [useShiftControl] Turno iniciado:', result.shift);
      } else {
        setError(result.error || 'Erro desconhecido');
        Alert.alert('Erro', result.error || 'Não foi possível iniciar o turno');
      }
      
    } catch (err) {
      console.error('❌ [useShiftControl] Erro ao iniciar turno:', err);
      const errorMsg = 'Erro inesperado ao iniciar turno';
      setError(errorMsg);
      Alert.alert('Erro', errorMsg);
    } finally {
      setIsLoading(false);
      // Revalidar após tentativa
      await validateShiftStart();
    }
  }, [porteiroId, buildingId, canStartShift, validationError, onShiftChange, validateShiftStart]);
  
  // Finalizar turno
  const endShift = useCallback(async () => {
    if (!porteiroId) {
      Alert.alert('Erro', 'Dados do porteiro não disponíveis');
      return;
    }
    
    if (!currentShift) {
      Alert.alert('Erro', 'Nenhum turno ativo encontrado');
      return;
    }
    
    Alert.alert(
      'Finalizar Turno',
      'Tem certeza que deseja finalizar seu turno?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            setError(null);
            
            try {
              const result = await shiftService.endShift(porteiroId);
              
              if (result.success) {
                setCurrentShift(null);
                onShiftChange?.(null);
                Alert.alert('Sucesso', 'Turno finalizado com sucesso!');
                console.log('✅ [useShiftControl] Turno finalizado:', result.shift);
              } else {
                setError(result.error || 'Erro desconhecido');
                Alert.alert('Erro', result.error || 'Não foi possível finalizar o turno');
              }
              
            } catch (err) {
              console.error('❌ [useShiftControl] Erro ao finalizar turno:', err);
              const errorMsg = 'Erro inesperado ao finalizar turno';
              setError(errorMsg);
              Alert.alert('Erro', errorMsg);
            } finally {
              setIsLoading(false);
              // Revalidar após finalização
              await validateShiftStart();
            }
          }
        }
      ]
    );
  }, [porteiroId, currentShift, onShiftChange, validateShiftStart]);
  
  // Carregar histórico de turnos
  const loadShiftHistory = useCallback(async () => {
    if (!porteiroId) return;
    
    try {
      const { shifts, error: historyError } = await shiftService.getShiftHistory(porteiroId, 20);
      
      if (historyError) {
        console.error('❌ [useShiftControl] Erro ao carregar histórico:', historyError);
      } else {
        setShiftHistory(shifts || []);
        console.log('📋 [useShiftControl] Histórico carregado:', shifts?.length, 'turnos');
      }
      
    } catch (err) {
      console.error('❌ [useShiftControl] Erro inesperado no histórico:', err);
    }
  }, [porteiroId]);
  
  // Configurar realtime quando buildingId estiver disponível
  useEffect(() => {
    if (!buildingId) return;
    
    const setupRealtime = async () => {
      try {
        // Adicionar callback para mudanças
        shiftService.addShiftCallback(handleShiftChange);
        
        // Iniciar escuta em tempo real
        await shiftService.startRealtimeListening(buildingId);
        setIsRealtimeConnected(shiftService.isRealtimeConnected());
        
        console.log('🔄 [useShiftControl] Realtime configurado para prédio:', buildingId);
        
      } catch (err) {
        console.error('❌ [useShiftControl] Erro ao configurar realtime:', err);
      }
    };
    
    setupRealtime();
    
    // Cleanup
    return () => {
      shiftService.removeShiftCallback(handleShiftChange);
    };
  }, [buildingId, handleShiftChange]);
  
  // Inicialização e validação periódica
  useEffect(() => {
    if (!porteiroId || !buildingId || isInitialized.current) return;
    
    const initialize = async () => {
      console.log('🚀 [useShiftControl] Inicializando hook');
      await refreshShiftStatus();
      await loadShiftHistory();
      isInitialized.current = true;
    };
    
    initialize();
    
    // Validação periódica (a cada 30 segundos)
    const validationInterval = setInterval(() => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      
      validationTimeoutRef.current = setTimeout(() => {
        validateShiftStart();
      }, 1000); // Debounce de 1 segundo
    }, 30000);
    
    return () => {
      clearInterval(validationInterval);
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [porteiroId, buildingId, refreshShiftStatus, loadShiftHistory, validateShiftStart]);
  
  // Cleanup geral
  useEffect(() => {
    return () => {
      // Parar realtime ao desmontar
      shiftService.stopRealtimeListening();
      shiftService.clearShiftCallbacks();
    };
  }, []);
  
  return {
    // Estado atual
    currentShift,
    isOnDuty,
    isLoading,
    error,
    
    // Ações
    startShift,
    endShift,
    refreshShiftStatus,
    
    // Validação
    canStartShift,
    validationError,
    
    // Histórico
    shiftHistory,
    loadShiftHistory,
    
    // Realtime
    isRealtimeConnected
  };
};

export default useShiftControl;
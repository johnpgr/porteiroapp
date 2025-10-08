import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';

export interface CallKeepOptions {
  ios: {
    appName: string;
    imageName?: string;
    supportsVideo?: boolean;
    maximumCallGroups?: number;
    maximumCallsPerCallGroup?: number;
    includeInRecents?: boolean;
  };
  android: {
    alertTitle: string;
    alertDescription: string;
    cancelTitle: string;
    okTitle: string;
    imageName?: string;
    additionalPermissions?: string[];
    selfManaged?: boolean;
  };
}

class CallKeepService {
  private isInitialized = false;
  private currentCallUUID: string | null = null;
  private isNativeEnvironment = Platform.OS === 'ios' || Platform.OS === 'android';

  /**
   * Inicializa o CallKeep com as configurações necessárias
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('CallKeep já foi inicializado');
      return;
    }

    // Verificar se estamos em um ambiente nativo
    if (!this.isNativeEnvironment) {
      console.log('⚠️ CallKeep não é suportado no ambiente web/desktop. Pulando inicialização.');
      this.isInitialized = true;
      return;
    }

    try {
      const options: CallKeepOptions = {
        ios: {
          appName: 'Porteiro App',
          imageName: 'logo',
          supportsVideo: false,
          maximumCallGroups: 1,
          maximumCallsPerCallGroup: 1,
          includeInRecents: true,
        },
        android: {
          alertTitle: 'Permissões de Chamada',
          alertDescription: 'Este aplicativo precisa acessar suas chamadas para funcionar como interfone.',
          cancelTitle: 'Cancelar',
          okTitle: 'OK',
          imageName: 'logo',
          additionalPermissions: [],
          selfManaged: false,
        },
      };

      // Configurar eventos do CallKeep
      this.setupEventListeners();

      // Inicializar CallKeep
      await RNCallKeep.setup(options);
      
      // Verificar permissões
      const hasPermissions = await this.checkPermissions();
      if (!hasPermissions) {
        console.warn('CallKeep: Permissões não concedidas');
      }

      this.isInitialized = true;
      console.log('✅ CallKeep inicializado com sucesso');

    } catch (error) {
      console.error('❌ Erro ao inicializar CallKeep:', error);
      throw error;
    }
  }

  /**
   * Configura os event listeners do CallKeep
   */
  private setupEventListeners(): void {
    // Quando o usuário atende a chamada
    RNCallKeep.addEventListener('answerCall', this.onAnswerCall);
    
    // Quando o usuário encerra a chamada
    RNCallKeep.addEventListener('endCall', this.onEndCall);
    
    // Quando a chamada é colocada em hold
    RNCallKeep.addEventListener('didPerformSetMutedCallAction', this.onToggleMute);
    
    // Quando o usuário ativa/desativa o hold
    RNCallKeep.addEventListener('didToggleHoldCallAction', this.onToggleHold);
    
    // Quando o DTMF é pressionado
    RNCallKeep.addEventListener('didPerformDTMFAction', this.onDTMF);

    // Eventos específicos do Android
    if (Platform.OS === 'android') {
      RNCallKeep.addEventListener('showIncomingCallUi', this.onShowIncomingCallUi);
    }

    console.log('📱 Event listeners do CallKeep configurados');
  }

  /**
   * Verifica se as permissões necessárias foram concedidas
   */
  private async checkPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        return await RNCallKeep.checkPhoneAccountPermission();
      }
      return true; // iOS não precisa de verificação adicional
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      return false;
    }
  }

  /**
   * Solicita permissões necessárias (Android)
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        await RNCallKeep.requestPhoneAccountPermission();
        return await this.checkPermissions();
      }
      return true;
    } catch (error) {
      console.error('Erro ao solicitar permissões:', error);
      return false;
    }
  }

  /**
   * Exibe uma chamada recebida
   * @param callUUID - UUID único da chamada
   * @param callerName - Nome do chamador
   * @param handle - Identificador da chamada (número/ID)
   * @param hasVideo - Se a chamada tem vídeo
   */
  async displayIncomingCall(
    callUUID: string,
    callerName: string,
    handle: string = 'Interfone',
    hasVideo: boolean = false
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Se não estamos em ambiente nativo, apenas log
      if (!this.isNativeEnvironment) {
        console.log(`📞 [Web] Simulando chamada recebida: ${callUUID} - ${callerName}`);
        return;
      }

      this.currentCallUUID = callUUID;

      await RNCallKeep.displayIncomingCall(
        callUUID,
        handle,
        callerName,
        'generic',
        hasVideo
      );

      console.log(`📞 Chamada exibida: ${callUUID} - ${callerName}`);

    } catch (error) {
      console.error('❌ Erro ao exibir chamada:', error);
      throw error;
    }
  }

  /**
   * Inicia uma chamada de saída
   * @param callUUID - UUID único da chamada
   * @param handle - Identificador da chamada
   * @param contactName - Nome do contato
   * @param hasVideo - Se a chamada tem vídeo
   */
  async startCall(
    callUUID: string,
    handle: string,
    contactName: string = 'Interfone',
    hasVideo: boolean = false
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Se não estamos em ambiente nativo, apenas log
      if (!this.isNativeEnvironment) {
        console.log(`📞 [Web] Simulando chamada iniciada: ${callUUID} - ${contactName}`);
        return;
      }

      this.currentCallUUID = callUUID;

      await RNCallKeep.startCall(callUUID, handle, contactName, 'generic', hasVideo);

      console.log(`📞 Chamada iniciada: ${callUUID} - ${contactName}`);

    } catch (error) {
      console.error('❌ Erro ao iniciar chamada:', error);
      throw error;
    }
  }

  /**
   * Encerra uma chamada
   * @param callUUID - UUID da chamada (opcional, usa a atual se não fornecido)
   */
  async endCall(callUUID?: string): Promise<void> {
    try {
      const uuid = callUUID || this.currentCallUUID;
      if (!uuid) {
        console.warn('Nenhuma chamada ativa para encerrar');
        return;
      }

      // Se não estamos em ambiente nativo, apenas log
      if (!this.isNativeEnvironment) {
        console.log(`📞 [Web] Simulando encerramento de chamada: ${uuid}`);
        if (uuid === this.currentCallUUID) {
          this.currentCallUUID = null;
        }
        return;
      }

      await RNCallKeep.endCall(uuid);
      
      if (uuid === this.currentCallUUID) {
        this.currentCallUUID = null;
      }

      console.log(`📞 Chamada encerrada: ${uuid}`);

    } catch (error) {
      console.error('❌ Erro ao encerrar chamada:', error);
      throw error;
    }
  }

  /**
   * Reporta que a chamada foi conectada
   * @param callUUID - UUID da chamada
   */
  async reportConnectedCall(callUUID?: string): Promise<void> {
    try {
      const uuid = callUUID || this.currentCallUUID;
      if (!uuid) {
        console.warn('Nenhuma chamada para reportar como conectada');
        return;
      }

      await RNCallKeep.reportConnectedOutgoingCallWithUUID(uuid);
      console.log(`✅ Chamada reportada como conectada: ${uuid}`);

    } catch (error) {
      console.error('❌ Erro ao reportar chamada conectada:', error);
    }
  }

  /**
   * Reporta que a chamada terminou
   * @param callUUID - UUID da chamada
   * @param reason - Razão do término (1 = failed, 2 = remote ended, 3 = unanswered, 6 = answered elsewhere)
   */
  async reportEndCall(callUUID?: string, reason: number = 2): Promise<void> {
    try {
      const uuid = callUUID || this.currentCallUUID;
      if (!uuid) {
        console.warn('Nenhuma chamada para reportar como terminada');
        return;
      }

      await RNCallKeep.reportEndCallWithUUID(uuid, reason);
      
      if (uuid === this.currentCallUUID) {
        this.currentCallUUID = null;
      }

      console.log(`📞 Chamada reportada como terminada: ${uuid} (razão: ${reason})`);

    } catch (error) {
      console.error('❌ Erro ao reportar fim da chamada:', error);
    }
  }

  /**
   * Atualiza o nome do chamador
   * @param callUUID - UUID da chamada
   * @param displayName - Novo nome para exibir
   */
  async updateDisplay(callUUID: string, displayName: string): Promise<void> {
    try {
      await RNCallKeep.updateDisplay(callUUID, displayName, '');
      console.log(`📞 Display atualizado: ${callUUID} - ${displayName}`);
    } catch (error) {
      console.error('❌ Erro ao atualizar display:', error);
    }
  }

  /**
   * Obtém o UUID da chamada atual
   */
  getCurrentCallUUID(): string | null {
    return this.currentCallUUID;
  }

  /**
   * Verifica se há uma chamada ativa
   */
  hasActiveCall(): boolean {
    return this.currentCallUUID !== null;
  }

  // Event Handlers
  private onAnswerCall = ({ callUUID }: { callUUID: string }) => {
    console.log('📞 CallKeep: Chamada atendida', callUUID);
    // Aqui você pode adicionar lógica personalizada quando a chamada for atendida
  };

  private onEndCall = ({ callUUID }: { callUUID: string }) => {
    console.log('📞 CallKeep: Chamada encerrada', callUUID);
    if (callUUID === this.currentCallUUID) {
      this.currentCallUUID = null;
    }
    // Aqui você pode adicionar lógica personalizada quando a chamada for encerrada
  };

  private onToggleMute = ({ muted, callUUID }: { muted: boolean; callUUID: string }) => {
    console.log('📞 CallKeep: Mute toggled', { muted, callUUID });
  };

  private onToggleHold = ({ hold, callUUID }: { hold: boolean; callUUID: string }) => {
    console.log('📞 CallKeep: Hold toggled', { hold, callUUID });
  };

  private onDTMF = ({ digits, callUUID }: { digits: string; callUUID: string }) => {
    console.log('📞 CallKeep: DTMF', { digits, callUUID });
  };

  private onShowIncomingCallUi = ({ callUUID }: { callUUID: string }) => {
    console.log('📞 CallKeep: Show incoming call UI', callUUID);
  };

  /**
   * Remove todos os event listeners
   */
  cleanup(): void {
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
    RNCallKeep.removeEventListener('didToggleHoldCallAction');
    RNCallKeep.removeEventListener('didPerformDTMFAction');
    
    if (Platform.OS === 'android') {
      RNCallKeep.removeEventListener('showIncomingCallUi');
    }

    this.currentCallUUID = null;
    this.isInitialized = false;
    
    console.log('🧹 CallKeep cleanup realizado');
  }
}

// Exportar instância singleton
export const callKeepService = new CallKeepService();
export default callKeepService;
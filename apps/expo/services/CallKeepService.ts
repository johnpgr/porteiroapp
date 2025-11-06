import RNCallKeep from 'react-native-callkeep';
import {foregroundService} from './AndroidForegroundService';
import { Platform } from 'react-native';

export interface CallKeepOptions {
  ios: {
    appName: string;
    imageName?: string;
    supportsVideo?: boolean;
    maximumCallGroups?: string;
    maximumCallsPerCallGroup?: string;
    includesCallsInRecents?: boolean;
  };
  android: {
    alertTitle: string;
    alertDescription: string;
    cancelButton: string;
    okButton: string;
    imageName?: string;
    additionalPermissions: string[];
    selfManaged?: boolean;
  };
}

// Event types for CallKeep
type CallKeepEvent = 'answer' | 'end' | 'mute' | 'hold' | 'dtmf' | 'showIncomingUi';
type CallKeepEventHandler = (payload: any) => void;

// Simple event emitter
class Emitter<TEvents extends Record<string, any>> {
  private listeners = new Map<keyof TEvents, Set<(payload: any) => void>>();

  on<K extends keyof TEvents>(event: K, handler: (payload: TEvents[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as any);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off<K extends keyof TEvents>(event: K, handler: (payload: TEvents[K]) => void): void {
    this.listeners.get(event)?.delete(handler as any);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    handlers.forEach(h => {
      try {
        h(payload);
      } catch (error) {
        console.error(`[CallKeep] Event handler error for ${String(event)}:`, error);
      }
    });
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

interface CallKeepEvents {
  answer: string; // callUUID
  end: string; // callUUID
  mute: { muted: boolean; callUUID: string };
  hold: { hold: boolean; callUUID: string };
  dtmf: { digits: string; callUUID: string };
  showIncomingUi: string; // callUUID
}

class CallKeepService {
  private isInitialized = false;
  private currentCallUUID: string | null = null;
  private isNativeEnvironment = Platform.OS === 'ios' || Platform.OS === 'android';
  private lastOptions: CallKeepOptions | null = null;
  private verboseLogging = __DEV__;
  private emitter = new Emitter<CallKeepEvents>();

  private vlog(...args: any[]) {
    if (this.verboseLogging) {
      console.log('[CallKeep][VERBOSE]', ...args);
    }
  }

  enableVerboseLogging(enabled: boolean) {
    this.verboseLogging = enabled;
    console.log('[CallKeep] Verbose logging:', enabled ? 'ENABLED' : 'DISABLED');
  }

  isVerboseLoggingEnabled(): boolean {
    return this.verboseLogging;
  }

  /**
   * Inicializa o CallKeep com as configurações necessárias
   */
  async initialize(): Promise<void> {
    this.vlog('📋 Initialize called');
    this.vlog('  - Platform:', Platform.OS);
    this.vlog('  - isInitialized:', this.isInitialized);
    this.vlog('  - isNativeEnvironment:', this.isNativeEnvironment);

    console.log('[CallKeep] 🚀 initialize() called');
    console.log('[CallKeep] Platform:', Platform.OS);
    console.log('[CallKeep] isInitialized:', this.isInitialized);

    if (this.isInitialized) {
      console.log('[CallKeep] ✅ Already initialized, skipping');
      return;
    }

    // Verificar se estamos em um ambiente nativo
    if (!this.isNativeEnvironment) {
      console.log('[CallKeep] ⚠️ Not running on native platform (iOS/Android). Skipping initialization.');
      this.isInitialized = true;
      return;
    }

    try {
      const options: CallKeepOptions = {
        ios: {
          appName: 'Porteiro App',
          imageName: 'logo',
          supportsVideo: false,
          maximumCallGroups: '1',
          maximumCallsPerCallGroup: '1',
          includesCallsInRecents: true,
        },
        android: {
          alertTitle: 'Permissões de Chamada',
          alertDescription:
            'Este aplicativo precisa acessar suas chamadas para funcionar como interfone.',
          cancelButton: 'Cancelar',
          okButton: 'OK',
          imageName: 'logo',
          additionalPermissions: [],
          selfManaged: false,
          // foregroundService: {
          //   channelId: 'intercom-call-keep',
          //   channelName: 'Intercom Calls',
          //   notificationTitle: 'Intercom call',
          //   notificationIcon: 'logo'
          // }
        },
      };

      this.lastOptions = options;

      console.log('[CallKeep] 📝 Options configured:', JSON.stringify({
        ios: { appName: options.ios.appName },
        android: { alertTitle: options.android.alertTitle }
      }));

      // Configurar eventos do CallKeep
      console.log('[CallKeep] 🎧 Setting up event listeners...');
      this.setupEventListeners();

      // Inicializar CallKeep
      console.log('[CallKeep] ⚙️ Calling RNCallKeep.setup()...');
      await RNCallKeep.setup(options as CallKeepOptions);
      console.log('[CallKeep] ✅ RNCallKeep.setup() completed');

      // Process any queued native events (answer/end) that happened before JS was ready
      console.log('[CallKeep] 📥 Processing any queued initial events...');
      await this.processInitialEventsSafe();

      // Verificar permissões
      console.log('[CallKeep] 🔐 Checking permissions...');
      const hasPermissions = await this.checkPermissions();
      console.log('[CallKeep] Permissions granted:', hasPermissions);
      if (!hasPermissions) {
        console.warn('[CallKeep] ⚠️ Permissions not granted yet');
      }

      this.isInitialized = true;
      console.log('[CallKeep] ✅ Initialization complete!');
    } catch (error) {
      console.error('[CallKeep] ❌ Initialization failed:', error);
      console.error('[CallKeep] Error stack:', error instanceof Error ? error.stack : 'No stack');
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

    // If the native side had events before JS listeners attached, it will emit them via didLoadWithEvents
    // We handle them here to keep native UI and app state in sync when user answers from lockscreen/background
    (RNCallKeep as any).addEventListener?.('didLoadWithEvents', (events: any) => {
      try {
        const list = Array.isArray(events) ? events : [];
        if (list.length) {
          console.log('📞 CallKeep: didLoadWithEvents', list.map((e: any) => e?.name));
        }
        for (const evt of list) {
          this.handleInitialEvent(evt);
        }
      } catch (e) {
        console.warn('⚠️ CallKeep: didLoadWithEvents handling error', e);
      }
    });

    console.log('📱 Event listeners do CallKeep configurados');
  }

  private async processInitialEventsSafe(): Promise<void> {
    try {
      const fn = (RNCallKeep as any).getInitialEvents;
      if (!fn) return;
      const events = await fn();
      if (Array.isArray(events) && events.length > 0) {
        console.log('📞 CallKeep: Processing initial events', events.map((e: any) => e?.name));
        for (const evt of events) {
          this.handleInitialEvent(evt);
        }
        (RNCallKeep as any).clearInitialEvents?.();
      }
    } catch {
      // no-op
    }
  }

  private handleInitialEvent(evt: any): void {
    const name = evt?.name;
    const data = evt?.data ?? evt;
    if (!name) return;
    switch (name) {
      case 'RNCallKeepPerformAnswerCallAction':
        if (data?.callUUID) this.onAnswerCall({ callUUID: data.callUUID });
        break;
      case 'RNCallKeepPerformEndCallAction':
        if (data?.callUUID) this.onEndCall({ callUUID: data.callUUID });
        break;
      default:
        break;
    }
  }

  /**
   * Register event handler (event emitter pattern)
   * @param event - Event name ('answer', 'end', 'mute', etc.)
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on<K extends keyof CallKeepEvents>(event: K, handler: (payload: CallKeepEvents[K]) => void): () => void {
    console.log(`[CallKeep] 📝 Registering handler for '${String(event)}' event`);
    return this.emitter.on(event, handler);
  }

  /**
   * Verifica se as permissões necessárias foram concedidas
   */
  private async checkPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        return await RNCallKeep.checkPhoneAccountEnabled();
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
        if (this.lastOptions) {
          RNCallKeep.registerPhoneAccount(this.lastOptions as CallKeepOptions);
        }
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
    this.vlog('📋 displayIncomingCall called', { callUUID, callerName, handle, hasVideo });
    this.vlog('  - isInitialized:', this.isInitialized);
    this.vlog('  - isNativeEnvironment:', this.isNativeEnvironment);
    this.vlog('  - Platform:', Platform.OS);

    try {
      if (!this.isInitialized) {
        console.log('[CallKeep] Not initialized, calling initialize()...');
        await this.initialize();
      }

      const hasPermissions = await this.checkPermissions();
      if (!hasPermissions) {
        console.error('[CallKeep] ❌ Permissions not granted - cannot display call');
        throw new Error('CallKeep permissions required');
      }

      if (Platform.OS === 'android') {
        console.log('[CallKeep] 🚀 Starting Android foreground service...');
        await foregroundService.start(callerName, handle);
        console.log('[CallKeep] ✅ Foreground service started');
      }

      // Se não estamos em ambiente nativo, apenas log
      if (!this.isNativeEnvironment) {
        console.log('[CallKeep] 📞 [Web] Simulating incoming call:', callUUID, '-', callerName);
        return;
      }

      this.currentCallUUID = callUUID;
      console.log('[CallKeep] Current call UUID set to:', this.currentCallUUID);

      console.log('[CallKeep] 📱 Calling RNCallKeep.displayIncomingCall()...');
      RNCallKeep.displayIncomingCall(callUUID, handle, callerName, 'generic', hasVideo);
      console.log('[CallKeep] ✅ RNCallKeep.displayIncomingCall() completed');
      console.log('[CallKeep] 📞 Native UI should now be showing');

    } catch (error) {
      console.error('[CallKeep] ❌ displayIncomingCall() failed:', error);
      console.error('[CallKeep] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack'
      });

      if (Platform.OS === 'android') {
        await foregroundService.stop();
      }

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

      RNCallKeep.startCall(callUUID, handle, contactName, 'generic', hasVideo);

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

      RNCallKeep.endCall(uuid);

      if (uuid === this.currentCallUUID) {
        this.currentCallUUID = null;
      }

      console.log(`📞 Chamada encerrada: ${uuid}`);

      if (Platform.OS === 'android') {
        console.log('[CallKeep] 🛑 Stopping Android foreground service...');
        await foregroundService.stop();
        console.log('[CallKeep] ✅ Foreground service stopped');
      }
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

      RNCallKeep.reportConnectedOutgoingCallWithUUID(uuid);
      console.log(`✅ Chamada reportada como conectada: ${uuid}`);
    } catch (error) {
      console.error('❌ Erro ao reportar chamada conectada:', error);
    }
  }

  /**
   * Aceita uma chamada recebida (native UI)
   * IMPORTANT: This does NOT dismiss the native UI - it keeps it visible during the call
   * Native UI will stay visible until endCall() or reportEndCall() is called
   * @param callUUID - UUID da chamada (opcional)
   */
  async answerIncoming(callUUID?: string): Promise<void> {
    try {
      const uuid = callUUID || this.currentCallUUID;
      if (!uuid) {
        console.warn('Nenhuma chamada para atender');
        return;
      }
      // This tells the OS we've accepted the call - native UI transitions from "ringing" to "connected" state
      // but remains visible with call controls (mute, speaker, end)
      RNCallKeep.answerIncomingCall(uuid);
      console.log(`✅ Chamada marcada como atendida (native UI remains visible): ${uuid}`);
    } catch (error) {
      console.error('❌ Erro ao atender chamada (native):', error);
    }
  }

  /**
   * Rejeita uma chamada recebida (antes de conectar)
   */
  async rejectCall(callUUID?: string): Promise<void> {
    try {
      const uuid = callUUID || this.currentCallUUID;
      if (!uuid) {
        console.warn('Nenhuma chamada para rejeitar');
        return;
      }
      RNCallKeep.rejectCall(uuid);
      console.log(`📵 Chamada rejeitada (native): ${uuid}`);
      if (uuid === this.currentCallUUID) {
        this.currentCallUUID = null;
      }
    } catch (error) {
      console.error('❌ Erro ao rejeitar chamada (native):', error);
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

      RNCallKeep.reportEndCallWithUUID(uuid, reason);

      if (uuid === this.currentCallUUID) {
        this.currentCallUUID = null;
      }

      if (Platform.OS === 'android') {
        await foregroundService.stop();
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
      RNCallKeep.updateDisplay(callUUID, displayName, '');
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
    console.log('[CallKeep] 🎯 onAnswerCall EVENT FIRED');
    console.log('[CallKeep] - callUUID:', callUUID);
    console.log('[CallKeep] - currentCallUUID:', this.currentCallUUID);
    console.log('[CallKeep] - Platform:', Platform.OS);

    // Informar ao OS que a chamada foi atendida
    // This transitions native UI from "ringing" to "connected" but KEEPS IT VISIBLE
    console.log('[CallKeep] Step 1: Calling answerIncoming()...');
    this.answerIncoming(callUUID).catch((err) => {
      console.error('[CallKeep] answerIncoming() failed:', err);
    });

    // Marcar como conectada (iOS: outgoing connected report; safe no-op em Android)
    // This updates the native UI state but does NOT dismiss it
    console.log('[CallKeep] Step 2: Calling reportConnectedCall()...');
    this.reportConnectedCall(callUUID).catch((err) => {
      console.error('[CallKeep] reportConnectedCall() failed:', err);
    });

    // Emit event for external listeners (e.g., CallCoordinator)
    console.log('[CallKeep] Step 3: Emitting "answer" event...');
    this.emitter.emit('answer', callUUID);
    console.log('[CallKeep] ✅ "answer" event emitted');

    console.log('[CallKeep] 🎯 onAnswerCall handler complete');
    // IMPORTANT: We do NOT call endCall() here
    // Native UI will remain visible until user clicks "End" or remote party hangs up
  };

  private onEndCall = ({ callUUID }: { callUUID: string }) => {
    console.log('[CallKeep] 🎯 onEndCall EVENT FIRED');
    console.log('[CallKeep] - callUUID:', callUUID);
    console.log('[CallKeep] - currentCallUUID:', this.currentCallUUID);

    if (callUUID === this.currentCallUUID) {
      console.log('[CallKeep] Clearing currentCallUUID');
      this.currentCallUUID = null;
    }

    // Emit event for external listeners (e.g., CallCoordinator)
    console.log('[CallKeep] Emitting "end" event...');
    this.emitter.emit('end', callUUID);
    console.log('[CallKeep] ✅ "end" event emitted');

    console.log('[CallKeep] 🎯 onEndCall handler complete');
  };

  private onToggleMute = ({ muted, callUUID }: { muted: boolean; callUUID: string }) => {
    console.log('[CallKeep] 🎯 onToggleMute EVENT FIRED', { muted, callUUID });
    this.emitter.emit('mute', { muted, callUUID });
    console.log('[CallKeep] ✅ "mute" event emitted');
  };

  private onToggleHold = ({ hold, callUUID }: { hold: boolean; callUUID: string }) => {
    console.log('[CallKeep] 🎯 onToggleHold EVENT FIRED', { hold, callUUID });
    this.emitter.emit('hold', { hold, callUUID });
    console.log('[CallKeep] ✅ "hold" event emitted');
  };

  private onDTMF = ({ digits, callUUID }: { digits: string; callUUID: string }) => {
    console.log('[CallKeep] 🎯 onDTMF EVENT FIRED', { digits, callUUID });
    this.emitter.emit('dtmf', { digits, callUUID });
    console.log('[CallKeep] ✅ "dtmf" event emitted');
  };

  private onShowIncomingCallUi = ({ callUUID }: { callUUID: string }) => {
    console.log('[CallKeep] 🎯 onShowIncomingCallUi EVENT FIRED', callUUID);
    this.emitter.emit('showIncomingUi', callUUID);
    console.log('[CallKeep] ✅ "showIncomingUi" event emitted');
  };

  /**
   * Remove todos os event listeners
   */
  cleanup(): void {
    // Remove native RNCallKeep event listeners
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
    RNCallKeep.removeEventListener('didToggleHoldCallAction');
    RNCallKeep.removeEventListener('didPerformDTMFAction');

    if (Platform.OS === 'android') {
      RNCallKeep.removeEventListener('showIncomingCallUi');
    }

    (RNCallKeep as any).removeEventListener?.('didLoadWithEvents');

    // Clear event emitter listeners
    this.emitter.removeAllListeners();

    this.currentCallUUID = null;
    this.isInitialized = false;

    console.log('[CallKeep] 🧹 Cleanup complete - all listeners removed');
  }
}

// Exportar instância singleton
export const callKeepService = new CallKeepService();

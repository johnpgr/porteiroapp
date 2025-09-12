import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PorteiroShift {
  id: string;
  porteiro_id: string;
  building_id: string;
  shift_start: string;
  shift_end: string | null;
  status: 'active' | 'ended';
  created_at: string;
  updated_at: string;
}

export interface ShiftValidationResult {
  isValid: boolean;
  error?: string;
  conflictingShift?: PorteiroShift;
}

export interface ShiftCallback {
  (shift: PorteiroShift): void;
}

class ShiftService {
  private channel: RealtimeChannel | null = null;
  private callbacks: ShiftCallback[] = [];
  private isConnected = false;

  /**
   * Inicia um novo turno para o porteiro
   */
  async startShift(porteiroId: string, buildingId: string): Promise<{ success: boolean; shift?: PorteiroShift; error?: string }> {
    try {
      // Verificar se já existe um turno ativo
      const { data: activeShift, error: checkError } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('porteiro_id', porteiroId)
        .eq('status', 'active')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Erro ao verificar turno ativo:', checkError);
        return { success: false, error: 'Erro ao verificar turno ativo' };
      }

      if (activeShift) {
        return { success: false, error: 'Já existe um turno ativo para este porteiro' };
      }

      // Verificar conflitos com outros porteiros no mesmo prédio
      const { data: conflictingShifts, error: conflictError } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('building_id', buildingId)
        .eq('status', 'active');

      if (conflictError) {
        console.error('Erro ao verificar conflitos:', conflictError);
        return { success: false, error: 'Erro ao verificar conflitos de turno' };
      }

      if (conflictingShifts && conflictingShifts.length > 0) {
        return { 
          success: false, 
          error: 'Já existe outro porteiro em turno ativo neste prédio' 
        };
      }

      // Criar novo turno
      const { data: newShift, error: insertError } = await supabase
        .from('porteiro_shifts')
        .insert({
          porteiro_id: porteiroId,
          building_id: buildingId,
          shift_start: new Date().toISOString(),
          status: 'active'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao criar turno:', insertError);
        return { success: false, error: 'Erro ao iniciar turno' };
      }

      console.log('✅ Turno iniciado com sucesso:', newShift);
      return { success: true, shift: newShift };

    } catch (error) {
      console.error('❌ Erro inesperado ao iniciar turno:', error);
      return { success: false, error: 'Erro inesperado ao iniciar turno' };
    }
  }

  /**
   * Finaliza o turno ativo do porteiro
   */
  async endShift(porteiroId: string): Promise<{ success: boolean; shift?: PorteiroShift; error?: string }> {
    try {
      // Buscar turno ativo
      const { data: activeShift, error: findError } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('porteiro_id', porteiroId)
        .eq('status', 'active')
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          return { success: false, error: 'Nenhum turno ativo encontrado' };
        }
        console.error('Erro ao buscar turno ativo:', findError);
        return { success: false, error: 'Erro ao buscar turno ativo' };
      }

      // Verificar se activeShift existe
      if (!activeShift) {
        return { success: false, error: 'Nenhum turno ativo encontrado' };
      }

      // Atualizar o turno para finalizado
      const { data: updatedShift, error: updateError } = await supabase
        .from('porteiro_shifts')
        .update({
          status: 'ended',
          shift_end: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', activeShift.id)
        .select()
        .single();

      if (updateError) {
        console.error('Erro ao finalizar turno:', updateError);
        return { success: false, error: 'Erro ao finalizar turno' };
      }

      console.log('✅ Turno finalizado com sucesso:', updatedShift);
      return { success: true, shift: updatedShift };

    } catch (error) {
      console.error('❌ Erro inesperado ao finalizar turno:', error);
      return { success: false, error: 'Erro inesperado ao finalizar turno' };
    }
  }

  /**
   * Obtém o turno ativo do porteiro
   */
  async getActiveShift(porteiroId: string): Promise<{ shift?: PorteiroShift; error?: string }> {
    try {
      const { data: activeShift, error } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('porteiro_id', porteiroId)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {}; // Nenhum turno ativo
        }
        console.error('Erro ao buscar turno ativo:', error);
        return { error: 'Erro ao buscar turno ativo' };
      }

      return { shift: activeShift };

    } catch (error) {
      console.error('❌ Erro inesperado ao buscar turno ativo:', error);
      return { error: 'Erro inesperado ao buscar turno ativo' };
    }
  }

  /**
   * Obtém o porteiro ativo no prédio
   */
  async getActivePorteiroInBuilding(buildingId: string): Promise<{ porteiroId?: string; shift?: PorteiroShift; error?: string }> {
    try {
      const { data: activeShift, error } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('building_id', buildingId)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {}; // Nenhum porteiro ativo
        }
        console.error('Erro ao buscar porteiro ativo:', error);
        return { error: 'Erro ao buscar porteiro ativo' };
      }

      return { porteiroId: activeShift.porteiro_id, shift: activeShift };

    } catch (error) {
      console.error('❌ Erro inesperado ao buscar porteiro ativo:', error);
      return { error: 'Erro inesperado ao buscar porteiro ativo' };
    }
  }

  /**
   * Obtém o histórico de turnos do porteiro
   */
  async getShiftHistory(porteiroId: string, limit: number = 10): Promise<{ shifts?: PorteiroShift[]; error?: string }> {
    try {
      const { data: shifts, error } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('porteiro_id', porteiroId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Erro ao buscar histórico de turnos:', error);
        return { error: 'Erro ao buscar histórico de turnos' };
      }

      return { shifts: shifts || [] };

    } catch (error) {
      console.error('❌ Erro inesperado ao buscar histórico:', error);
      return { error: 'Erro inesperado ao buscar histórico' };
    }
  }

  /**
   * Valida se um porteiro pode iniciar um turno
   */
  async validateShiftStart(porteiroId: string, buildingId: string): Promise<ShiftValidationResult> {
    try {
      // Verificar turno ativo do próprio porteiro
      const { data: ownActiveShift, error: ownError } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('porteiro_id', porteiroId)
        .eq('status', 'active')
        .single();

      if (ownError && ownError.code !== 'PGRST116') {
        return { isValid: false, error: 'Erro ao verificar turno próprio' };
      }

      if (ownActiveShift) {
        return { 
          isValid: false, 
          error: 'Você já possui um turno ativo',
          conflictingShift: ownActiveShift 
        };
      }

      // Verificar conflitos no prédio
      const { data: buildingActiveShifts, error: buildingError } = await supabase
        .from('porteiro_shifts')
        .select('*')
        .eq('building_id', buildingId)
        .eq('status', 'active');

      if (buildingError) {
        return { isValid: false, error: 'Erro ao verificar conflitos no prédio' };
      }

      if (buildingActiveShifts && buildingActiveShifts.length > 0) {
        return { 
          isValid: false, 
          error: 'Já existe outro porteiro em turno neste prédio',
          conflictingShift: buildingActiveShifts[0] 
        };
      }

      return { isValid: true };

    } catch (error) {
      console.error('❌ Erro na validação:', error);
      return { isValid: false, error: 'Erro inesperado na validação' };
    }
  }

  /**
   * Inicia escuta em tempo real para mudanças nos turnos
   */
  async startRealtimeListening(buildingId?: string): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      let filter = '';
      if (buildingId) {
        filter = `building_id=eq.${buildingId}`;
      }

      this.channel = supabase
        .channel('shift-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'porteiro_shifts',
            filter: filter
          },
          (payload) => {
            this.handleShiftChange(payload);
          }
        )
        .subscribe((status) => {
          this.isConnected = status === 'SUBSCRIBED';
        });

    } catch (error) {
      console.error('❌ Erro ao iniciar escuta em tempo real:', error);
      throw error;
    }
  }

  /**
   * Para a escuta em tempo real
   */
  async stopRealtimeListening(): Promise<void> {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
      this.isConnected = false;
    }
  }

  /**
   * Adiciona callback para mudanças nos turnos
   */
  addShiftCallback(callback: ShiftCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove callback específico
   */
  removeShiftCallback(callback: ShiftCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Remove todos os callbacks
   */
  clearShiftCallbacks(): void {
    this.callbacks = [];
  }

  /**
   * Verifica se está conectado ao realtime
   */
  isRealtimeConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Manipula mudanças nos turnos em tempo real
   */
  private handleShiftChange(payload: any): void {
    try {
      const shift = payload.new || payload.old;
      if (shift) {
        this.callbacks.forEach(callback => {
          try {
            callback(shift);
          } catch (error) {
            console.error('❌ Erro no callback de turno:', error);
          }
        });
      }
    } catch (error) {
      console.error('❌ Erro ao processar mudança de turno:', error);
    }
  }
}

// Exportar instância singleton
export const shiftService = new ShiftService();
export default shiftService;
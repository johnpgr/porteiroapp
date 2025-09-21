import { supabase } from '../lib/supabase';

export interface FirstLoginData {
  cpf: string;
  photoUrl?: string;
}

export interface ProfileVerificationData {
  cpf_provided: boolean;
  photo_uploaded: boolean;
  completion_date: string;
  device_info?: any;
}

export class FirstLoginService {
  /**
   * Verifica se o usuário precisa completar o primeiro login
   */
  static async checkFirstLoginRequired(userId: string): Promise<boolean> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('first_login_completed, cpf')
        .eq('id', userId)
        .single();

      if (error) {
        throw new Error(`Erro ao verificar perfil: ${error.message}`);
      }

      return !profile?.first_login_completed || !profile?.cpf;
    } catch (error: any) {
      console.error('Erro ao verificar primeiro login:', error);
      throw error;
    }
  }

  /**
   * Obtém dados do perfil do usuário
   */
  static async getProfileData(userId: string) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw new Error(`Erro ao obter dados do perfil: ${error.message}`);
      }

      return profile;
    } catch (error: any) {
      console.error('Erro ao obter perfil:', error);
      throw error;
    }
  }

  /**
   * Completa o processo de primeiro login
   */
  static async completeFirstLogin(
    userId: string, 
    data: FirstLoginData
  ): Promise<void> {
    try {
      // Validar CPF
      if (!this.isValidCPF(data.cpf)) {
        throw new Error('CPF inválido');
      }

      // Verificar se CPF já está em uso
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('cpf', data.cpf)
        .neq('id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(`Erro ao verificar CPF: ${checkError.message}`);
      }

      if (existingProfile) {
        throw new Error('Este CPF já está cadastrado para outro usuário');
      }

      // Atualizar perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          cpf: data.cpf,
          photo_url: data.photoUrl,
          first_login_completed: true,
          profile_completion_date: new Date().toISOString(),
          photo_verification_status: data.photoUrl ? 'pending' : null
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
      }

      // Registrar verificação
      await this.logVerification(userId, {
        cpf_provided: !!data.cpf,
        photo_uploaded: !!data.photoUrl,
        completion_date: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Erro ao completar primeiro login:', error);
      throw error;
    }
  }

  /**
   * Registra a verificação na tabela de auditoria
   */
  static async logVerification(
    userId: string, 
    verificationData: ProfileVerificationData
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('profile_verifications')
        .insert({
          profile_id: userId,
          verification_type: 'complete',
          status: 'approved',
          verified_by: userId,
          notes: `Primeiro login completado - CPF: ${verificationData.cpf_provided ? 'fornecido' : 'não fornecido'}, Foto: ${verificationData.photo_uploaded ? 'enviada' : 'não enviada'}`
        });

      if (error) {
        console.warn('Erro ao registrar verificação:', error);
        // Não falhar por causa do log
      }
    } catch (error) {
      console.warn('Erro ao registrar verificação:', error);
    }
  }

  /**
   * Valida CPF usando algoritmo padrão
   */
  static isValidCPF(cpf: string): boolean {
    // Remove caracteres não numéricos
    const cleanCPF = cpf.replace(/[^\d]/g, '');

    // Verifica se tem 11 dígitos
    if (cleanCPF.length !== 11) {
      return false;
    }

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cleanCPF)) {
      return false;
    }

    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
  }

  /**
   * Formata CPF para exibição
   */
  static formatCPF(cpf: string): string {
    const cleanCPF = cpf.replace(/[^\d]/g, '');
    return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Remove formatação do CPF
   */
  static cleanCPF(cpf: string): string {
    return cpf.replace(/[^\d]/g, '');
  }
}
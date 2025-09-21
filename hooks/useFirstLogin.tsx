import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface FirstLoginData {
  full_name: string;
  cpf: string;
  phone: string;
  birth_date: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  photoUri: string | null;
}

export interface FirstLoginStatus {
  isFirstLogin: boolean;
  isLoading: boolean;
  error: string | null;
  profileData: any;
}

export const useFirstLogin = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<FirstLoginStatus>({
    isFirstLogin: false,
    isLoading: true,
    error: null,
    profileData: null
  });

  // Verificar se é primeiro login
  const checkFirstLoginStatus = useCallback(async () => {
    if (!user) {
      setStatus({
        isFirstLogin: false,
        isLoading: true, // Manter loading até ter usuário
        error: null,
        profileData: null
      });
      return;
    }

    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao buscar perfil no useFirstLogin:', error);
        throw error;
      }
      
      // Se não existe perfil, é definitivamente primeiro login
      if (!profile) {
        setStatus({
          isFirstLogin: true,
          isLoading: false,
          error: null,
          profileData: null
        });
        return;
      }

      // Verificar se o CPF está preenchido E não é apenas espaços em branco
      const hasCpf = (profile as any)?.cpf && (profile as any).cpf.trim().length > 0;
      const hasFirstLoginCompleted = (profile as any)?.first_login_completed === true;
      

      // NOVA LÓGICA: Se tem CPF mas first_login_completed é false, corrigir no banco
      if (hasCpf && !hasFirstLoginCompleted) {
        console.log('� DEBUG useFirstLogin - CPF existe mas first_login_completed é false, corrigindo...');
        try {
          await supabase
            .from('profiles')
            .update({ 
              first_login_completed: true,
              profile_complete: true,
              profile_completion_date: new Date().toISOString()
            } as any)
            .eq('id', user.id as any);
          
          console.log('✅ DEBUG useFirstLogin - Campo first_login_completed corrigido');
          
          // Atualizar o profile local
          (profile as any).first_login_completed = true;
          (profile as any).profile_complete = true;
          (profile as any).profile_completion_date = new Date().toISOString();
        } catch (updateError) {
          console.error('❌ Erro ao corrigir first_login_completed:', updateError);
        }
      }

      // Lógica principal: é primeiro login apenas se não tem CPF
      const isFirstLogin = !hasCpf;
      
      setStatus({
        isFirstLogin,
        isLoading: false,
        error: null,
        profileData: profile
      });
    } catch (error: any) {
      console.error('❌ Erro no checkFirstLoginStatus:', error);
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Erro ao verificar status do primeiro login',
        profileData: null // Garantir que seja null em caso de erro
      }));
    }
  }, [user]);

  // Completar primeiro login
  const completeFirstLogin = async (data: FirstLoginData) => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    try {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('🔄 DEBUG useFirstLogin - Iniciando atualização do perfil para user:', user.id);
      console.log('📋 DEBUG useFirstLogin - Dados recebidos:', {
        cpf: data.cpf,
        full_name: data.full_name,
        phone: data.phone,
        birth_date: data.birth_date,
        address: data.address,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
        hasPhoto: !!data.photoUri
      });

      // Atualizar perfil com todos os campos
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          cpf: data.cpf,
          phone: data.phone,
          birth_date: data.birth_date,
          address: data.address,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_phone: data.emergency_contact_phone,
          avatar_url: data.photoUri,
          first_login_completed: true,
          profile_complete: true,
          profile_completion_date: new Date().toISOString(),
          photo_verification_status: data.photoUri ? 'pending' : null
        } as any)
        .eq('id', user.id as any);

      if (updateError) {
        console.error('❌ Erro ao atualizar perfil:', updateError);
        
        // Tratamento específico para erro de CPF duplicado
        if (updateError.code === '23505' && updateError.message.includes('profiles_cpf_key')) {
          return { 
            success: false, 
            error: 'Este CPF já está cadastrado no sistema. Por favor, verifique se você já possui uma conta ou entre em contato com o administrador.' 
          };
        }
        
        // Outros erros de constraint
        if (updateError.code === '23505') {
          return { 
            success: false, 
            error: 'Dados duplicados encontrados. Verifique se as informações não estão já cadastradas no sistema.' 
          };
        }
        
        // Erros gerais
        return { success: false, error: updateError.message || 'Erro ao atualizar perfil' };
      }

      console.log('✅ Perfil atualizado com sucesso');

      // Atualizar status local
      setStatus(prev => ({
        ...prev,
        isFirstLogin: false,
        isLoading: false,
        profileData: {
          ...prev.profileData,
          ...data,
          first_login_completed: true,
          profile_complete: true,
          profile_completion_date: new Date().toISOString()
        }
      }));

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro no completeFirstLogin:', error);
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Erro ao completar primeiro login'
      }));
      return { success: false, error: error.message || 'Erro ao completar primeiro login' };
    }
  };

  // Verificar status quando usuário muda
  useEffect(() => {
    checkFirstLoginStatus();
  }, [checkFirstLoginStatus]);

  return {
    ...status,
    completeFirstLogin,
    refreshStatus: checkFirstLoginStatus,
    checkFirstLoginStatus
  };
};
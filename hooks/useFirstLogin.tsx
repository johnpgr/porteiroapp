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
      console.log('🔍 DEBUG useFirstLogin - Usuário não encontrado, mantendo loading');
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
      console.log('🔍 DEBUG useFirstLogin - Buscando perfil para usuário:', user.id);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao buscar perfil no useFirstLogin:', error);
        throw error;
      }

      console.log('📊 DEBUG useFirstLogin - Profile encontrado:', profile);
      
      // Se não existe perfil, é definitivamente primeiro login
      // Verificar se o CPF está preenchido E não é apenas espaços em branco
      const hasCpf = profile?.cpf && profile.cpf.trim().length > 0;
      const hasFirstLoginCompleted = profile?.first_login_completed === true;
      const profileExists = !!profile;
      
      const isFirstLogin = !profileExists || !hasFirstLoginCompleted || !hasCpf;
      
      console.log('🔍 DEBUG useFirstLogin - Profile exists:', profileExists);
      console.log('🔍 DEBUG useFirstLogin - Has CPF:', hasCpf, 'CPF value:', profile?.cpf);
      console.log('🔍 DEBUG useFirstLogin - First login completed:', hasFirstLoginCompleted);
      console.log('🔍 DEBUG useFirstLogin - Final isFirstLogin:', isFirstLogin);
      console.log('📋 DEBUG useFirstLogin - Profile data que será retornado:', profile);

      setStatus({
        isFirstLogin,
        isLoading: false,
        error: null,
        profileData: profile || null // Garantir que seja null se não existir
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
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar perfil:', updateError);
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
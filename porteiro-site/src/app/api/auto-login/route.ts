import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { profile_id } = await request.json();

    if (!profile_id) {
      return NextResponse.json(
        { error: 'Profile ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // Buscar o perfil e dados do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, profile_complete')
      .eq('id', profile_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Perfil não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o perfil já foi completado
    if (profile.profile_complete) {
      return NextResponse.json(
        { error: 'Perfil já foi completado. Faça login normalmente.' },
        { status: 400 }
      );
    }

    // Buscar a senha temporária
    const { data: tempPassword, error: tempPasswordError } = await supabase
      .from('temporary_passwords')
      .select('plain_password, used')
      .eq('profile_id', profile_id)
      .eq('used', false)
      .single();

    if (tempPasswordError || !tempPassword) {
      return NextResponse.json(
        { error: 'Senha temporária não encontrada ou já utilizada' },
        { status: 404 }
      );
    }

    // Fazer login automático com as credenciais temporárias
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: tempPassword.plain_password
    });

    if (authError) {
      console.error('Erro no login automático:', authError);
      return NextResponse.json(
        { error: 'Erro ao fazer login automático' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Login automático realizado com sucesso',
      user: authData.user,
      profile: {
        id: profile_id,
        full_name: profile.full_name,
        email: profile.email,
        profile_complete: profile.profile_complete
      }
    });

  } catch (error) {
    console.error('Erro na rota de auto-login:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
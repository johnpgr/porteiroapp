import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      profile_id,
      full_name,
      email,
      cpf,
      birth_date,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      password,
      avatar_url
    } = body;

    // Validar dados obrigatórios
    if (!profile_id || !full_name || !email || !cpf || !birth_date || !address || !emergency_contact_name || !emergency_contact_phone || !password) {
      return NextResponse.json(
        { message: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // Verificar se existe uma temporary_password válida para este profile_id
    const { data: tempPasswordData, error: tempPasswordError } = await supabase
      .from('temporary_passwords')
      .select('profile_id, used, expires_at')
      .eq('profile_id', profile_id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tempPasswordError || !tempPasswordData) {
      console.error('Erro ao verificar temporary_password:', tempPasswordError);
      return NextResponse.json(
        { message: 'Senha temporária não encontrada ou expirada' },
        { status: 404 }
      );
    }

    // Buscar o perfil na tabela profiles usando profile_id
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .single();

    if (profileError || !profileData) {
      console.error('Erro ao buscar perfil:', profileError);
      return NextResponse.json(
        { message: 'Perfil não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar dados do perfil
    const updateData = {
      full_name,
      email,
      cpf: cpf.replace(/\D/g, ''), // Remove formatação do CPF
      birth_date,
      address,
      emergency_contact_name,
      emergency_contact_phone: emergency_contact_phone.replace(/\D/g, ''), // Remove formatação do telefone
      avatar_url,
      profile_complete: true,
      updated_at: new Date().toISOString()
    };

    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', profile_id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError);
      return NextResponse.json(
        { message: 'Erro ao atualizar dados do perfil' },
        { status: 500 }
      );
    }

    // Criar usuário na autenticação do Supabase usando admin client
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: {
        phone: profileData.phone,
        profile_id: profile_id,
        user_type: 'resident'
      },
      email_confirm: true // Confirma o email automaticamente
    });

    if (signUpError) {
      console.error('Erro ao criar usuário:', signUpError);
      return NextResponse.json(
        { error: 'Erro ao criar usuário na autenticação' },
        { status: 500 }
      );
    }

    // Atualizar o profile com o user_id do usuário criado
    if (signUpData.user) {
      const { error: updateUserIdError } = await supabase
        .from('profiles')
        .update({ 
          user_id: signUpData.user.id,
          profile_complete: true,
          temporary_password_used: true
        })
        .eq('id', profile_id);

      if (updateUserIdError) {
        console.error('Erro ao atualizar user_id no profile:', updateUserIdError);
        // Não falhar o processo, apenas logar o erro
      }

      // Marcar a temporary_password como usada
      const { error: markUsedError } = await supabase
        .from('temporary_passwords')
        .update({ 
          used: true,
          used_at: new Date().toISOString()
        })
        .eq('profile_id', profile_id);

      if (markUsedError) {
        console.error('Erro ao marcar temporary_password como usada:', markUsedError);
        // Não falhar o processo, apenas logar o erro
      }
    }

    return NextResponse.json(
      { message: 'Perfil completado com sucesso', user: signUpData.user },
      { status: 200 }
    );

  } catch (error) {
    console.error('Erro interno na API:', error);
    return NextResponse.json(
      { message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
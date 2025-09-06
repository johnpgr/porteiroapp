import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Iniciando complete-morador-profile API');
    
    const body = await request.json();
    console.log('📝 Body recebido:', { ...body, password: '[REDACTED]' });
    
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
      console.error('❌ Dados obrigatórios não fornecidos');
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

    const { error: updateError } = await supabase
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
    console.log('👤 Tentando criar usuário no Supabase Auth para email:', email);
    
    const createUserPayload = {
      email: email,
      password: password,
      user_metadata: {
        phone: profileData.phone,
        profile_id: profile_id,
        user_type: 'resident'
      },
      email_confirm: true // Confirma o email automaticamente
    };
    
    console.log('📤 Payload para createUser:', { ...createUserPayload, password: '[REDACTED]' });
    
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser(createUserPayload);
    
    console.log('📥 Resposta do createUser - data:', signUpData);
    console.log('📥 Resposta do createUser - error:', signUpError);

    if (signUpError) {
      console.error('❌ Erro ao criar usuário:', signUpError);
      console.error('❌ Detalhes do erro:', JSON.stringify(signUpError, null, 2));
      
      // Se o email já existe, tentar buscar o usuário existente
      if (signUpError.message?.includes('email_exists') || signUpError.code === 'email_exists') {
        console.log('Email já existe, tentando buscar usuário existente...');
        
        const { data: existingUsers, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(user => user.email === email);
        
        if (getUserError || !existingUser) {
          console.error('Erro ao buscar usuário existente:', getUserError);
          return NextResponse.json(
            { message: 'Email já cadastrado, mas não foi possível localizar o usuário. Entre em contato com o suporte.' },
            { status: 409 }
          );
        }
        
        // Atualizar o profile com o user_id do usuário existente
        const { error: updateUserIdError } = await supabase
          .from('profiles')
          .update({ 
            user_id: existingUser.id,
            profile_complete: true,
            temporary_password_used: true
          })
          .eq('id', profile_id);

        if (updateUserIdError) {
          console.error('Erro ao atualizar user_id no profile:', updateUserIdError);
          return NextResponse.json(
            { message: 'Erro ao vincular usuário ao perfil' },
            { status: 500 }
          );
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
        }
        
        return NextResponse.json(
          { message: 'Perfil completado com sucesso (usuário já existia)', user: existingUser },
          { status: 200 }
        );
      }
      
      // Para outros tipos de erro
      return NextResponse.json(
        { message: `Erro ao criar usuário: ${signUpError.message || 'Erro desconhecido'}` },
        { status: 500 }
      );
    }

    // Atualizar o profile com o user_id do usuário criado
    if (signUpData.user) {
      console.log('✅ Usuário criado com sucesso! ID:', signUpData.user.id);
      console.log('🔄 Atualizando profile com user_id...');
      
      const { error: updateUserIdError } = await supabase
        .from('profiles')
        .update({ 
          user_id: signUpData.user.id,
          profile_complete: true,
          temporary_password_used: true
        })
        .eq('id', profile_id);

      if (updateUserIdError) {
        console.error('❌ Erro ao atualizar user_id no profile:', updateUserIdError);
        console.error('❌ Detalhes do erro de update:', JSON.stringify(updateUserIdError, null, 2));
        // Não falhar o processo, apenas logar o erro
      } else {
        console.log('✅ Profile atualizado com user_id com sucesso!');
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
    console.error('❌ Erro interno na API:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
    console.error('❌ Detalhes completos do erro:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    return NextResponse.json(
      { 
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      profile_id,
      birth_date,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      password,
      avatar_url
    } = body;

    // Validar dados obrigatórios
    if (!profile_id || !birth_date || !address || !emergency_contact_name || !emergency_contact_phone || !password) {
      return NextResponse.json(
        { message: 'Dados obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    // Verificar se existe uma visitor_temporary_password válida para este visitor_id
    const { data: tempPasswordData, error: tempPasswordError } = await supabase
      .from('visitor_temporary_passwords')
      .select('visitor_id, used, expires_at')
      .eq('visitor_id', profile_id)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tempPasswordError || !tempPasswordData) {
      console.error('Erro ao verificar visitor_temporary_password:', tempPasswordError);
      return NextResponse.json(
        { message: 'Senha temporária de visitante não encontrada ou expirada' },
        { status: 404 }
      );
    }

    // Buscar o perfil de visitante na tabela visitors
    const { data: visitorData, error: visitorError } = await supabase
      .from('visitors')
      .select('*')
      .eq('id', profile_id)
      .single();

    if (visitorError || !visitorData) {
      console.error('Erro ao buscar visitante:', visitorError);
      return NextResponse.json(
        { message: 'Visitante não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar o perfil do visitante com os novos dados
    const { data: updatedProfile, error: updateError } = await supabase
      .from('visitors')
      .update({
        photo_url: avatar_url,
        status: 'aprovado',
        updated_at: new Date().toISOString()
      })
      .eq('id', profile_id)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar perfil do visitante' },
        { status: 500 }
      );
    }

    // Criar usuário na autenticação do Supabase usando admin client
    if (visitorData.email) {
      const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: visitorData.email,
        password: password,
        user_metadata: {
          phone: visitorData.phone,
          visitor_id: profile_id,
          user_type: 'visitor'
        },
        email_confirm: true // Confirma o email automaticamente
      });

      if (signUpError) {
        console.error('Erro ao criar usuário:', signUpError);
        // Não falhar o processo se houver erro na criação do usuário
        // O visitante pode tentar fazer login manualmente depois
      } else {
        // Marcar a visitor_temporary_password como usada
        const { error: markUsedError } = await supabase
          .from('visitor_temporary_passwords')
          .update({ 
            used: true,
            used_at: new Date().toISOString()
          })
          .eq('visitor_id', profile_id);

        if (markUsedError) {
          console.error('Erro ao marcar visitor_temporary_password como usada:', markUsedError);
          // Não falhar o processo, apenas logar o erro
        }
      }
    }

    return NextResponse.json(
      { 
        message: 'Perfil completado com sucesso',
        visitor: updatedProfile
      },
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
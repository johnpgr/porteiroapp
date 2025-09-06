import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Verificar se o token é válido
    const { data: tokenData, error: tokenError } = await supabase
      .from('visitors')
      .select('*')
      .eq('registration_token', profile_id)
      .gt('token_expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado' },
        { status: 400 }
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

    // TODO: Implementar criação de usuário quando o campo email for adicionado à tabela visitors
    // TODO: Implementar marcação de token como usado quando o campo for adicionado à tabela visitors

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
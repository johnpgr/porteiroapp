import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { token, expectedType } = await request.json();

    // Validate input
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // Query the database for the token
    const { data: tokenData, error: queryError } = await supabase
      .from('registration_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_used', false)
      .single();

    if (queryError || !tokenData) {
      return NextResponse.json(
        { error: 'Token não encontrado ou já utilizado' },
        { status: 404 }
      );
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Token expirado' },
        { status: 410 }
      );
    }

    // Check token type if specified
    if (expectedType && tokenData.token_type !== expectedType) {
      return NextResponse.json(
        { 
          error: `Token não é válido para este tipo de cadastro (esperado: ${expectedType}, recebido: ${tokenData.token_type})` 
        },
        { status: 400 }
      );
    }

    // Token is valid
    return NextResponse.json({
      valid: true,
      tokenData: {
        id: tokenData.id,
        token: tokenData.token,
        token_type: tokenData.token_type,
        entity_id: tokenData.entity_id,
        entity_type: tokenData.entity_type,
        expires_at: tokenData.expires_at,
        metadata: tokenData.metadata
      }
    });

  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Método não permitido. Use POST.' },
    { status: 405 }
  );
}
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { 
      entityId, 
      entityType = 'profile', 
      tokenType = 'user_registration',
      expiresInHours = 24,
      metadata = null 
    } = await request.json();

    // Debug logs
    console.log('🔍 [DEBUG] Generate token request received:');
    console.log('🔍 [DEBUG] entityId:', entityId, 'type:', typeof entityId);
    console.log('🔍 [DEBUG] entityType:', entityType);
    console.log('🔍 [DEBUG] tokenType:', tokenType);
    console.log('🔍 [DEBUG] metadata:', metadata);

    // Validate input
    if (!entityId) {
      return NextResponse.json(
        { error: 'Entity ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // Generate unique token
    const token = uuidv4();
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Insert token into database
    const { data: tokenData, error: insertError } = await supabase
      .from('registration_tokens')
      .insert({
        token,
        token_type: tokenType,
        entity_id: entityId,
        entity_type: entityType,
        expires_at: expiresAt.toISOString(),
        is_used: false,
        metadata
      })
      .select()
      .single();

    if (insertError) {
      console.error('Token creation error:', insertError);
      return NextResponse.json(
        { error: 'Erro ao criar token de registro' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token: tokenData.token,
      expires_at: tokenData.expires_at,
      message: 'Token de registro criado com sucesso'
    });

  } catch (error) {
    console.error('Generate registration token error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Método não permitido' },
    { status: 405 }
  );
}
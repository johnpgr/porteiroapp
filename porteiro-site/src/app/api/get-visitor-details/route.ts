import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { token, visitorId }: { token: string; visitorId: string } = await request.json();

    if (!token || !visitorId) {
      return NextResponse.json(
        { error: 'Token e ID do visitante são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // 1. Validate the token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('registration_tokens')
      .select('*')
      .eq('token', token)
      .eq('token_type', 'visit_approval')
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json(
        { error: 'Token inválido ou não encontrado' },
        { status: 404 }
      );
    }

    // Check if token is already used
    if (tokenRecord.is_used) {
      return NextResponse.json(
        { error: 'Este token já foi utilizado' },
        { status: 400 }
      );
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expires_at);
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Token expirado' },
        { status: 400 }
      );
    }

    // 2. Get visitor details
    const { data: visitor, error: visitorError } = await supabase
      .from('visitors')
      .select('*')
      .eq('id', visitorId)
      .eq('status', 'pendente')
      .single();

    if (visitorError || !visitor) {
      return NextResponse.json(
        { error: 'Visitante não encontrado ou já processado' },
        { status: 404 }
      );
    }

    // 3. Verify that the token entity_id matches the visitor id
    if (tokenRecord.entity_id !== visitorId) {
      return NextResponse.json(
        { error: 'Token não corresponde ao visitante' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      visitor: {
        id: visitor.id,
        name: visitor.name,
        document: visitor.document,
        phone: visitor.phone,
        photo_url: visitor.photo_url,
        visit_type: visitor.visit_type,
        visit_date: visitor.visit_date,
        visit_start_time: visitor.visit_start_time,
        visit_end_time: visitor.visit_end_time,
        visitor_type: visitor.visitor_type,
        status: visitor.status,
        created_at: visitor.created_at
      }
    });

  } catch (error) {
    console.error('Get visitor details error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
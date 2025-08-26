import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

type VisitorData = {
  name: string;
  document: string;
  phone: string;
  photo_url?: string | null;
  visit_type: 'pontual' | 'frequente';
  visit_date: string;
  visit_start_time: string;
  visit_end_time: string;
  visitor_type: 'comum' | 'frequente';
  apartment_id: string;
  status: 'pendente';
};

export async function POST(request: NextRequest) {
  try {
    const { token, visitorData }: { token: string; visitorData: VisitorData } = await request.json();

    if (!token || !visitorData) {
      return NextResponse.json(
        { error: 'Token e dados do visitante são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // 1. Validate the token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('registration_tokens')
      .select('*')
      .eq('token', token)
      .eq('token_type', 'visitor_registration')
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

    // 2. Validate visit date is not in the past
    const visitDate = new Date(visitorData.visit_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (visitDate < today) {
      return NextResponse.json(
        { error: 'Data da visita não pode ser no passado' },
        { status: 400 }
      );
    }

    // 3. Create visitor record
    const { data: visitor, error: visitorError } = await supabase
      .from('visitors')
      .insert({
        name: visitorData.name,
        document: visitorData.document,
        phone: visitorData.phone,
        photo_url: visitorData.photo_url,
        visit_type: visitorData.visit_type,
        visit_date: visitorData.visit_date,
        visit_start_time: visitorData.visit_start_time,
        visit_end_time: visitorData.visit_end_time,
        visitor_type: visitorData.visitor_type,
        apartment_id: visitorData.apartment_id,
        status: visitorData.status,
        registration_token: token,
        token_expires_at: tokenRecord.expires_at,
        is_active: true
      })
      .select()
      .single();

    if (visitorError) {
      console.error('Error creating visitor:', visitorError);
      return NextResponse.json(
        { error: 'Erro ao criar registro de visitante' },
        { status: 500 }
      );
    }

    // 4. Mark token as used
    const { error: updateTokenError } = await supabase
      .from('registration_tokens')
      .update({
        is_used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', tokenRecord.id);

    if (updateTokenError) {
      console.error('Error updating token:', updateTokenError);
      // Don't return error here as visitor was created successfully
    }

    // 5. Get apartment and resident info for notification
    const { data: apartment, error: apartmentError } = await supabase
      .from('apartments')
      .select(`
        *,
        profiles!apartments_resident_id_fkey(
          full_name,
          phone
        )
      `)
      .eq('id', visitorData.apartment_id)
      .single();

    if (!apartmentError && apartment) {
      // TODO: Send WhatsApp notification to resident about new visitor registration
      console.log('Visitor registered for apartment:', apartment.number);
      console.log('Resident to notify:', apartment.profiles?.[0]?.full_name);
    }

    return NextResponse.json({
      success: true,
      message: 'Cadastro de visitante realizado com sucesso',
      visitor: {
        id: visitor.id,
        name: visitor.name,
        visit_date: visitor.visit_date,
        status: visitor.status
      }
    });

  } catch (error) {
    console.error('Complete visitor registration error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
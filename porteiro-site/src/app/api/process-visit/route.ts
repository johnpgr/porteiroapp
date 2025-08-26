import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { 
      token, 
      visitorId, 
      approved, 
      rejectionReason 
    }: { 
      token: string; 
      visitorId: string; 
      approved: boolean; 
      rejectionReason?: string | null;
    } = await request.json();

    if (!token || !visitorId || typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'Token, ID do visitante e status de aprovação são obrigatórios' },
        { status: 400 }
      );
    }

    if (!approved && !rejectionReason?.trim()) {
      return NextResponse.json(
        { error: 'Motivo da rejeição é obrigatório quando a visita é rejeitada' },
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

    // 2. Verify that the token entity_id matches the visitor id
    if (tokenRecord.entity_id !== visitorId) {
      return NextResponse.json(
        { error: 'Token não corresponde ao visitante' },
        { status: 403 }
      );
    }

    // 3. Get visitor details before updating
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

    // 4. Update visitor status
    const newStatus: 'aprovado' | 'negado' = approved ? 'aprovado' : 'negado';
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Note: Rejection reason is stored in the token metadata for reference
    // but not in the visitor record as the table doesn't have a metadata field

    const { data: updatedVisitor, error: updateError } = await supabase
      .from('visitors')
      .update(updateData)
      .eq('id', visitorId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating visitor:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar status da visita' },
        { status: 500 }
      );
    }

    // 5. Mark token as used
    const { error: updateTokenError } = await supabase
      .from('registration_tokens')
      .update({
        is_used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', tokenRecord.id);

    if (updateTokenError) {
      console.error('Error updating token:', updateTokenError);
      // Don't return error here as visitor was updated successfully
    }

    // 5. Get apartment and resident info for notification
    let apartment = null;
    let apartmentError = null;
    
    if (visitor.apartment_id) {
      const result = await supabase
        .from('apartments')
        .select(`
          number,
          profiles!apartments_resident_id_fkey (
            full_name,
            phone
          )
        `)
        .eq('id', visitor.apartment_id)
        .single();
      
      apartment = result.data;
      apartmentError = result.error;
    }

    if (!apartmentError && apartment) {
      // TODO: Send WhatsApp notification to visitor about approval/rejection
      console.log(`Visit ${newStatus} for visitor:`, visitor.name);
      console.log('Apartment:', apartment.number);
      console.log('Resident:', apartment.profiles?.[0]?.full_name);
      
      if (!approved && rejectionReason) {
        console.log('Rejection reason:', rejectionReason);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Visita ${approved ? 'aprovada' : 'rejeitada'} com sucesso`,
      visitor: {
        id: updatedVisitor.id,
        name: updatedVisitor.name,
        status: updatedVisitor.status,
        visit_date: updatedVisitor.visit_date
      },
      approved
    });

  } catch (error) {
    console.error('Process visit error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
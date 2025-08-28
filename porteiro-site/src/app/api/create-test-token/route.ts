import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET() {
  try {
    // Forçar recompilação
    // Primeiro, buscar um apartamento válido com informações do prédio
    const { data: apartments, error: apartmentError } = await supabaseAdmin
      .from('apartments')
      .select(`
        id,
        number,
        buildings!inner(
          id,
          name
        )
      `)
      .limit(1)
      .single();

    if (apartmentError || !apartments) {
      console.error('Erro ao buscar apartamento:', apartmentError);
      return NextResponse.json({ 
        error: 'Não foi possível encontrar um apartamento válido',
        details: apartmentError 
      }, { status: 500 });
    }

    // Remover token de teste existente se houver
    await supabaseAdmin
      .from('registration_tokens')
      .delete()
      .eq('token', 'test-visitor-token-123');

    // Criar data de expiração (7 dias no futuro)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Inserir o token de teste
    const { error: tokenError } = await supabaseAdmin
      .from('registration_tokens')
      .insert({
        token: 'test-visitor-token-123',
        token_type: 'visitor_registration',
        entity_type: 'visitor',
        entity_id: apartments.id,
        expires_at: expiresAt.toISOString(),
        is_used: false,
        metadata: {
          apartment_number: apartments.number,
          building_name: Array.isArray(apartments.buildings) ? apartments.buildings[0]?.name || 'Teste' : (apartments.buildings as { name: string })?.name || 'Teste'
        }
      })
      .select()
      .single();

    if (tokenError) {
      console.error('Erro ao criar token:', tokenError);
      return NextResponse.json({ 
        error: 'Erro ao criar token de teste',
        details: tokenError 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Token de teste criado com sucesso!',
      token: 'test-visitor-token-123',
      testUrl: `http://127.0.0.1:3003/cadastro/visitante/test-visitor-token-123`
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error 
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient, supabaseAdmin } from '@/lib/supabase';
import { generateTemporaryPassword, sendWelcomeEmail } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { token, registrationData } = await request.json();

    // Validate input
    if (!token || !registrationData) {
      return NextResponse.json(
        { error: 'Token e dados de cadastro são obrigatórios' },
        { status: 400 }
      );
    }

    // Validate token first
    const supabase = createSupabaseClient();
    const { data: tokenData, error: tokenError } = await supabase
      .from('registration_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_used', false)
      .single();

    if (tokenError || !tokenData) {
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

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: registrationData.email,
      password: registrationData.password,
      email_confirm: true,
      user_metadata: {
        full_name: registrationData.full_name,
        phone: registrationData.phone
      }
    });

    if (authError || !authUser.user) {
      console.error('Auth user creation error:', authError);
      return NextResponse.json(
        { error: 'Erro ao criar usuário: ' + (authError?.message || 'Erro desconhecido') },
        { status: 500 }
      );
    }

    // Create profile record
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.user.id,
        full_name: registrationData.full_name,
        email: registrationData.email,
        phone: registrationData.phone,
        cpf: registrationData.cpf,
        birth_date: registrationData.birth_date,
        address: registrationData.address,
        emergency_contact_name: registrationData.emergency_contact_name,
        emergency_contact_phone: registrationData.emergency_contact_phone,
        building_id: tokenData.entity_id,
        role: 'resident',
        user_type: 'resident',
        registration_token: token
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Try to clean up the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        { error: 'Erro ao criar perfil do usuário' },
        { status: 500 }
      );
    }

    // Mark token as used
    const { error: tokenUpdateError } = await supabase
      .from('registration_tokens')
      .update({
        is_used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', tokenData.id);

    if (tokenUpdateError) {
      console.error('Token update error:', tokenUpdateError);
      // Don't fail the request for this, just log it
    }

    // Send welcome email (async, don't wait for it)
    sendWelcomeEmail(registrationData.email, registrationData.full_name)
      .catch(error => console.error('Welcome email error:', error));

    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso',
      userId: authUser.user.id
    });

  } catch (error) {
    console.error('Registration completion error:', error);
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
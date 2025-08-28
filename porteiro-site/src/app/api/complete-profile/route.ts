import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      profile_id, 
      cpf, 
      birth_date, 
      address, 
      emergency_contact_name, 
      emergency_contact_phone, 
      new_password 
    } = body;

    // Validate required fields
    if (!profile_id || !cpf || !birth_date || !address || !emergency_contact_name || !emergency_contact_phone || !new_password) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // Get profile and user info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, email, profile_complete')
      .eq('id', profile_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Perfil não encontrado' },
        { status: 404 }
      );
    }

    if (profile.profile_complete) {
      return NextResponse.json(
        { error: 'Perfil já foi completado' },
        { status: 400 }
      );
    }

    // Check if CPF already exists (excluding current profile)
    const { data: existingCpf } = await supabase
      .from('profiles')
      .select('id')
      .eq('cpf', cpf)
      .neq('id', profile_id)
      .single();

    if (existingCpf) {
      return NextResponse.json(
        { error: 'CPF já cadastrado no sistema' },
        { status: 400 }
      );
    }

    // Update user password in Auth
    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: new_password }
    );

    if (passwordError) {
      console.error('Erro ao atualizar senha:', passwordError);
      return NextResponse.json(
        { error: 'Erro ao atualizar senha' },
        { status: 500 }
      );
    }

    // Update profile with complete data
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        cpf,
        birth_date,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        profile_complete: true,
        temporary_password_used: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile_id);

    if (updateError) {
      console.error('Erro ao atualizar perfil:', updateError);
      return NextResponse.json(
        { error: 'Erro ao completar perfil' },
        { status: 500 }
      );
    }

    // Mark temporary password as used
    await supabase
      .from('temporary_passwords')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        plain_password: '' // Clear plain password for security
      })
      .eq('profile_id', profile_id)
      .eq('used', false);

    return NextResponse.json({
      success: true,
      message: 'Perfil completado com sucesso! Você já pode fazer login com sua nova senha.'
    });

  } catch (error) {
    console.error('Erro ao completar perfil:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
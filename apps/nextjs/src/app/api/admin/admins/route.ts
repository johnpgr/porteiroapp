import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';


// GET - Listar administradores
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';

    let query = supabase
      .from('admins')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filtro por busca
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Filtro por status
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar administradores:', error);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      admins: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Erro na API de administradores:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar novo administrador
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, permissions, building_id } = body;

    // Validação dos dados
    if (!name || !email || !permissions) {
      return NextResponse.json(
        { error: 'Nome, email e permissões são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o email já existe
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('id')
      .eq('email', email)
      .single();

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Email já está em uso' },
        { status: 409 }
      );
    }

    // Criar novo administrador
    const { data, error } = await supabase
      .from('admins')
      .insert({
        name,
        email,
        permissions,
        building_id,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar administrador:', error);
      return NextResponse.json(
        { error: 'Erro ao criar administrador' },
        { status: 500 }
      );
    }

    // Log da ação
    await supabase.from('audit_logs').insert({
      action: 'admin_created',
      target_type: 'admin',
      target_id: data.id,
      details: { name, email, permissions },
      created_at: new Date().toISOString()
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Erro na criação de administrador:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar administrador
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, email, permissions, status, building_id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do administrador é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se o administrador existe
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id)
      .single();

    if (!existingAdmin) {
      return NextResponse.json(
        { error: 'Administrador não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar administrador
    const { data, error } = await supabase
      .from('admins')
      .update({
        name: name || existingAdmin.name,
        email: email || existingAdmin.email,
        permissions: permissions || existingAdmin.permissions,
        status: status || existingAdmin.status,
        building_id: building_id || existingAdmin.building_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar administrador:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar administrador' },
        { status: 500 }
      );
    }

    // Log da ação
    await supabase.from('audit_logs').insert({
      action: 'admin_updated',
      target_type: 'admin',
      target_id: id,
      details: { changes: { name, email, permissions, status } },
      created_at: new Date().toISOString()
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro na atualização de administrador:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Remover administrador
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID do administrador é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se o administrador existe
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id)
      .single();

    if (!existingAdmin) {
      return NextResponse.json(
        { error: 'Administrador não encontrado' },
        { status: 404 }
      );
    }

    // Remover administrador (soft delete)
    const { error } = await supabase
      .from('admins')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover administrador:', error);
      return NextResponse.json(
        { error: 'Erro ao remover administrador' },
        { status: 500 }
      );
    }

    // Log da ação
    await supabase.from('audit_logs').insert({
      action: 'admin_deleted',
      target_type: 'admin',
      target_id: id,
      details: { admin: existingAdmin },
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ message: 'Administrador removido com sucesso' });
  } catch (error) {
    console.error('Erro na remoção de administrador:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
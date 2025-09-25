import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verify } from 'jsonwebtoken';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware para verificar autenticação de super-admin
async function verifySuperAdmin(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'Token de autenticação necessário', status: 401 };
    }

    const token = authHeader.substring(7);
    const decoded = verify(token, jwtSecret) as any;
    
    // Verificar se é super-admin
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', decoded.id)
      .eq('role', 'super_admin')
      .eq('status', 'active')
      .single();

    if (error || !admin) {
      return { error: 'Acesso negado - Super Admin necessário', status: 403 };
    }

    return { admin };
  } catch (error) {
    return { error: 'Token inválido', status: 401 };
  }
}

// GET - Listar permissões e roles
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifySuperAdmin(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    let response: any = {};

    if (type === 'permissions' || type === 'all') {
      // Buscar todas as permissões
      const { data: permissions, error: permError } = await supabase
        .from('permissions')
        .select('*')
        .order('name');

      if (permError) {
        console.error('Erro ao buscar permissões:', permError);
      } else {
        response.permissions = permissions || [];
      }
    }

    if (type === 'roles' || type === 'all') {
      // Buscar todos os roles
      const { data: roles, error: roleError } = await supabase
        .from('roles')
        .select(`
          *,
          role_permissions(
            permission:permissions(*)
          )
        `)
        .order('hierarchy_level');

      if (roleError) {
        console.error('Erro ao buscar roles:', roleError);
      } else {
        response.roles = roles || [];
      }
    }

    if (type === 'users' || type === 'all') {
      // Buscar usuários com suas permissões
      const { data: users, error: userError } = await supabase
        .from('admins')
        .select(`
          *,
          role:roles(*),
          user_permissions(
            permission:permissions(*)
          )
        `)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (userError) {
        console.error('Erro ao buscar usuários:', userError);
      } else {
        response.users = users || [];
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Erro na API de controle de acesso:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar permissão ou role
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifySuperAdmin(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'permission') {
      const { name, description, resource, action } = data;

      if (!name || !resource || !action) {
        return NextResponse.json(
          { error: 'Nome, recurso e ação são obrigatórios' },
          { status: 400 }
        );
      }

      // Verificar se a permissão já existe
      const { data: existing } = await supabase
        .from('permissions')
        .select('id')
        .eq('name', name)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Permissão já existe' },
          { status: 409 }
        );
      }

      // Criar nova permissão
      const { data: permission, error } = await supabase
        .from('permissions')
        .insert({
          name,
          description,
          resource,
          action,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar permissão:', error);
        return NextResponse.json(
          { error: 'Erro ao criar permissão' },
          { status: 500 }
        );
      }

      // Log da ação
      await supabase.from('audit_logs').insert({
        action: 'permission_created',
        target_type: 'permission',
        target_id: permission.id,
        admin_id: authResult.admin.id,
        details: { name, description, resource, action },
        created_at: new Date().toISOString()
      });

      return NextResponse.json(permission, { status: 201 });
    }

    if (type === 'role') {
      const { name, description, hierarchy_level, permissions } = data;

      if (!name || hierarchy_level === undefined) {
        return NextResponse.json(
          { error: 'Nome e nível hierárquico são obrigatórios' },
          { status: 400 }
        );
      }

      // Verificar se o role já existe
      const { data: existing } = await supabase
        .from('roles')
        .select('id')
        .eq('name', name)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Role já existe' },
          { status: 409 }
        );
      }

      // Criar novo role
      const { data: role, error } = await supabase
        .from('roles')
        .insert({
          name,
          description,
          hierarchy_level,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar role:', error);
        return NextResponse.json(
          { error: 'Erro ao criar role' },
          { status: 500 }
        );
      }

      // Associar permissões ao role
      if (permissions && permissions.length > 0) {
        const rolePermissions = permissions.map((permissionId: string) => ({
          role_id: role.id,
          permission_id: permissionId
        }));

        await supabase
          .from('role_permissions')
          .insert(rolePermissions);
      }

      // Log da ação
      await supabase.from('audit_logs').insert({
        action: 'role_created',
        target_type: 'role',
        target_id: role.id,
        admin_id: authResult.admin.id,
        details: { name, description, hierarchy_level, permissions },
        created_at: new Date().toISOString()
      });

      return NextResponse.json(role, { status: 201 });
    }

    return NextResponse.json(
      { error: 'Tipo inválido' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erro na criação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar permissões de usuário
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifySuperAdmin(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await request.json();
    const { user_id, role_id, permissions, action } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    if (action === 'update_role') {
      // Atualizar role do usuário
      const { error } = await supabase
        .from('admins')
        .update({ role_id })
        .eq('id', user_id);

      if (error) {
        console.error('Erro ao atualizar role:', error);
        return NextResponse.json(
          { error: 'Erro ao atualizar role' },
          { status: 500 }
        );
      }

      // Log da ação
      await supabase.from('audit_logs').insert({
        action: 'user_role_updated',
        target_type: 'admin',
        target_id: user_id,
        admin_id: authResult.admin.id,
        details: { new_role_id: role_id },
        created_at: new Date().toISOString()
      });
    }

    if (action === 'update_permissions') {
      // Remover permissões existentes
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', user_id);

      // Adicionar novas permissões
      if (permissions && permissions.length > 0) {
        const userPermissions = permissions.map((permissionId: string) => ({
          user_id,
          permission_id: permissionId
        }));

        const { error } = await supabase
          .from('user_permissions')
          .insert(userPermissions);

        if (error) {
          console.error('Erro ao atualizar permissões:', error);
          return NextResponse.json(
            { error: 'Erro ao atualizar permissões' },
            { status: 500 }
          );
        }
      }

      // Log da ação
      await supabase.from('audit_logs').insert({
        action: 'user_permissions_updated',
        target_type: 'admin',
        target_id: user_id,
        admin_id: authResult.admin.id,
        details: { permissions },
        created_at: new Date().toISOString()
      });
    }

    return NextResponse.json({ message: 'Permissões atualizadas com sucesso' });
  } catch (error) {
    console.error('Erro na atualização de permissões:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Desativar/ativar usuário
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifySuperAdmin(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action') || 'deactivate';

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    const newStatus = action === 'activate' ? 'active' : 'inactive';

    // Atualizar status do usuário
    const { error } = await supabase
      .from('admins')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Erro ao atualizar status:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar status' },
        { status: 500 }
      );
    }

    // Log da ação
    await supabase.from('audit_logs').insert({
      action: `user_${action}d`,
      target_type: 'admin',
      target_id: userId,
      admin_id: authResult.admin.id,
      details: { new_status: newStatus },
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ 
      message: `Usuário ${action === 'activate' ? 'ativado' : 'desativado'} com sucesso` 
    });
  } catch (error) {
    console.error('Erro na alteração de status:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
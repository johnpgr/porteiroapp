# Plano de Integração - Porteiro Site

## 1. Visão Geral do Projeto

Este documento detalha o plano de integração das funcionalidades do sistema porteiro-site, incluindo cadastro de visitantes/moradores, sistema de administração hierárquico e requisitos técnicos para implementação no Supabase.

## 2. Estrutura de Banco de Dados

### 2.1 Tabelas Necessárias

#### Tabela: temporary_passwords
```sql
CREATE TABLE IF NOT EXISTS temporary_passwords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  plain_password VARCHAR(50) NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('visitante', 'morador')),
  building_id UUID REFERENCES buildings(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_temporary_passwords_phone ON temporary_passwords(phone_number);
CREATE INDEX idx_temporary_passwords_expires ON temporary_passwords(expires_at);
```

#### Tabela: admin_hierarchy
```sql
CREATE TABLE IF NOT EXISTS admin_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'sindico')),
  building_id UUID REFERENCES buildings(id),
  permissions JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_hierarchy_user ON admin_hierarchy(user_id);
CREATE INDEX idx_admin_hierarchy_role ON admin_hierarchy(role);
CREATE INDEX idx_admin_hierarchy_building ON admin_hierarchy(building_id);
```

#### Modificações na tabela profiles
```sql
-- Adicionar campos necessários se não existirem
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) DEFAULT 'pending' CHECK (registration_status IN ('pending', 'completed', 'rejected'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registration_token VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS temp_password_used BOOLEAN DEFAULT FALSE;
```

### 2.2 Políticas RLS (Row Level Security)

```sql
-- Políticas para temporary_passwords
ALTER TABLE temporary_passwords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "temporary_passwords_select_policy" ON temporary_passwords
  FOR SELECT USING (TRUE); -- Permitir leitura para validação

CREATE POLICY "temporary_passwords_insert_policy" ON temporary_passwords
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_hierarchy ah
      JOIN profiles p ON p.id = ah.profile_id
      WHERE p.user_id = auth.uid()
      AND ah.role IN ('super_admin', 'admin', 'sindico')
      AND ah.is_active = TRUE
    )
  );

-- Políticas para admin_hierarchy
ALTER TABLE admin_hierarchy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_hierarchy_select_policy" ON admin_hierarchy
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM admin_hierarchy ah
      JOIN profiles p ON p.id = ah.profile_id
      WHERE p.user_id = auth.uid()
      AND ah.role = 'super_admin'
      AND ah.is_active = TRUE
    )
  );
```

## 3. Implementação do Cadastro

### 3.1 Rota: /cadastro/visitante/completar

#### Estrutura do Componente
```typescript
// src/app/cadastro/visitante/completar/page.tsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface VisitanteFormData {
  full_name: string;
  email: string;
  phone_number: string;
  document_number: string;
  password: string;
  confirmPassword: string;
}

export default function CompletarCadastroVisitante() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [formData, setFormData] = useState<VisitanteFormData>({
    full_name: '',
    email: '',
    phone_number: '',
    document_number: '',
    password: '',
    confirmPassword: ''
  });
  const [tempPassword, setTempPassword] = useState<string>('');
  const [isValidToken, setIsValidToken] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Implementação dos métodos...
}
```

#### Lógica de Validação
```typescript
const validateTempPassword = async (phone: string, plainPassword: string) => {
  const { data, error } = await supabase
    .from('temporary_passwords')
    .select('*')
    .eq('phone_number', phone)
    .eq('plain_password', plainPassword)
    .eq('user_type', 'visitante')
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    throw new Error('Senha temporária inválida ou expirada');
  }

  return data;
};

const completeCadastro = async (formData: VisitanteFormData, tempPasswordId: string) => {
  // 1. Criar usuário no auth.users
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        full_name: formData.full_name,
        phone_number: formData.phone_number,
        user_type: 'visitante'
      }
    }
  });

  if (authError) throw authError;

  // 2. Criar perfil
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: authData.user?.id,
      full_name: formData.full_name,
      email: formData.email,
      phone_number: formData.phone_number,
      document_number: formData.document_number,
      role: 'visitante',
      registration_status: 'completed',
      temp_password_used: true
    });

  if (profileError) throw profileError;

  // 3. Marcar senha temporária como usada
  const { error: updateError } = await supabase
    .from('temporary_passwords')
    .update({ used: true, updated_at: new Date().toISOString() })
    .eq('id', tempPasswordId);

  if (updateError) throw updateError;
};
```

### 3.2 Rota: /cadastro/morador/completar

#### Estrutura Similar com Adaptações
```typescript
// src/app/cadastro/morador/completar/page.tsx
interface MoradorFormData extends VisitanteFormData {
  apartment_number: string;
  building_id: string;
}

const validateMoradorTempPassword = async (phone: string, plainPassword: string) => {
  const { data, error } = await supabase
    .from('temporary_passwords')
    .select('*, buildings(name, address)')
    .eq('phone_number', phone)
    .eq('plain_password', plainPassword)
    .eq('user_type', 'morador')
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();

  return data;
};
```

## 4. Sistema de Administração

### 4.1 Hierarquia de Permissões

#### Níveis de Acesso
1. **Super Admin**: Acesso total ao sistema
2. **Admin**: Gestão de prédios específicos
3. **Síndico**: Gestão limitada do próprio prédio

#### Estrutura de Permissões
```typescript
interface AdminPermissions {
  can_create_buildings: boolean;
  can_manage_users: boolean;
  can_create_temp_passwords: boolean;
  can_view_all_logs: boolean;
  can_manage_admins: boolean;
  buildings_access: string[]; // Array de building_ids
}

const DEFAULT_PERMISSIONS = {
  super_admin: {
    can_create_buildings: true,
    can_manage_users: true,
    can_create_temp_passwords: true,
    can_view_all_logs: true,
    can_manage_admins: true,
    buildings_access: ['*'] // Acesso a todos
  },
  admin: {
    can_create_buildings: false,
    can_manage_users: true,
    can_create_temp_passwords: true,
    can_view_all_logs: false,
    can_manage_admins: false,
    buildings_access: [] // Definido por building_id
  },
  sindico: {
    can_create_buildings: false,
    can_manage_users: false,
    can_create_temp_passwords: true,
    can_view_all_logs: false,
    can_manage_admins: false,
    buildings_access: [] // Apenas seu prédio
  }
};
```

### 4.2 Interface de Gestão de Administradores

#### Componente Principal
```typescript
// src/app/admin/gestao-administradores/page.tsx
import { useState, useEffect } from 'react';
import { AdminHierarchy, CreateAdminForm } from '@/components/admin';

export default function GestaoAdministradores() {
  const [admins, setAdmins] = useState<AdminHierarchy[]>([]);
  const [currentUser, setCurrentUser] = useState<AdminHierarchy | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const canManageAdmins = currentUser?.role === 'super_admin';

  return (
    <div className="admin-management">
      <h1>Gestão de Administradores</h1>
      
      {canManageAdmins && (
        <button onClick={() => setShowCreateForm(true)}>
          Adicionar Administrador
        </button>
      )}

      <AdminList admins={admins} onUpdate={handleUpdateAdmin} />
      
      {showCreateForm && (
        <CreateAdminModal
          onClose={() => setShowCreateForm(false)}
          onSuccess={handleAdminCreated}
        />
      )}
    </div>
  );
}
```

### 4.3 Funções de Segurança

#### Middleware de Autenticação
```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Rotas protegidas para admins
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Verificar se é admin
    const { data: adminData } = await supabase
      .from('admin_hierarchy')
      .select('role, is_active')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .single();

    if (!adminData) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/cadastro/:path*']
};
```

## 5. Implementação Técnica

### 5.1 Estrutura de Arquivos

```
porteiro-site/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── gestao-administradores/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── cadastro/
│   │   │   ├── visitante/
│   │   │   │   └── completar/
│   │   │   │       └── page.tsx
│   │   │   └── morador/
│   │   │       └── completar/
│   │   │           └── page.tsx
│   │   └── unauthorized/
│   │       └── page.tsx
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminList.tsx
│   │   │   ├── CreateAdminModal.tsx
│   │   │   └── PermissionsManager.tsx
│   │   └── forms/
│   │       ├── VisitanteForm.tsx
│   │       └── MoradorForm.tsx
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── permissions.ts
│   │   └── validations.ts
│   └── utils/
│       ├── constants.ts
│       └── helpers.ts
├── supabase/
│   └── migrations/
│       ├── 20250131_create_temporary_passwords.sql
│       ├── 20250131_create_admin_hierarchy.sql
│       └── 20250131_update_profiles_table.sql
└── middleware.ts
```

### 5.2 Validações e Segurança

#### Validação de Dados
```typescript
// src/lib/validations.ts
import { z } from 'zod';

export const visitanteSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone_number: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Telefone inválido'),
  document_number: z.string().min(11, 'Documento inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

export const moradorSchema = visitanteSchema.extend({
  apartment_number: z.string().min(1, 'Número do apartamento é obrigatório'),
  building_id: z.string().uuid('ID do prédio inválido')
});
```

#### Funções de Segurança
```typescript
// src/lib/auth.ts
export const checkAdminPermission = async (userId: string, permission: string) => {
  const { data } = await supabase
    .from('admin_hierarchy')
    .select('role, permissions, building_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!data) return false;

  const permissions = data.permissions as AdminPermissions;
  return permissions[permission as keyof AdminPermissions] === true;
};

export const generateTempPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
```

## 6. Testes e Validação

### 6.1 Testes Unitários

```typescript
// tests/auth.test.ts
import { describe, it, expect } from 'vitest';
import { validateTempPassword, generateTempPassword } from '@/lib/auth';

describe('Autenticação', () => {
  it('deve validar senha temporária corretamente', async () => {
    const result = await validateTempPassword('+5511999999999', 'ABC12345');
    expect(result).toBeDefined();
  });

  it('deve gerar senha temporária com 8 caracteres', () => {
    const password = generateTempPassword();
    expect(password).toHaveLength(8);
    expect(password).toMatch(/^[A-Z0-9]+$/);
  });
});
```

### 6.2 Testes de Integração

```typescript
// tests/integration/cadastro.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Cadastro de Visitantes', () => {
  let supabase: any;

  beforeEach(() => {
    supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  });

  it('deve completar cadastro de visitante com sucesso', async () => {
    // Criar senha temporária
    const tempPassword = await supabase
      .from('temporary_passwords')
      .insert({
        phone_number: '+5511999999999',
        plain_password: 'TEST1234',
        user_type: 'visitante',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    expect(tempPassword.data).toBeDefined();

    // Testar cadastro completo
    // ... implementar teste completo
  });
});
```

## 7. Cronograma de Implementação

### Fase 1: Estrutura Base (Semana 1)
- [ ] Criar migrations do banco de dados
- [ ] Implementar middleware de autenticação
- [ ] Configurar estrutura de arquivos

### Fase 2: Cadastro de Usuários (Semana 2)
- [ ] Implementar rota /cadastro/visitante/completar
- [ ] Implementar rota /cadastro/morador/completar
- [ ] Criar validações e formulários

### Fase 3: Sistema de Administração (Semana 3)
- [ ] Implementar hierarquia de admins
- [ ] Criar interface de gestão
- [ ] Implementar permissões e segurança

### Fase 4: Testes e Validação (Semana 4)
- [ ] Implementar testes unitários
- [ ] Implementar testes de integração
- [ ] Validação completa do sistema

## 8. Considerações de Segurança

### 8.1 Proteções Implementadas
- Autenticação obrigatória em todas as rotas sensíveis
- Validação de permissões em nível de banco de dados (RLS)
- Criptografia de senhas usando bcrypt
- Tokens de sessão com expiração automática
- Validação de entrada em todos os formulários

### 8.2 Monitoramento
- Logs de todas as ações administrativas
- Auditoria de criação/modificação de usuários
- Alertas para tentativas de acesso não autorizado

## 9. Manutenção e Suporte

### 9.1 Limpeza Automática
```sql
-- Função para limpar senhas temporárias expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_temp_passwords()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM temporary_passwords 
  WHERE expires_at < NOW() OR used = TRUE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Agendar limpeza diária
SELECT cron.schedule('cleanup-temp-passwords', '0 2 * * *', 'SELECT cleanup_expired_temp_passwords();');
```

### 9.2 Backup e Recuperação
- Backup automático diário das tabelas críticas
- Procedimentos de recuperação documentados
- Testes regulares de restauração

Este plano fornece uma base sólida para a implementação completa do sistema de cadastro e administração do porteiro-site, garantindo segurança, escalabilidade e manutenibilidade.
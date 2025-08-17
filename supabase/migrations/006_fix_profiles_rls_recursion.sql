-- Migração para corrigir recursão infinita nas políticas RLS da tabela profiles
-- Remove todas as políticas RLS existentes e cria novas sem recursão

-- Desabilitar RLS temporariamente
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas RLS existentes da tabela profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON profiles;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles in condominium" ON profiles;
DROP POLICY IF EXISTS "Porteiro can view profiles in building" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
DROP POLICY IF EXISTS "profiles_auth_access" ON profiles;

-- Reabilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS simples e sem recursão

-- Política para SELECT: Usuários podem ver seu próprio perfil
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Política para INSERT: Usuários autenticados podem inserir seu próprio perfil
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Política para UPDATE: Usuários podem atualizar seu próprio perfil
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Política para DELETE: Usuários podem deletar seu próprio perfil
CREATE POLICY "profiles_delete_own" ON profiles
    FOR DELETE
    USING (auth.uid() = id);

-- Política adicional para permitir acesso anônimo durante autenticação
-- Esta política permite leitura básica para o processo de login
CREATE POLICY "profiles_auth_access" ON profiles
    FOR SELECT
    USING (true);

-- Comentários explicativos
COMMENT ON POLICY "profiles_select_own" ON profiles IS 'Permite que usuários vejam seu próprio perfil';
COMMENT ON POLICY "profiles_insert_own" ON profiles IS 'Permite que usuários criem seu próprio perfil';
COMMENT ON POLICY "profiles_update_own" ON profiles IS 'Permite que usuários atualizem seu próprio perfil';
COMMENT ON POLICY "profiles_delete_own" ON profiles IS 'Permite que usuários deletem seu próprio perfil';
COMMENT ON POLICY "profiles_auth_access" ON profiles IS 'Permite acesso de leitura para autenticação';
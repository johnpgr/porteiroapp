-- Adiciona política RLS para permitir acesso anônimo à tabela temporary_passwords
-- para validação de senhas temporárias durante o processo de cadastro

-- Remove política existente se houver conflito
DROP POLICY IF EXISTS "Anonymous can validate temporary passwords" ON temporary_passwords;

-- Cria nova política para permitir que usuários anônimos leiam senhas temporárias
-- não utilizadas e não expiradas para validação
CREATE POLICY "Anonymous can validate temporary passwords" ON temporary_passwords
    FOR SELECT
    TO anon
    USING (
        used = false AND 
        expires_at > NOW()
    );

-- Garante que as permissões estão corretas para o papel anon
GRANT SELECT ON temporary_passwords TO anon;

-- Comentário explicativo
-- Esta política permite que usuários anônimos vejam apenas senhas temporárias
-- que ainda não foram utilizadas (used = false) e que não expiraram (expires_at > NOW())
-- Isso é necessário para o processo de validação durante o cadastro de moradores
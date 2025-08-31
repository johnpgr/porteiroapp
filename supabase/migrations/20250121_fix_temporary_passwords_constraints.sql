-- Migração para corrigir restrições da tabela temporary_passwords
-- Remove a restrição de chave estrangeira obrigatória e permite profile_id nulo

-- Primeiro, remove a restrição de chave estrangeira existente
ALTER TABLE temporary_passwords 
DROP CONSTRAINT IF EXISTS temporary_passwords_profile_id_fkey;

-- Permite que profile_id seja nulo
ALTER TABLE temporary_passwords 
ALTER COLUMN profile_id DROP NOT NULL;

-- Adiciona uma nova restrição de chave estrangeira opcional
-- Isso permite que profile_id seja nulo, mas quando não for nulo, deve referenciar profiles.id
ALTER TABLE temporary_passwords 
ADD CONSTRAINT temporary_passwords_profile_id_fkey 
FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Adiciona campo status se não existir (para compatibilidade)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'temporary_passwords' 
                   AND column_name = 'status') THEN
        ALTER TABLE temporary_passwords 
        ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Adiciona campo hashed_password se não existir (para compatibilidade)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'temporary_passwords' 
                   AND column_name = 'hashed_password') THEN
        ALTER TABLE temporary_passwords 
        ADD COLUMN hashed_password TEXT;
    END IF;
END $$;

-- Atualiza o comentário da tabela
COMMENT ON TABLE temporary_passwords IS 'Armazena senhas temporárias para visitantes e moradores. O profile_id é opcional para permitir operações independentes.';

-- Atualiza o comentário da coluna profile_id
COMMENT ON COLUMN temporary_passwords.profile_id IS 'Referência opcional ao perfil. Pode ser nulo para visitantes sem perfil registrado.';

-- Adiciona índice para melhor performance em consultas por profile_id
CREATE INDEX IF NOT EXISTS idx_temporary_passwords_profile_id 
ON temporary_passwords(profile_id) WHERE profile_id IS NOT NULL;

-- Adiciona índice para consultas por phone_number
CREATE INDEX IF NOT EXISTS idx_temporary_passwords_phone_number 
ON temporary_passwords(phone_number);

-- Adiciona índice para consultas por status e expires_at
CREATE INDEX IF NOT EXISTS idx_temporary_passwords_status_expires 
ON temporary_passwords(status, expires_at);
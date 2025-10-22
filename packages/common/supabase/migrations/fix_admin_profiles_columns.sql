-- Verificar e corrigir a estrutura da tabela admin_profiles

-- Adicionar coluna full_name se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'admin_profiles' AND column_name = 'full_name') THEN
        ALTER TABLE admin_profiles ADD COLUMN full_name TEXT;
        
        -- Migrar dados da coluna 'name' para 'full_name' se existir
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'admin_profiles' AND column_name = 'name') THEN
            UPDATE admin_profiles SET full_name = name WHERE full_name IS NULL;
        END IF;
    END IF;
END $$;

-- Adicionar coluna admin_type se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'admin_profiles' AND column_name = 'admin_type') THEN
        ALTER TABLE admin_profiles ADD COLUMN admin_type TEXT DEFAULT 'admin';
        
        -- Adicionar constraint para admin_type
        ALTER TABLE admin_profiles ADD CONSTRAINT admin_profiles_admin_type_check 
            CHECK (admin_type IN ('admin', 'super_admin'));
        
        -- Migrar dados da coluna 'is_super_admin' se existir
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'admin_profiles' AND column_name = 'is_super_admin') THEN
            UPDATE admin_profiles 
            SET admin_type = CASE 
                WHEN is_super_admin = true THEN 'super_admin' 
                ELSE 'admin' 
            END;
        END IF;
    END IF;
END $$;

-- Tornar full_name obrigatório se não for
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'admin_profiles' AND column_name = 'full_name' AND is_nullable = 'YES') THEN
        ALTER TABLE admin_profiles ALTER COLUMN full_name SET NOT NULL;
    END IF;
END $$;
-- Adicionar colunas address e birth_date na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS birth_date TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.address IS 'Endereço do usuário (especialmente para porteiros)';
COMMENT ON COLUMN public.profiles.birth_date IS 'Data de nascimento do usuário no formato DD/MM/AAAA';
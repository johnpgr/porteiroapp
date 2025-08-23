-- Criar nova tabela communications com estrutura atualizada
CREATE TABLE IF NOT EXISTS public.communications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    building_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    type text NULL DEFAULT 'notice'::text,
    priority text NULL DEFAULT 'normal'::text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT communications_pkey PRIMARY KEY (id),
    CONSTRAINT communications_building_id_fkey FOREIGN KEY (building_id) REFERENCES buildings (id) ON DELETE CASCADE,
    CONSTRAINT communications_created_by_fkey FOREIGN KEY (created_by) REFERENCES admin_profiles (id)
) TABLESPACE pg_default;

-- Criar índice para building_id
CREATE INDEX IF NOT EXISTS idx_communications_building_id ON public.communications USING btree (building_id) TABLESPACE pg_default;

-- Habilitar Row Level Security
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

-- Conceder permissões básicas
GRANT SELECT ON public.communications TO anon;
GRANT ALL PRIVILEGES ON public.communications TO authenticated;

-- Criar política RLS para permitir que porteiros vejam comunicados do seu prédio
CREATE POLICY "Porteiros podem ver comunicados do seu prédio" ON public.communications
    FOR SELECT
    USING (
        building_id IN (
            SELECT p.building_id 
            FROM profiles p 
            WHERE p.user_id = auth.uid() 
            AND p.user_type = 'porteiro'
        )
    );

-- Criar política RLS para permitir que admins vejam e gerenciem comunicados dos seus prédios
CREATE POLICY "Admins podem gerenciar comunicados dos seus prédios" ON public.communications
    FOR ALL
    USING (
        building_id IN (
            SELECT ba.building_id 
            FROM building_admins ba
            JOIN admin_profiles ap ON ba.admin_profile_id = ap.id
            WHERE ap.user_id = auth.uid()
        )
    );
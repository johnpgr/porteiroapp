-- Corrigir políticas RLS da tabela deliveries
-- O problema é que as políticas estão usando 'profile_type' mas a tabela profiles usa 'user_type'

-- Remover todas as políticas RLS existentes da tabela deliveries
DROP POLICY IF EXISTS "Users can view deliveries in their building" ON public.deliveries;
DROP POLICY IF EXISTS "Porters and admins can insert deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Porters and admins can update deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Admins can delete deliveries in their building" ON public.deliveries;

-- Criar novas políticas RLS usando 'user_type' em vez de 'profile_type'

-- Política para visualizar entregas
CREATE POLICY "Users can view deliveries in their building" ON public.deliveries
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (
            -- Administradores podem ver todas as entregas do seu prédio
            (p.user_type = 'admin' AND p.building_id = deliveries.building_id)
            -- Porteiros podem ver todas as entregas
            OR p.user_type = 'porteiro'
            -- Moradores podem ver entregas do seu apartamento (via apartment_residents)
            OR (p.user_type = 'morador' AND EXISTS (
                SELECT 1 FROM public.apartment_residents ar 
                WHERE ar.profile_id = p.id AND ar.apartment_id = deliveries.apartment_id
            ))
        )
    )
);

-- Política para inserir entregas (porteiros e administradores)
CREATE POLICY "Porters and admins can insert deliveries" ON public.deliveries
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (
            p.user_type = 'porteiro'
            OR (p.user_type = 'admin' AND p.building_id = deliveries.building_id)
        )
    )
);

-- Política para atualizar entregas (porteiros e administradores)
CREATE POLICY "Porters and admins can update deliveries" ON public.deliveries
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (
            p.user_type = 'porteiro'
            OR (p.user_type = 'admin' AND p.building_id = deliveries.building_id)
        )
    )
);

-- Política para deletar entregas (apenas administradores do prédio)
CREATE POLICY "Admins can delete deliveries in their building" ON public.deliveries
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.user_type = 'admin'
        AND p.building_id = deliveries.building_id
    )
);

-- Garantir que as permissões estão corretas
GRANT SELECT, INSERT, UPDATE ON public.deliveries TO authenticated;
GRANT DELETE ON public.deliveries TO authenticated;

-- Comentário para documentação
COMMENT ON TABLE public.deliveries IS 'Tabela para armazenar informações de entregas - políticas RLS corrigidas para usar user_type';
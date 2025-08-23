-- Migração para corrigir políticas RLS e implementar regras de segurança
-- Data: 2024-12-20
-- Objetivo: Resolver erro "new row violates row-level security policy"

-- =====================================================
-- POLÍTICAS DE LEITURA (SELECT)
-- Todos os usuários autenticados podem ler todos os dados
-- =====================================================

-- Tabela: admin_profiles
CREATE POLICY "authenticated_users_can_read_admin_profiles" ON public.admin_profiles
    FOR SELECT TO authenticated
    USING (true);

-- Tabela: apartments
CREATE POLICY "authenticated_users_can_read_apartments" ON public.apartments
    FOR SELECT TO authenticated
    USING (true);

-- Tabela: buildings
CREATE POLICY "authenticated_users_can_read_buildings" ON public.buildings
    FOR SELECT TO authenticated
    USING (true);

-- Tabela: communications
CREATE POLICY "authenticated_users_can_read_communications" ON public.communications
    FOR SELECT TO authenticated
    USING (true);

-- Tabela: deliveries
CREATE POLICY "authenticated_users_can_read_deliveries" ON public.deliveries
    FOR SELECT TO authenticated
    USING (true);

-- Tabela: poll_options
CREATE POLICY "authenticated_users_can_read_poll_options" ON public.poll_options
    FOR SELECT TO authenticated
    USING (true);

-- Tabela: poll_votes
CREATE POLICY "authenticated_users_can_read_poll_votes" ON public.poll_votes
    FOR SELECT TO authenticated
    USING (true);

-- Tabela: polls
CREATE POLICY "authenticated_users_can_read_polls" ON public.polls
    FOR SELECT TO authenticated
    USING (true);

-- Tabela: vehicles
CREATE POLICY "authenticated_users_can_read_vehicles" ON public.vehicles
    FOR SELECT TO authenticated
    USING (true);

-- Tabela: visitor_logs
CREATE POLICY "authenticated_users_can_read_visitor_logs" ON public.visitor_logs
    FOR SELECT TO authenticated
    USING (true);

-- Tabela: visitors
CREATE POLICY "authenticated_users_can_read_visitors" ON public.visitors
    FOR SELECT TO authenticated
    USING (true);

-- =====================================================
-- POLÍTICAS DE ESCRITA (INSERT, UPDATE, DELETE)
-- Apenas administradores e super-admins podem realizar operações de escrita
-- =====================================================

-- Função auxiliar para verificar se o usuário é administrador
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_profiles ap
        WHERE ap.user_id = auth.uid()
        AND ap.is_active = true
        AND ap.role IN ('admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tabela: admin_profiles
CREATE POLICY "admins_can_insert_admin_profiles" ON public.admin_profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_admin_profiles" ON public.admin_profiles
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_admin_profiles" ON public.admin_profiles
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Exceção: Usuários podem atualizar/deletar seus próprios registros de admin_profiles
CREATE POLICY "users_can_update_own_admin_profile" ON public.admin_profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_can_delete_own_admin_profile" ON public.admin_profiles
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Tabela: apartments
CREATE POLICY "admins_can_insert_apartments" ON public.apartments
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_apartments" ON public.apartments
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_apartments" ON public.apartments
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Tabela: buildings
CREATE POLICY "admins_can_insert_buildings" ON public.buildings
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_buildings" ON public.buildings
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_buildings" ON public.buildings
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Tabela: communications
CREATE POLICY "admins_can_insert_communications" ON public.communications
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_communications" ON public.communications
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_communications" ON public.communications
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Tabela: deliveries
CREATE POLICY "admins_can_insert_deliveries" ON public.deliveries
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_deliveries" ON public.deliveries
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_deliveries" ON public.deliveries
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Tabela: poll_options
CREATE POLICY "admins_can_insert_poll_options" ON public.poll_options
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_poll_options" ON public.poll_options
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_poll_options" ON public.poll_options
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Tabela: poll_votes
CREATE POLICY "admins_can_insert_poll_votes" ON public.poll_votes
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_poll_votes" ON public.poll_votes
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_poll_votes" ON public.poll_votes
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Tabela: polls
CREATE POLICY "admins_can_insert_polls" ON public.polls
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_polls" ON public.polls
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_polls" ON public.polls
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Tabela: vehicles
CREATE POLICY "admins_can_insert_vehicles" ON public.vehicles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_vehicles" ON public.vehicles
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_vehicles" ON public.vehicles
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Tabela: visitor_logs
CREATE POLICY "admins_can_insert_visitor_logs" ON public.visitor_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_visitor_logs" ON public.visitor_logs
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_visitor_logs" ON public.visitor_logs
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Tabela: visitors
CREATE POLICY "admins_can_insert_visitors" ON public.visitors
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_visitors" ON public.visitors
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_visitors" ON public.visitors
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- =====================================================
-- POLÍTICAS ESPECIAIS PARA TABELAS SEM RLS
-- Habilitar RLS nas tabelas que não possuem
-- =====================================================

-- Habilitar RLS na tabela building_admins
ALTER TABLE public.building_admins ENABLE ROW LEVEL SECURITY;

-- Políticas para building_admins
CREATE POLICY "authenticated_users_can_read_building_admins" ON public.building_admins
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "admins_can_insert_building_admins" ON public.building_admins
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_building_admins" ON public.building_admins
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_building_admins" ON public.building_admins
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "authenticated_users_can_read_profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "admins_can_insert_profiles" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_profiles" ON public.profiles
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_profiles" ON public.profiles
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- Exceção: Usuários podem atualizar/deletar seus próprios registros de profiles
CREATE POLICY "users_can_update_own_profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_can_delete_own_profile" ON public.profiles
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Habilitar RLS na tabela apartment_residents
ALTER TABLE public.apartment_residents ENABLE ROW LEVEL SECURITY;

-- Políticas para apartment_residents
CREATE POLICY "authenticated_users_can_read_apartment_residents" ON public.apartment_residents
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "admins_can_insert_apartment_residents" ON public.apartment_residents
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_update_apartment_residents" ON public.apartment_residents
    FOR UPDATE TO authenticated
    USING (public.is_admin_user())
    WITH CHECK (public.is_admin_user());

CREATE POLICY "admins_can_delete_apartment_residents" ON public.apartment_residents
    FOR DELETE TO authenticated
    USING (public.is_admin_user());

-- =====================================================
-- CONCESSÃO DE PERMISSÕES PARA ROLES
-- =====================================================

-- Conceder permissões SELECT para o role anon (usuários não autenticados)
GRANT SELECT ON public.admin_profiles TO anon;
GRANT SELECT ON public.apartments TO anon;
GRANT SELECT ON public.apartment_residents TO anon;
GRANT SELECT ON public.buildings TO anon;
GRANT SELECT ON public.building_admins TO anon;
GRANT SELECT ON public.communications TO anon;
GRANT SELECT ON public.deliveries TO anon;
GRANT SELECT ON public.poll_options TO anon;
GRANT SELECT ON public.poll_votes TO anon;
GRANT SELECT ON public.polls TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.vehicles TO anon;
GRANT SELECT ON public.visitor_logs TO anon;
GRANT SELECT ON public.visitors TO anon;

-- Conceder todas as permissões para o role authenticated (usuários autenticados)
GRANT ALL PRIVILEGES ON public.admin_profiles TO authenticated;
GRANT ALL PRIVILEGES ON public.apartments TO authenticated;
GRANT ALL PRIVILEGES ON public.apartment_residents TO authenticated;
GRANT ALL PRIVILEGES ON public.buildings TO authenticated;
GRANT ALL PRIVILEGES ON public.building_admins TO authenticated;
GRANT ALL PRIVILEGES ON public.communications TO authenticated;
GRANT ALL PRIVILEGES ON public.deliveries TO authenticated;
GRANT ALL PRIVILEGES ON public.poll_options TO authenticated;
GRANT ALL PRIVILEGES ON public.poll_votes TO authenticated;
GRANT ALL PRIVILEGES ON public.polls TO authenticated;
GRANT ALL PRIVILEGES ON public.profiles TO authenticated;
GRANT ALL PRIVILEGES ON public.vehicles TO authenticated;
GRANT ALL PRIVILEGES ON public.visitor_logs TO authenticated;
GRANT ALL PRIVILEGES ON public.visitors TO authenticated;

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION public.is_admin_user() IS 'Função auxiliar para verificar se o usuário atual é um administrador ativo';

-- Fim da migração
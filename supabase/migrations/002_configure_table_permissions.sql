-- Configurar permissões para as tabelas principais do sistema
-- Garantir que anon e authenticated tenham acesso adequado

-- Permissões para visitor_temporary_passwords
GRANT SELECT, INSERT, UPDATE ON public.visitor_temporary_passwords TO authenticated;
GRANT SELECT ON public.visitor_temporary_passwords TO anon;

-- Permissões para temporary_passwords  
GRANT SELECT, INSERT, UPDATE ON public.temporary_passwords TO authenticated;
GRANT SELECT ON public.temporary_passwords TO anon;

-- Permissões para profiles
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- Permissões para buildings
GRANT SELECT, INSERT, UPDATE ON public.buildings TO authenticated;
GRANT SELECT ON public.buildings TO anon;

-- Permissões para apartments
GRANT SELECT, INSERT, UPDATE ON public.apartments TO authenticated;
GRANT SELECT ON public.apartments TO anon;

-- Permissões para apartment_residents
GRANT SELECT, INSERT, UPDATE ON public.apartment_residents TO authenticated;
GRANT SELECT ON public.apartment_residents TO anon;

-- Permissões para building_admins
GRANT SELECT, INSERT, UPDATE ON public.building_admins TO authenticated;
GRANT SELECT ON public.building_admins TO anon;

-- Verificar se as permissões foram aplicadas corretamente
-- Esta query pode ser executada manualmente para verificar:
/*
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND grantee IN ('anon', 'authenticated') 
AND table_name IN ('visitor_temporary_passwords', 'temporary_passwords', 'admin_profiles', 'profiles', 'buildings', 'apartments', 'apartment_residents', 'building_admins')
ORDER BY table_name, grantee;
*/
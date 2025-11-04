-- Migration: create app_config feature flag table
create table if not exists app_config (
  feature_key text primary key,
  enabled boolean not null default true,
  metadata jsonb,
  description text,
  updated_at timestamptz default now()
);

insert into app_config (feature_key, enabled, description)
values
  ('use_secure_store', true, 'Use SecureStore for token storage'),
  ('optimistic_auth', true, 'Enable optimistic authentication loading'),
  ('offline_mode', true, 'Enable 24h offline grace period'),
  ('lazy_service_init', true, 'Lazy initialize Agora/push services')
on conflict (feature_key) do update
set
  enabled = excluded.enabled,
  description = excluded.description,
  updated_at = now();

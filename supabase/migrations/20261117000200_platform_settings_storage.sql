-- Shared Nexora Platform Settings storage and atomic audited updates.
-- Staged for review only; this migration has NOT been applied to Supabase.

begin;

create table if not exists public.platform_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint platform_settings_key_check check (setting_key in (
    'branding.platform_name',
    'branding.logo_url',
    'branding.tagline',
    'branding.primary_color',
    'registrations.enabled',
    'maintenance.enabled',
    'maintenance.message',
    'fees.merchant_default_percent',
    'features.creator_monetisation',
    'features.business_accounts',
    'features.social_posting',
    'features.messaging',
    'features.notifications',
    'features.payments'
  ))
);

alter table public.platform_settings enable row level security;
revoke all on table public.platform_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.platform_settings to service_role;

create table if not exists public.platform_settings_history (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  old_value jsonb,
  new_value jsonb not null,
  actor_id uuid not null,
  reason text not null,
  outcome text not null default 'success' check (outcome in ('success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists platform_settings_history_key_created_idx
  on public.platform_settings_history (setting_key, created_at desc);

alter table public.platform_settings_history enable row level security;
revoke all on table public.platform_settings_history from public, anon, authenticated;
grant select on table public.platform_settings_history to service_role;

insert into public.platform_settings (setting_key, setting_value)
values
  ('branding.platform_name', to_jsonb('Nexora'::text)),
  ('branding.logo_url', 'null'::jsonb),
  ('branding.tagline', to_jsonb('Connect. Create. Grow.'::text)),
  ('branding.primary_color', to_jsonb('#6D5DFB'::text)),
  ('registrations.enabled', 'true'::jsonb),
  ('maintenance.enabled', 'false'::jsonb),
  ('maintenance.message', to_jsonb('Nexora is temporarily unavailable while we make improvements. Please check back soon.'::text)),
  ('fees.merchant_default_percent', '3'::jsonb),
  ('features.creator_monetisation', 'true'::jsonb),
  ('features.business_accounts', 'true'::jsonb),
  ('features.social_posting', 'true'::jsonb),
  ('features.messaging', 'true'::jsonb),
  ('features.notifications', 'true'::jsonb),
  ('features.payments', 'true'::jsonb)
on conflict (setting_key) do nothing;

create or replace function public.get_public_platform_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    jsonb_object_agg(setting_key, setting_value),
    '{}'::jsonb
  ) || jsonb_build_object(
    'fees.creator_commission_percent',
    to_jsonb((
      select platform_fee_percent
      from public.creator_monetization_platform_config
      where id = true
      limit 1
    ))
  )
  from public.platform_settings;
$function$;

revoke all on function public.get_public_platform_settings() from public;
grant execute on function public.get_public_platform_settings() to anon, authenticated, service_role;

create or replace function public.admin_update_platform_setting(
  p_actor_id uuid,
  p_setting_key text,
  p_new_value jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  old_value jsonb;
  normalized_reason text := btrim(coalesce(p_reason, ''));
begin
  if not exists (
    select 1
    from private.platform_admins
    where user_id = p_actor_id
      and role = 'super_admin'
  ) then
    raise exception 'Super Admin permission required.' using errcode = '42501';
  end if;

  if normalized_reason = '' or length(normalized_reason) > 1000 then
    raise exception 'A reason of 1 to 1000 characters is required.' using errcode = '22023';
  end if;

  if p_setting_key = 'fees.creator_commission_percent' then
    if jsonb_typeof(p_new_value) <> 'number'
       or (p_new_value #>> '{}')::numeric < 0
       or (p_new_value #>> '{}')::numeric > 100 then
      raise exception 'Percentage must be a number from 0 to 100.' using errcode = '22023';
    end if;
    select to_jsonb(platform_fee_percent) into old_value
    from public.creator_monetization_platform_config where id = true;
    update public.creator_monetization_platform_config
    set platform_fee_percent = (p_new_value #>> '{}')::numeric,
        updated_by = p_actor_id,
        updated_at = now()
    where id = true;
  else
    if not exists (
      select 1 from public.platform_settings
      where setting_key = p_setting_key
    ) then
      raise exception 'Unsupported platform setting.' using errcode = '22023';
    end if;

    if p_setting_key in ('fees.merchant_default_percent') then
      if jsonb_typeof(p_new_value) <> 'number'
         or (p_new_value #>> '{}')::numeric < 0
         or (p_new_value #>> '{}')::numeric > 100 then
        raise exception 'Percentage must be a number from 0 to 100.' using errcode = '22023';
      end if;
    elsif p_setting_key in (
      'registrations.enabled', 'maintenance.enabled',
      'features.creator_monetisation', 'features.business_accounts',
      'features.social_posting', 'features.messaging',
      'features.notifications', 'features.payments'
    ) then
      if jsonb_typeof(p_new_value) <> 'boolean' then
        raise exception 'This setting requires a boolean value.' using errcode = '22023';
      end if;
    elsif p_setting_key = 'branding.logo_url' then
      if jsonb_typeof(p_new_value) not in ('string', 'null') then
        raise exception 'Logo URL must be a string or null.' using errcode = '22023';
      end if;
    elsif p_setting_key = 'branding.primary_color' then
      if jsonb_typeof(p_new_value) <> 'string'
         or (p_new_value #>> '{}') !~ '^#[0-9A-Fa-f]{6}$' then
        raise exception 'Primary colour must be a six-digit hex colour.' using errcode = '22023';
      end if;
    elsif p_setting_key in ('branding.platform_name', 'branding.tagline', 'maintenance.message') then
      if jsonb_typeof(p_new_value) <> 'string'
         or length(btrim(p_new_value #>> '{}')) < 1
         or length(p_new_value #>> '{}') > 500 then
        raise exception 'Text setting must contain 1 to 500 characters.' using errcode = '22023';
      end if;
    end if;

    select setting_value into old_value
    from public.platform_settings
    where setting_key = p_setting_key;

    update public.platform_settings
    set setting_value = p_new_value,
        updated_by = p_actor_id,
        updated_at = now()
    where setting_key = p_setting_key;
  end if;

  insert into public.platform_settings_history
    (setting_key, old_value, new_value, actor_id, reason, outcome)
  values
    (p_setting_key, old_value, p_new_value, p_actor_id, normalized_reason, 'success');

  insert into public.platform_admin_audit_logs
    (actor_id, action, category, target_type, target_id, summary, metadata)
  values
    (p_actor_id, 'update', 'platform_settings', 'platform_setting',
     p_setting_key, 'Updated platform setting: ' || p_setting_key,
     jsonb_build_object(
       'old_value', old_value,
       'new_value', p_new_value,
       'reason', normalized_reason,
       'outcome', 'success'
     ));

  return jsonb_build_object(
    'setting_key', p_setting_key,
    'old_value', old_value,
    'new_value', p_new_value,
    'outcome', 'success'
  );
end;
$function$;

revoke all on function public.admin_update_platform_setting(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_update_platform_setting(uuid, text, jsonb, text) to service_role;

commit;

-- Run after academy_certificate_require_learner_name is applied.
do $$
declare
  v_owner text;
  v_security_definer boolean;
  v_settings text[];
  v_anon_execute boolean;
  v_authenticated_execute boolean;
  v_definition text;
begin
  select r.rolname, p.prosecdef, p.proconfig,
         has_function_privilege('anon', p.oid, 'EXECUTE'),
         has_function_privilege('authenticated', p.oid, 'EXECUTE'),
         pg_get_functiondef(p.oid)
    into v_owner, v_security_definer, v_settings,
         v_anon_execute, v_authenticated_execute, v_definition
  from pg_proc p
  join pg_roles r on r.oid = p.proowner
  where p.oid = 'public.issue_edu_course_certificate(uuid)'::regprocedure;

  if v_owner <> 'postgres' then raise exception 'Unexpected function owner: %', v_owner; end if;
  if not v_security_definer then raise exception 'Issuance RPC must remain SECURITY DEFINER'; end if;
  if not ('search_path=""' = any(v_settings)) then raise exception 'Issuance RPC must keep an empty search_path'; end if;
  if v_anon_execute then raise exception 'Anon must not execute the issuance RPC'; end if;
  if not v_authenticated_execute then raise exception 'Authenticated users must execute the issuance RPC'; end if;
  if position('public.profiles' in v_definition) = 0 then raise exception 'Issuance RPC must read profiles.display_name'; end if;
  if position('raise exception' in lower(v_definition)) = 0 then raise exception 'Issuance RPC must reject missing learner names'; end if;
end;
$$;

begin;

do $$
declare
  developer_user_id uuid;
  moment_dart_user_id uuid;
begin
  select id into developer_user_id
  from auth.users
  where lower(email) = 'jordix2003@gmail.com';

  select id into moment_dart_user_id
  from auth.users
  where lower(email) = 'contact@momentdart.be';

  if developer_user_id is null then
    raise exception 'Le compte développeur jordix2003@gmail.com est introuvable.';
  end if;

  if moment_dart_user_id is null then
    raise exception 'Le compte client contact@momentdart.be est introuvable.';
  end if;

  if exists (
    select 1 from public.platform_admins where user_id = developer_user_id
  ) and exists (
    select 1 from public.platform_admins where user_id = moment_dart_user_id
  ) then
    raise exception 'Les deux comptes ont actuellement le rôle administrateur ; correction manuelle requise.';
  end if;

  update public.platform_admins
  set user_id = developer_user_id,
      granted_at = now(),
      granted_by = developer_user_id
  where user_id = moment_dart_user_id
    and not exists (
      select 1 from public.platform_admins where user_id = developer_user_id
    );

  insert into public.platform_admins (user_id, granted_by)
  select developer_user_id, developer_user_id
  where not exists (
    select 1 from public.platform_admins where user_id = developer_user_id
  );

  if exists (
    select 1 from public.platform_admins where user_id = moment_dart_user_id
  ) then
    raise exception 'Le compte Moment D.Art possède encore le rôle administrateur.';
  end if;
end
$$;

commit;

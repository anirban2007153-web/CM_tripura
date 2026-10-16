-- Applied to the CleanMap TRipura Supabase project as cleanmap_auth_profiles
-- and move_profile_trigger_private.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null default 'citizen' check (role in ('citizen', 'authority')),
  department text,
  jurisdictions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 100)
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 100));
  return new;
end;
$$;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure private.handle_new_auth_user();

-- Keep the project's existing DDL event-trigger helper out of the Data API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;


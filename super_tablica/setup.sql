-- Run once in your Supabase project's SQL Editor (safe to run again).
begin;
create schema if not exists st_private;
revoke all on schema st_private from public, anon, authenticated;

create table if not exists st_private.accounts (
  owner uuid primary key references auth.users(id) on delete cascade,
  trial text not null check (trial ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'),
  paid boolean not null default false
);
create table if not exists st_private.records (
  owner uuid not null references st_private.accounts(owner) on delete cascade,
  kind text not null check(kind in ('months','debts')),
  key text not null,
  rev integer not null check(rev>0),
  data jsonb not null,
  primary key(owner, kind, key)
);
alter table st_private.accounts enable row level security;
alter table st_private.records enable row level security;
revoke all on all tables in schema st_private from public, anon, authenticated;

create or replace function public.st_book(p_month text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  a st_private.accounts%rowtype;
  m jsonb;
  d jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_month is null or p_month !~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$' then raise exception 'BAD_MONTH'; end if;
  insert into st_private.accounts(owner,trial) values(u,p_month) on conflict do nothing;
  select * into strict a from st_private.accounts where owner=u;
  insert into st_private.records(owner,kind,key,rev,data)
    values(u,'months',a.trial,1,'{"entries":[],"goals":[{"name":"Подушка","rate":20}]}') on conflict do nothing;
  select coalesce(jsonb_object_agg(key,jsonb_build_object('rev',rev,'data',data)) filter(where kind='months'),'{}'),
         coalesce(jsonb_object_agg(key,jsonb_build_object('rev',rev,'data',data)) filter(where kind='debts'),'{}')
    into m,d from st_private.records where owner=u;
  return jsonb_build_object('paid',a.paid,'trial',a.trial,'months',m,'debts',d);
end $$;

create or replace function public.st_save(p_kind text,p_key text,p_revision integer,p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  a st_private.accounts%rowtype;
  new_revision integer;
  last_day integer;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into strict a from st_private.accounts where owner=u for update;
  if p_data is null or jsonb_typeof(p_data)<>'object' or p_revision is null or p_revision<0 then raise exception 'BAD_RECORD'; end if;
  if p_kind='months' then
    if p_key is null or p_key !~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$' then raise exception 'BAD_MONTH'; end if;
    if not a.paid and p_key<>a.trial then raise exception 'MONTH_LIMIT'; end if;
    if jsonb_typeof(p_data->'entries') is distinct from 'array' or jsonb_typeof(p_data->'goals') is distinct from 'array' then raise exception 'BAD_RECORD'; end if;
    last_day := extract(day from ((p_key||'-01')::date + interval '1 month - 1 day'));
    if exists(select 1 from jsonb_array_elements(p_data->'entries') e where (e->>'day') is null
        or (e->>'day') !~ '^[1-9][0-9]?$' or (e->>'day')::integer > last_day) then raise exception 'BAD_DAY'; end if;
  elsif p_kind='debts' then
    if p_key is null or p_key !~ '^[0-9a-f-]{36}$' or jsonb_typeof(p_data->'payments') is distinct from 'array'
      then raise exception 'BAD_DEBT'; end if;
  else raise exception 'BAD_KIND'; end if;
  if p_revision=0 then
    insert into st_private.records(owner,kind,key,rev,data) values(u,p_kind,p_key,1,p_data)
      on conflict do nothing returning rev into new_revision;
  else
    update st_private.records set rev=rev+1,data=p_data
      where owner=u and kind=p_kind and key=p_key and rev=p_revision returning rev into new_revision;
  end if;
  if new_revision is null then raise exception 'STALE_VERSION'; end if;
  return jsonb_build_object('rev',new_revision,'data',p_data);
end $$;
revoke all on function public.st_book(text), public.st_save(text,text,integer,jsonb) from public,anon;
grant execute on function public.st_book(text), public.st_save(text,text,integer,jsonb) to authenticated;
commit;

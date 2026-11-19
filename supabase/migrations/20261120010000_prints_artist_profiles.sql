begin;

create table public.prints_artist_profiles (
    artist_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
    artist_name text not null check (char_length(btrim(artist_name)) between 1 and 80),
    city text not null check (char_length(btrim(city)) between 1 and 80),
    whatsapp text not null check (whatsapp ~ '^[+][1-9][0-9]{7,14}$')
);

alter table public.prints_artist_profiles enable row level security;
revoke all on public.prints_artist_profiles from public, anon, authenticated;
grant select, insert, update on public.prints_artist_profiles to authenticated;
grant select on public.prints_artist_profiles to service_role;
create policy prints_profiles_read_own on public.prints_artist_profiles
    for select to authenticated using (artist_id = (select auth.uid()));
create policy prints_profiles_insert_own on public.prints_artist_profiles
    for insert to authenticated with check (artist_id = (select auth.uid()));
create policy prints_profiles_update_own on public.prints_artist_profiles
    for update to authenticated using (artist_id = (select auth.uid()))
    with check (artist_id = (select auth.uid()));

alter table public.prints_artworks
    add column category text check (category in ('abstract', 'figurative', 'still-life', 'landscape')),
    add column orientation text check (orientation in ('portrait', 'landscape', 'square'));

grant select (category, orientation) on public.prints_artworks to anon, authenticated;
grant insert (category, orientation), update (category, orientation)
    on public.prints_artworks to authenticated;

create function public.prints_apply_artist_profile() returns trigger
language plpgsql set search_path = ''
as $$
begin
    select artist_name, city into new.artist_name, new.city
        from public.prints_artist_profiles where artist_id = new.artist_id;
    if not found then
        raise exception 'Save an artist profile first' using errcode = '23514';
    end if;
    return new;
end;
$$;

create trigger prints_apply_artist_profile before insert on public.prints_artworks
    for each row when (new.category is not null)
    execute function public.prints_apply_artist_profile();
revoke execute on function public.prints_apply_artist_profile() from public, anon, authenticated;

create function public.prints_sync_artist_byline() returns trigger
language plpgsql set search_path = ''
as $$
begin
    update public.prints_artworks set artist_name = new.artist_name, city = new.city
        where artist_id = new.artist_id
          and (artist_name, city) is distinct from (new.artist_name, new.city);
    return new;
end;
$$;

create trigger prints_sync_artist_byline after insert or update of artist_name, city
    on public.prints_artist_profiles for each row
    execute function public.prints_sync_artist_byline();
revoke execute on function public.prints_sync_artist_byline() from public, anon, authenticated;

alter policy prints_photos_read_published on storage.objects using (
    bucket_id = 'prints-artworks'
    and exists (
        select 1 from public.prints_artworks as artwork
        where artwork.is_published
          and storage.objects.name in (
              artwork.artist_id::text || '/' || artwork.id::text,
              artwork.artist_id::text || '/' || artwork.id::text || '-interior'
          )
    )
);

create policy prints_interiors_upload_to_own_work on storage.objects
    for insert to authenticated with check (
        bucket_id = 'prints-artworks'
        and exists (
            select 1 from public.prints_artworks as artwork
            where artwork.artist_id = (select auth.uid())
              and storage.objects.name = artwork.artist_id::text || '/' || artwork.id::text || '-interior'
        )
    );

commit;

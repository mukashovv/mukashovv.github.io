begin;

create table public.prints_catalog_artist_assignments (
    product_slug text primary key check (product_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    artist_id uuid not null references public.prints_artist_profiles(artist_id) on delete cascade
);

alter table public.prints_catalog_artist_assignments enable row level security;
revoke all on public.prints_catalog_artist_assignments from public, anon, authenticated;

create function public.prints_public_catalog_artists()
returns table (product_slug text, artist_id uuid, profile_slug text)
language sql stable security definer set search_path = ''
as $$
    select assignment.product_slug, assignment.artist_id, profile.profile_slug
    from public.prints_catalog_artist_assignments as assignment
    join public.prints_artist_profiles as profile using (artist_id);
$$;

revoke all on function public.prints_public_catalog_artists() from public;
grant execute on function public.prints_public_catalog_artists() to anon, authenticated;

commit;

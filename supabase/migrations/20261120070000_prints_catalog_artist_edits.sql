begin;

alter table public.prints_catalog_artist_assignments
    add column title text check (char_length(btrim(title)) between 1 and 120),
    add column work_description text check (char_length(work_description) <= 2000),
    add column category text check (category in ('abstract', 'figurative', 'still-life', 'landscape')),
    add column price_30x40 integer check (price_30x40 between 1 and 100000000),
    add column price_50x70 integer check (price_50x70 between 1 and 100000000),
    add column price_70x100 integer check (price_70x100 between 1 and 100000000),
    add column price_100x140 integer check (price_100x140 between 1 and 100000000);

create policy prints_catalog_artist_reads_own on public.prints_catalog_artist_assignments
    for select to authenticated
    using (artist_id = (select auth.uid()));

create policy prints_catalog_artist_edits_own on public.prints_catalog_artist_assignments
    for update to authenticated
    using (artist_id = (select auth.uid()))
    with check (artist_id = (select auth.uid()));

grant select (product_slug, artist_id) on public.prints_catalog_artist_assignments to authenticated;
grant update (title, work_description, category, price_30x40, price_50x70, price_70x100, price_100x140)
    on public.prints_catalog_artist_assignments to authenticated;

create function public.prints_public_catalog_artists_v2()
returns table (
    product_slug text, artist_id uuid, profile_slug text, title text, work_description text, category text,
    price_30x40 integer, price_50x70 integer, price_70x100 integer, price_100x140 integer
)
language sql stable security definer set search_path = ''
as $$
    select assignment.product_slug, assignment.artist_id, profile.profile_slug,
        assignment.title, assignment.work_description, assignment.category,
        assignment.price_30x40, assignment.price_50x70, assignment.price_70x100, assignment.price_100x140
    from public.prints_catalog_artist_assignments as assignment
    join public.prints_artist_profiles as profile using (artist_id);
$$;

revoke all on function public.prints_public_catalog_artists_v2() from public;
grant execute on function public.prints_public_catalog_artists_v2() to anon, authenticated;

commit;

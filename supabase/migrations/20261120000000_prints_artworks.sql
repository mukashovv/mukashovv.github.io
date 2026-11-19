begin;

create table public.prints_artworks (
    id uuid primary key default gen_random_uuid(),
    artist_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    artist_name text not null check (char_length(btrim(artist_name)) between 1 and 80),
    city text not null check (char_length(btrim(city)) between 1 and 80),
    title text not null check (char_length(btrim(title)) between 1 and 120),
    description text not null default '' check (char_length(description) <= 2000),
    is_published boolean not null default false,
    created_at timestamptz not null default now()
);

create index prints_artworks_gallery_idx on public.prints_artworks (created_at desc, id desc)
    where is_published;
create index prints_artworks_artist_idx on public.prints_artworks (artist_id);

alter table public.prints_artworks enable row level security;
revoke all on public.prints_artworks from public, anon, authenticated;
grant select (id, artist_id, artist_name, city, title, description, is_published, created_at)
    on public.prints_artworks to anon, authenticated;
grant select, update on public.prints_artworks to service_role;
grant insert (id, artist_name, city, title, description),
      update (artist_name, city, title, description, is_published)
    on public.prints_artworks to authenticated;

create policy prints_artworks_read_published on public.prints_artworks
    for select to anon, authenticated using (is_published);
create policy prints_artworks_read_own on public.prints_artworks
    for select to authenticated using (artist_id = (select auth.uid()));
create policy prints_artworks_insert_own on public.prints_artworks
    for insert to authenticated with check (artist_id = (select auth.uid()) and not is_published);
create policy prints_artworks_update_own on public.prints_artworks
    for update to authenticated
    using (artist_id = (select auth.uid()))
    with check (artist_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prints-artworks', 'prints-artworks', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy prints_photos_read_own on storage.objects
    for select to authenticated using (
        bucket_id = 'prints-artworks'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy prints_photos_read_published on storage.objects
    for select to anon, authenticated using (
        bucket_id = 'prints-artworks'
        and exists (
            select 1 from public.prints_artworks as artwork
            where artwork.is_published
              and storage.objects.name = artwork.artist_id::text || '/' || artwork.id::text
        )
    );

create policy prints_photos_upload_to_own_draft on storage.objects
    for insert to authenticated with check (
        bucket_id = 'prints-artworks'
        and exists (
            select 1 from public.prints_artworks as artwork
            where artwork.artist_id = (select auth.uid())
              and not artwork.is_published
              and storage.objects.name = artwork.artist_id::text || '/' || artwork.id::text
        )
    );

commit;

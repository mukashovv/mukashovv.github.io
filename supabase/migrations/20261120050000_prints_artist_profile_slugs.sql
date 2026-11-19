begin;

-- Retire the previous external-link feature if it was deployed.
drop function if exists public.prints_public_artist_link(uuid);
drop trigger if exists prints_limit_artist_link_changes on public.prints_artist_profiles;
drop function if exists public.prints_limit_artist_link_changes();

alter table public.prints_artist_profiles
    add column profile_slug text unique check (
        profile_slug is null or (
            profile_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
            and profile_slug not in (
                '404', 'admin', 'api', 'assets', 'build', 'gallery', 'index', 'kudasebet',
                'login', 'nomadform', 'nomadhouse', 'prints', 'profile', 'register',
                'startrack', 'supabase'
            )
        )
    ),
    add column profile_slug_changed_at timestamptz;

create function public.prints_limit_artist_slug_changes() returns trigger
language plpgsql set search_path = ''
as $$
declare
    changed_now timestamptz := clock_timestamp();
begin
    new.profile_slug := nullif(lower(btrim(new.profile_slug)), '');
    if tg_op = 'INSERT' then
        new.profile_slug_changed_at := case when new.profile_slug is not null then changed_now end;
    elsif new.profile_slug is not distinct from old.profile_slug then
        new.profile_slug_changed_at := old.profile_slug_changed_at;
    elsif old.profile_slug_changed_at > changed_now - interval '336 hours' then
        raise sqlstate 'PT409' using message = 'Profile address can be changed once every 14 days';
    else
        new.profile_slug_changed_at := changed_now;
    end if;
    return new;
end;
$$;

create trigger prints_limit_artist_slug_changes
    before insert or update on public.prints_artist_profiles
    for each row execute function public.prints_limit_artist_slug_changes();
revoke execute on function public.prints_limit_artist_slug_changes() from public, anon, authenticated;

create function public.prints_public_artist_profile(profile_handle text default null, work_id uuid default null)
returns jsonb
language sql stable security definer set search_path = ''
as $$
    select jsonb_build_object(
        'artistId', profile.artist_id,
        'name', profile.artist_name,
        'city', profile.city,
        'slug', profile.profile_slug
    )
    from public.prints_artist_profiles as profile
    where profile.profile_slug is not null
        and (
            (work_id is null and profile.profile_slug = profile_handle)
            or (profile_handle is null and exists (
                select 1 from public.prints_artworks as artwork
                where artwork.id = work_id and artwork.artist_id = profile.artist_id and artwork.is_published
            ))
        );
$$;

revoke all on function public.prints_public_artist_profile(text, uuid) from public;
grant execute on function public.prints_public_artist_profile(text, uuid) to anon, authenticated;

commit;

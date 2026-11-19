import { projectUrl, publishableKey } from "./supabase-config.js";

const artworkFields = "id,artist_id,artist_name,city,title,description,is_published,created_at";
const extendedFields = artworkFields + ",category,orientation";
export const photoPath = (work, interior = false) =>
    `${work.artist_id}/${work.id}${interior ? "-interior" : ""}`;

export function unwrap({ data, error }) {
    if (error) throw error;
    return data;
}

export async function createPrintsClient({ account = false } = {}) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    return createClient(projectUrl, publishableKey, {
        auth: {
            storageKey: account ? "mukashov-prints-session" : "mukashov-prints-public",
            persistSession: account,
            autoRefreshToken: account,
            detectSessionInUrl: account
        }
    });
}

export async function withPhotos(storage, works) {
    if (!works.length) return [];
    const paths = works.flatMap((work) => [photoPath(work), photoPath(work, true)]);
    const images = unwrap(await storage.createSignedUrls(paths, 3600));
    const urls = new Map(images.filter((image) => image.signedUrl)
        .map((image) => [image.path, image.signedUrl]));
    return works.map((work) => ({
        ...work,
        imageUrl: urls.get(photoPath(work)),
        interiorUrl: urls.get(photoPath(work, true))
    }));
}

export async function fetchWorks(client, { owner, signal } = {}) {
    const pageSize = 50;
    const storage = client.storage.from("prints-artworks");
    const results = [];
    let fields = extendedFields;

    for (let offset = 0; ; offset += pageSize) {
        const page = (selection) => {
            const query = client.from("prints_artworks").select(selection)
                .order("created_at", { ascending: false }).order("id", { ascending: false })
                .range(offset, offset + pageSize - 1);
            const filter = owner ? query.eq("artist_id", owner) : query.eq("is_published", true);
            return signal ? filter.abortSignal(signal) : filter;
        };
        let response = await page(fields);
        // The public catalogue can still show older works before the migration is applied.
        if (response.error?.code === "42703" && !owner && offset === 0) {
            fields = artworkFields;
            response = await page(fields);
        }
        const works = unwrap(response);
        results.push(...await withPhotos(storage, works));
        if (works.length < pageSize) return results;
    }
}

export async function loadArtistProducts() {
    const client = await createPrintsClient();
    const works = await fetchWorks(client, { signal: AbortSignal.timeout(8000) });
    return works.filter((work) => work.imageUrl).map((work) => ({
        slug: `artist-${work.id}`,
        artistId: work.artist_id,
        artist: work.artist_name,
        city: work.city,
        title: work.title,
        summary: work.description,
        image: work.imageUrl,
        hoverImage: work.interiorUrl,
        category: work.category,
        orientation: work.orientation,
        createdAt: work.created_at,
        isArtistWork: true,
        interior: (parseInt(work.id.slice(0, 8), 16) % 4) + 1
    }));
}

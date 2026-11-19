import { projectUrl, publishableKey } from "./supabase-config.js";

const artworkFields = "id,artist_id,artist_name,city,title,description,is_published,created_at";
const categoryFields = artworkFields + ",category,orientation";
const offerFields = categoryFields + ",original_price,original_sold,print_price,print_stock";
export const photoPath = (work, interior = false) =>
    `${work.artist_id}/${work.id}${interior ? "-interior" : ""}`;

export function unwrap({ data, error }) {
    if (error) throw error;
    return data;
}

let accountClient;

export function createPrintsClient({ account = false } = {}) {
    if (!account) return openPrintsClient(false);
    accountClient ||= openPrintsClient(true).catch((error) => {
        accountClient = undefined;
        throw error;
    });
    return accountClient;
}

async function openPrintsClient(account) {
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
    let fields = offerFields;

    for (let offset = 0; ; offset += pageSize) {
        const page = (selection) => {
            const query = client.from("prints_artworks").select(selection)
                .order("created_at", { ascending: false }).order("id", { ascending: false })
                .range(offset, offset + pageSize - 1);
            const filter = owner ? query.eq("artist_id", owner) : query.eq("is_published", true);
            return signal ? filter.abortSignal(signal) : filter;
        };
        let response = await page(fields);
        // Keep the public catalogue readable while the migrations are being deployed.
        if (offset === 0 && !owner) {
            for (const fallback of [categoryFields, artworkFields]) {
                if (response.error?.code !== "42703") break;
                fields = fallback;
                response = await page(fields);
            }
        }
        const works = unwrap(response);
        results.push(...await withPhotos(storage, works));
        if (works.length < pageSize) return results;
    }
}

function publicOffers(work) {
    return ["original", "print"].filter((type) => work[`${type}_price`] != null).map((type) => ({
        type,
        price: work[`${type}_price`],
        available: type === "original" ? !work.original_sold : work.print_stock !== 0,
        stock: type === "print" ? work.print_stock : null
    }));
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
        offers: publicOffers(work),
        interior: (parseInt(work.id.slice(0, 8), 16) % 4) + 1
    }));
}

export async function loadPublicArtistProfile(filters) {
    const client = await createPrintsClient();
    return unwrap(await client.rpc("prints_public_artist_profile", filters).abortSignal(AbortSignal.timeout(8000)));
}

export async function loadCatalogArtistAssignments() {
    const client = await createPrintsClient();
    const signal = AbortSignal.timeout(4500);
    let result = await client.rpc("prints_public_catalog_artists_v2").abortSignal(signal);
    if (result.error?.code === "PGRST202" || result.error?.code === "42883") {
        result = await client.rpc("prints_public_catalog_artists").abortSignal(signal);
    }
    return result.error ? [] : result.data || [];
}

export function applyCatalogueAssignment(work, assignment) {
    if (!assignment) return work;
    const priceBySize = Object.fromEntries(Object.entries(work.priceBySize).map(([size, price]) => [
        size, assignment[`price_${size}`] ?? price
    ]));
    return {
        ...work,
        title: assignment.title ?? work.title,
        summary: assignment.work_description ?? work.summary,
        category: assignment.category ?? work.category,
        priceBySize,
        artistId: assignment.artist_id,
        artistProfileSlug: assignment.profile_slug,
        canEditCatalogue: Object.hasOwn(assignment, "title")
    };
}

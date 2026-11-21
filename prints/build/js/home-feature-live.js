import { createPrintsClient } from "./artist-data.js";
import { renderFeature } from "./home-feature.js";

const section = document.querySelector("[data-gallery-feature]");
if (section && !location.search) {
    try {
        const client = await createPrintsClient();
        const { data } = await client.from("prints_home_features").select("layout,copy").eq("active", true).maybeSingle();
        if (data) renderFeature(section, data.layout, data.copy, document.documentElement.lang);
    } catch {
        // The static collection stays available while the settings service is offline.
    }
}

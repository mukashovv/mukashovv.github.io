window.printsShared = {
    catalogLabel: "Launch selection / prints",
    launchNote: "The launch catalogue uses temporary images from The Poster Club. They will be replaced with your artworks.",
    defaultSizeId: "50x70",
    defaultFrameId: "oak-slim",
    priceFilter: {
        min: 20,
        max: 800,
        step: 5,
        rate: 95
    },
    sortTabs: [
        { id: "all", label: "All Prints" },
        { id: "new", label: "New Arrivals" },
        { id: "popular", label: "Most Popular" },
        { id: "large", label: "Large Scale" }
    ],
    priceRanges: [
        { id: "all", label: "All Prices" },
        { id: "under-20000", label: "Under 20 000" },
        { id: "20000-30000", label: "20 000 - 30 000" },
        { id: "30000-plus", label: "30 000+" }
    ],
    orientations: [
        { id: "all", label: "All Orientations" },
        { id: "portrait", label: "Portrait" },
        { id: "landscape", label: "Landscape" },
        { id: "square", label: "Square" }
    ],
    colours: [
        { id: "all", label: "All Colours" },
        { id: "warm", label: "Warm" },
        { id: "neutral", label: "Neutral" },
        { id: "earth", label: "Earth" },
        { id: "contrast", label: "Contrast" }
    ],
    collections: [
        { id: "all", label: "All Collections" },
        { id: "studio-selection", label: "Studio Selection" },
        { id: "colour-studies", label: "Colour Studies" },
        { id: "figurative-moments", label: "Figurative Moments" },
        { id: "nordic-quiet", label: "Nordic Quiet" }
    ],
    categories: [
        { id: "all", label: "All Categories" },
        { id: "abstract", label: "Abstract" },
        { id: "figurative", label: "Figurative" },
        { id: "still-life", label: "Still Life" },
        { id: "landscape", label: "Landscape" }
    ],
    sizes: [
        {
            id: "30x40",
            label: "30 x 40 cm",
            shortLabel: "30 x 40",
            note: "for shelves, alcoves and narrow walls"
        },
        {
            id: "50x70",
            label: "50 x 70 cm",
            shortLabel: "50 x 70",
            note: "a versatile size for the home"
        },
        {
            id: "70x100",
            label: "70 x 100 cm",
            shortLabel: "70 x 100",
            note: "a striking focal point for a room"
        },
        {
            id: "100x140",
            label: "100 x 140 cm",
            shortLabel: "100 x 140",
            note: "a large format for wide walls"
        }
    ],
    frames: [
        {
            id: "oak-slim",
            label: "Slim oak",
            description: "light natural wood frame",
            surcharge: 0,
            swatch: "#b88f63",
            accent: "#d3ab84"
        },
        {
            id: "walnut-deep",
            label: "Deep walnut",
            description: "warm, contrasting frame",
            surcharge: 1200,
            swatch: "#704934",
            accent: "#8b5e42"
        },
        {
            id: "graphite",
            label: "Graphite",
            description: "subtle dark frame",
            surcharge: 1500,
            swatch: "#34373c",
            accent: "#4b5057"
        },
        {
            id: "terracotta",
            label: "Terracotta",
            description: "bold coloured frame",
            surcharge: 1800,
            swatch: "#b96247",
            accent: "#cf7558"
        }
    ],
    included: [
        "Archival-quality printing on heavyweight matte paper.",
        "Made to order in your choice of frame.",
        "Hanging hardware and protective packaging for delivery."
    ],
    framingNotes: [
        "Choose a size and frame to suit the artwork.",
        "Production usually takes 5 to 10 days, depending on the size.",
        "Delivery estimates will be available when online payment launches."
    ],
    contactLink: "https://t.me/share/url"
};

window.printsCatalog = [
    {
        slug: "last-sunlight-in-ala-archa",
        title: "Last Sunlight in Ala-Archa",
        artist: "Janybek Mukash",
        series: "JanybekOgraphY Fine Arts",
        image: "../build/img/last-sunlight-in-ala-archa.webp",
        hoverImage: "../build/img/last-sunlight-in-ala-archa-in-action.webp",
        detailImage: "../build/img/silence-of-the-kyrgyz-mountains-in-stone-and-light.webp",
        galleryImages: [
            "../build/img/last-sunlight-in-ala-archa.webp",
            "../build/img/last-sunlight-in-ala-archa-in-action.webp",
            "../build/img/silence-of-the-kyrgyz-mountains-in-stone-and-light.webp"
        ],
        referenceUrl: "https://t.me/share/url",
        summary: "",
        intro: [],
        category: "abstract",
        orientation: "portrait",
        colour: "warm",
        collection: "studio-selection",
        releaseRank: 8,
        popularityRank: 92,
        isLargeScale: true,
        priceBySize: {
            "30x40": 11900,
            "50x70": 16900,
            "70x100": 24900,
            "100x140": 35900
        },
        leadTime: "5-8 days"
    },
    {
        slug: "hidden-heart-of-teskey-ala-too",
        title: "Hidden Heart of Teskey Ala-Too",
        artist: "Janybek Mukash",
        series: "JanybekOgraphY Fine Arts",
        image: "../build/img/hidden-heart-of-teskey-ala-too.webp",
        hoverImage: "../build/img/hidden-heart-of-teskey-ala-too-interior.webp",
        detailImage: "../build/img/hidden-heart-of-teskey-ala-too-interior.webp",
        galleryImages: [
            "../build/img/hidden-heart-of-teskey-ala-too.webp",
            "../build/img/hidden-heart-of-teskey-ala-too-interior.webp"
        ],
        referenceUrl: "https://t.me/share/url",
        summary: "",
        intro: [],
        category: "landscape",
        orientation: "portrait",
        colour: "earth",
        collection: "studio-selection",
        releaseRank: 7,
        popularityRank: 89,
        isLargeScale: true,
        priceBySize: {
            "30x40": 11900,
            "50x70": 16900,
            "70x100": 24900,
            "100x140": 35900
        },
        leadTime: "5-8 days"
    },
    {
        slug: "archabek",
        title: "Good Morning",
        artist: "Arch",
        series: "Arch",
        image: "../build/img/archabek.webp",
        hoverImage: "../build/img/archabek-interior.webp",
        detailImage: "../build/img/archabek-interior.webp",
        galleryImages: [
            "../build/img/archabek.webp",
            "../build/img/archabek-interior.webp"
        ],
        referenceUrl: "https://t.me/share/url",
        summary: "",
        intro: [],
        category: "landscape",
        orientation: "portrait",
        colour: "neutral",
        collection: "studio-selection",
        releaseRank: 6.8,
        popularityRank: 86,
        isLargeScale: true,
        priceBySize: {
            "30x40": 11900,
            "50x70": 16900,
            "70x100": 24900,
            "100x140": 35900
        },
        leadTime: "5-8 days"
    },
    {
        slug: "arch-2",
        title: "Night Time",
        artist: "Arch",
        series: "Arch",
        image: "../build/img/night-time.webp",
        hoverImage: "../build/img/arch-2-interior.webp",
        detailImage: "../build/img/arch-2-interior.webp",
        galleryImages: [
            "../build/img/night-time.webp",
            "../build/img/arch-2-interior.webp"
        ],
        referenceUrl: "https://t.me/share/url",
        summary: "",
        intro: [],
        category: "landscape",
        orientation: "portrait",
        colour: "earth",
        collection: "studio-selection",
        releaseRank: 6.9,
        popularityRank: 87,
        isLargeScale: true,
        priceBySize: {
            "30x40": 11900,
            "50x70": 16900,
            "70x100": 24900,
            "100x140": 35900
        },
        leadTime: "5-8 days"
    },
    {
        slug: "airplane-stump",
        title: "Airplane Stump",
        artist: "Toetiee",
        image: "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17356-7_Toetiee_Airplane_Stump_Oak_Frame-800x1120.jpg",
        hoverImage: "https://theposterclub.com/wp-content/uploads/2026/03/Toetiee_Airplane_Stump_Canvas_Lifestyle_Low_Res-800x1100.jpg",
        detailImage: "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17356-7_Toetiee_Airplane_Stump_Product_Low_Res-800x1100.jpg",
        galleryImages: [
            "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17356-7_Toetiee_Airplane_Stump_Oak_Frame-800x1120.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/Toetiee_Airplane_Stump_Canvas_Lifestyle_Low_Res-800x1100.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17356-7_Toetiee_Airplane_Stump_Product_Low_Res-800x1100.jpg"
        ],
        referenceUrl: "https://theposterclub.com/product/toetiee-airplane-stump-canvas/",
        summary: "A graphic composition with a sense of movement and crisp shapes.",
        intro: [
            "Airplane Stump has a clean, dynamic look that suits modern interiors with simple lines.",
            "Its balance of energy and restraint suits workspaces, halls and rooms with strong architectural features."
        ],
        category: "abstract",
        orientation: "landscape",
        colour: "neutral",
        collection: "studio-selection",
        releaseRank: 7,
        popularityRank: 88,
        isLargeScale: false,
        priceBySize: {
            "30x40": 12100,
            "50x70": 17100,
            "70x100": 25200,
            "100x140": 36200
        },
        leadTime: "5-8 days"
    },
    {
        slug: "cat-cat",
        title: "Cat Cat",
        artist: "Rut Pedreno Criado",
        image: "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17599-07_Rut_Pedreno_Criado_Cat_Cat_Oak_Frame-800x1120.jpg",
        hoverImage: "https://theposterclub.com/wp-content/uploads/2026/03/Rut_Pedreno_Criado_Cat_Cat_Canvas_Lifestyle_Low_Res-800x1100.jpg",
        detailImage: "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17599-07_Rut_Pedreno_Criado_Cat_Cat_Product_Low_Res-800x1100.jpg",
        galleryImages: [
            "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17599-07_Rut_Pedreno_Criado_Cat_Cat_Oak_Frame-800x1120.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/Rut_Pedreno_Criado_Cat_Cat_Canvas_Lifestyle_Low_Res-800x1100.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17599-07_Rut_Pedreno_Criado_Cat_Cat_Product_Low_Res-800x1100.jpg"
        ],
        referenceUrl: "https://theposterclub.com/product/rut-pedreno-criado-cat-cat-canvas/",
        summary: "A playful figurative work with an easy, familiar feel.",
        intro: [
            "Cat Cat brings warmth and personality to kitchens, children’s rooms and informal living spaces.",
            "A light frame keeps the look airy, while graphite gives it a more defined edge."
        ],
        category: "figurative",
        orientation: "landscape",
        colour: "neutral",
        collection: "figurative-moments",
        releaseRank: 6,
        popularityRank: 84,
        isLargeScale: false,
        priceBySize: {
            "30x40": 12400,
            "50x70": 17600,
            "70x100": 25800,
            "100x140": 36900
        },
        leadTime: "6-9 days"
    },
    {
        slug: "the-vase",
        title: "The Vase",
        artist: "Rut Pedreno Criado",
        image: "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17597-07_Rut_Pedreno_Criado_The_Vase_Oak_Frame-800x1120.jpg",
        hoverImage: "https://theposterclub.com/wp-content/uploads/2026/03/Rut_Pedreno_Criado_The_Vase_Canvas_Lifestyle_Low_Res-800x1100.jpg",
        detailImage: "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17597-07_Rut_Pedreno_Criado_The_Vase_Product_Low_Res-800x1100.jpg",
        galleryImages: [
            "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17597-07_Rut_Pedreno_Criado_The_Vase_Oak_Frame-800x1120.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/Rut_Pedreno_Criado_The_Vase_Canvas_Lifestyle_Low_Res-800x1100.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17597-07_Rut_Pedreno_Criado_The_Vase_Product_Low_Res-800x1100.jpg"
        ],
        referenceUrl: "https://theposterclub.com/product/rut-pedreno-criado-the-vase-canvas/",
        summary: "A quiet still life with a gentle vertical composition.",
        intro: [
            "The Vase works well on its own above a console, chest of drawers or dining area.",
            "Choose walnut or terracotta to emphasise the subject and give it a gallery feel."
        ],
        category: "still-life",
        orientation: "portrait",
        colour: "earth",
        collection: "figurative-moments",
        releaseRank: 5,
        popularityRank: 79,
        isLargeScale: false,
        priceBySize: {
            "30x40": 12200,
            "50x70": 17300,
            "70x100": 25500,
            "100x140": 36600
        },
        leadTime: "6-9 days"
    },
    {
        slug: "colour-trio",
        title: "Colour Trio",
        artist: "Teklan",
        image: "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17283-7_Teklan_Color_Trio_Oak_Frame-800x1120.jpg",
        hoverImage: "https://theposterclub.com/wp-content/uploads/2026/03/Teklan_Colour_Trio_Canvas_Lifestyle_Low_Res-800x1100.jpg",
        detailImage: "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17283-7_Teklan_Color_Trio_Product_Low_Res-800x1100.jpg",
        galleryImages: [
            "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17283-7_Teklan_Color_Trio_Oak_Frame-800x1120.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/Teklan_Colour_Trio_Canvas_Lifestyle_Low_Res-800x1100.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17283-7_Teklan_Color_Trio_Product_Low_Res-800x1100.jpg"
        ],
        referenceUrl: "https://theposterclub.com/product/teklan-colour-trio-canvas/",
        summary: "A minimalist composition built from large blocks of colour.",
        intro: [
            "Colour Trio has a strong presence even at smaller sizes and fits rooms with bold furnishings.",
            "Oak gives the work a quieter look, while graphite and terracotta make a bolder statement."
        ],
        category: "abstract",
        orientation: "square",
        colour: "warm",
        collection: "colour-studies",
        releaseRank: 4,
        popularityRank: 95,
        isLargeScale: true,
        priceBySize: {
            "30x40": 12600,
            "50x70": 17900,
            "70x100": 26200,
            "100x140": 37400
        },
        leadTime: "5-10 days"
    },
    {
        slug: "between-columns",
        title: "Between Columns",
        artist: "Teklan",
        image: "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17281-7_Teklan_Between_Columns_Oak_Frame-800x1120.jpg",
        hoverImage: "https://theposterclub.com/wp-content/uploads/2026/03/Teklan_Between_Columns_Canvas_Lifestyle_Low_Res-800x1100.jpg",
        detailImage: "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17281-7_Teklan_Between_Columns_Product_Low_Res-800x1100.jpg",
        galleryImages: [
            "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17281-7_Teklan_Between_Columns_Oak_Frame-800x1120.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/Teklan_Between_Columns_Canvas_Lifestyle_Low_Res-800x1100.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17281-7_Teklan_Between_Columns_Product_Low_Res-800x1100.jpg"
        ],
        referenceUrl: "https://theposterclub.com/product/teklan-between-columns-canvas/",
        summary: "An architectural rhythm and vertical composition for pared-back interiors.",
        intro: [
            "Between Columns works especially well in interiors with strong proportions, vertical lines and clear light.",
            "It adds a crisp graphic accent to an office, stairwell or reception area."
        ],
        category: "abstract",
        orientation: "portrait",
        colour: "contrast",
        collection: "colour-studies",
        releaseRank: 3,
        popularityRank: 90,
        isLargeScale: true,
        priceBySize: {
            "30x40": 12700,
            "50x70": 18100,
            "70x100": 26500,
            "100x140": 37800
        },
        leadTime: "5-10 days"
    },
    {
        slug: "tatuagem",
        title: "Tatuagem",
        artist: "Antonia Figueiredo",
        image: "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17602-07_Antonia_Figueiredo_Tatuagem_Frame_Oak_Low_Res-800x1120.jpg",
        hoverImage: "https://theposterclub.com/wp-content/uploads/2026/03/Antonia_Figueiredo_Tatuagem_Canvas_Lifestyle_Low_Res-800x1100.jpg",
        detailImage: "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17602-07_Antonia_Figueiredo_Tatuagem_Product_Low_Res-800x1100.jpg",
        galleryImages: [
            "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17602-07_Antonia_Figueiredo_Tatuagem_Frame_Oak_Low_Res-800x1120.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/Antonia_Figueiredo_Tatuagem_Canvas_Lifestyle_Low_Res-800x1100.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17602-07_Antonia_Figueiredo_Tatuagem_Product_Low_Res-800x1100.jpg"
        ],
        referenceUrl: "https://theposterclub.com/product/canvas-antonia-figueiredo-tatuagem/",
        summary: "A restrained composition with soft lines and warm, flowing forms.",
        intro: [
            "Tatuagem brings an intimate feel to a bedroom, dressing room or small sitting area.",
            "Walnut brings out the depth and warmth of the forms. Oak gives a lighter finish."
        ],
        category: "figurative",
        orientation: "portrait",
        colour: "earth",
        collection: "figurative-moments",
        releaseRank: 2,
        popularityRank: 86,
        isLargeScale: false,
        priceBySize: {
            "30x40": 12900,
            "50x70": 18400,
            "70x100": 26900,
            "100x140": 38300
        },
        leadTime: "6-10 days"
    },
    {
        slug: "cuillin-ridge-vii",
        title: "Cuillin Ridge VII",
        artist: "Mandy Maria",
        image: "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17004-7_Mandy_Maria_Cuillin_Ridge_VII_Frame_Oak_Low_Res-800x1120.jpg",
        hoverImage: "https://theposterclub.com/wp-content/uploads/2026/03/Mandy_Maria_01-800x1100.jpg",
        detailImage: "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17004-7_Mandy_Maria_Cuillin_Ridge_VII_Product_Low_Res-800x1100.jpg",
        galleryImages: [
            "https://cdn.theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17004-7_Mandy_Maria_Cuillin_Ridge_VII_Frame_Oak_Low_Res-800x1120.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/Mandy_Maria_01-800x1100.jpg",
            "https://theposterclub.com/wp-content/uploads/2026/03/CA-CPR-17004-7_Mandy_Maria_Cuillin_Ridge_VII_Product_Low_Res-800x1100.jpg"
        ],
        referenceUrl: "https://theposterclub.com/product/canvas-mandy-maria-cuillin-ridge-vii/",
        summary: "An abstract landscape with a sense of distance and cool air.",
        intro: [
            "Cuillin Ridge VII anchors a wide wall. At larger sizes, it opens up a sense of space.",
            "It brings atmosphere to a living room, meeting room or quiet public interior."
        ],
        category: "landscape",
        orientation: "portrait",
        colour: "neutral",
        collection: "nordic-quiet",
        releaseRank: 1,
        popularityRank: 82,
        isLargeScale: true,
        priceBySize: {
            "30x40": 13200,
            "50x70": 18800,
            "70x100": 27400,
            "100x140": 38900
        },
        leadTime: "6-10 days"
    }
];

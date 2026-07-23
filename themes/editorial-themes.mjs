export const PAIRING_ARTICLE_CREDIT = Object.freeze({
  title: "8 expressive free font combos for your next design",
  url: "https://dribbble.com/stories/2020/06/10/free-font-combinations",
  writer: "Renee Fleck",
  curator: "Davide Baratta"
});
const GOOGLE_FONTS_REF = "00e726a90e0b9698971c37b88c35ef958965448b";

const maziusLibreImagePromptTemplate = `[SUBJECT], shown as a grounded but enigmatic observational editorial scene in an ordinary real-world setting.

[COLOR PALETTE]

Original photorealistic editorial photography with lightly art-directed but physically plausible staging and a moody, quietly cinematic emotional register. Use early-1990s color-film character, dense organic grain, slightly underexposed graphite blacks, restrained highlights, low-angle hard daylight, and long crisp sculptural shadows. Preserve honest skin, fabric, paper, metal, earth, and architectural texture beneath the intentional color grade. Favor uncluttered real locations whose existing surfaces create broad geometric color fields and simple silhouettes. Frame off-center or through an architectural edge when appropriate, hold generous negative space, and let stillness, shadow, crop, and color tension make the ordinary scene feel private, self-possessed, and slightly mysterious.

Use the page, steel, and cover-band roles for the dominant environment and deep shadow masses; ink and heading sparingly for sharp light and highlights; and accent or meta as the only vivid chroma, isolated as one small charged color event. Keep recognizable skin and natural materials plausible but gently harmonized with the authoritative palette. Protect mood by avoiding even exposure, cheerful commercial brightness, generic productivity imagery, lifestyle-ad polish, or evenly distributed color. Avoid overfitting to style references: create an original subject, setting, and composition rather than reusing a recognizable scene, prop arrangement, person, or landmark.

Depict real people, familiar objects, plausible architecture, ordinary activities, and normal scale. The scene must make literal physical sense before styling is applied; its mystery must come only from photographic choices, never from an impossible subject. Bitmap only. No visual metaphors, symbolic paths, portals, impossible light sources, transformed or anthropomorphic objects, oversized props, surreal architecture, fantasy landscapes, dream haze, typography, captions, logos, watermarks, color swatches, borders, collage, glossy CGI, excessive bloom, busy scenery, fashion-campaign posing, or sentimental stock-photo symbolism.

[COVER ART CONSTRAINTS]`;

const reginaPoppinsImagePromptTemplate = `[SUBJECT], reduced to a clear observed everyday scene with playful momentum and warm assurance.

[COLOR PALETTE]

Original grainy airbrushed editorial illustration with a mid-century poster sensibility: simplified rounded silhouettes, broad overlapping color fields, soft sprayed tonal transitions inside otherwise flat shapes, dense tactile print grain across the whole image, and a hint of paper tooth. Use a plausible hard light source to cast one strong natural directional shadow that supports the composition. Keep the image sophisticated, graphic, and spacious rather than cute or chaotic.

Use page and callout as the luminous ground; heading and accent for the dominant energetic form; ink and steel for structural shadows, contours, and the darkest shapes; and soft or rule for hazy transitions. Limit the image to the authoritative palette and let shape, natural scale, shadow, and grain create depth. Avoid overfitting to style references: invent an original subject, setting, and composition instead of reusing a recognizable scene, prop arrangement, person, animal, building, or landmark.

Depict familiar people, objects, rooms, streets, and activities at normal scale with plausible spatial relationships. The scene must read as an ordinary moment even though its rendering is stylized. Raster illustration only. No visual metaphors, impossible shadows, monumental arches or platforms, transformed objects, dream logic, typography, captions, logos, watermarks, color swatches, borders, collage, photorealism, vector-perfect edges, corporate flat illustration, children's-book styling, psychedelic clutter, glossy 3D, or smooth gradient polish.

[COVER ART CONSTRAINTS]`;

const monumentSpaceImagePromptTemplate = `[SUBJECT], organized as one decisive observational editorial image of an ordinary action, object arrangement, workplace, or domestic setting.

[COLOR PALETTE]

Original two-to-three-ink risograph and screenprint illustration on tactile uncoated paper. Use simplified observational drawing, bold asymmetric cropping, large silhouettes, broad exposed-paper negative space, coarse visible halftone dots, stipple, crosshatching, ink overprint, subtle ink spread, slight registration drift, and occasional uneven density. Build every middle value through dot density, line work, overprint, and exposed paper rather than continuous-tone shading or digital gradients.

Use page and callout as the exposed paper ground; heading and accent as the dominant signal ink; ink and steel sparingly for the hardest shadows, structural contours, and densest overprint; and soft or rule only as light halftone values. Keep the authoritative palette limited and let print mechanics create depth. Preserve normal object proportions, familiar human scale, and believable spatial relationships. Avoid overfitting to style references: invent an original subject, setting, and composition rather than repeating a recognizable house, still life, portrait, landscape, vehicle, plant, or landmark.

The depicted moment must be physically plausible and immediately recognizable before the print treatment is applied. Raster print illustration only. No allegorical machines, giant controls, oversized structural components, symbolic systems, impossible construction, typography, captions, numbers, logos, watermarks, color swatches, polished vector edges, continuous-tone gradients, photorealism, 3D rendering, retro advertising, propaganda posing, decorative gears, science-fiction styling, or grunge that obscures the subject.

[COVER ART CONSTRAINTS]`;

const sportingAgrandirImagePromptTemplate = `[SUBJECT], staged as one quiet, ordinary editorial moment that feels humane, self-possessed, and relaxed.

[COLOR PALETTE]

Original naïve hand-drawn editorial illustration with intelligent restraint. Use wobbly ink contours, scratchy colored-pencil and wax-crayon fill marks, subtly uneven opaque color fields, deliberately simple anatomy and perspective, charming awkwardness, sparse front-facing staging, and visible handmade paper texture. Keep forms flat and immediately readable, preserve familiar proportions and normal spatial relationships, and use generous uninterrupted negative space.

Use page and callout as the dominant field; ink and heading for primary subjects and open shapes; accent and meta as the single bright focal detail; steel and cover-band for outlines and the darkest fills; and deck or muted for restrained secondary areas. Limit the image to the authoritative palette and do not introduce naturalistic colors. Avoid overfitting to style references: invent an original subject, character, object, setting, and composition rather than repeating a recognizable portrait, landscape, house, animal group, beverage, floral still life, or signature.

Depict real everyday activities, familiar objects, plausible rooms or outdoor places, and normal scale. Let the drawing style supply the personality; do not make the subject strange. Raster illustration only. No anthropomorphic objects, impossible growth, giant props, tiny people, surreal scale, symbolic transformation, dream logic, typography, captions, numbers, logos, watermarks, color swatches, borders, collage, photorealism, smooth vector geometry, gradients, polished 3D, corporate doodle styling, emoji faces, children's-book storytelling, slapstick exaggeration, or decorative clutter.

[COVER ART CONSTRAINTS]`;

const millimetreMondwestImagePromptTemplate = `[SUBJECT], distilled into a bold, grounded editorial illustration of an ordinary real-world moment.

[COLOR PALETTE]

Original flat graphic illustration with the character of a hand-pulled screenprint poster: heavy ink-black contour lines, broad pools of velvety black, large matte opaque color fields, simplified geometric anatomy and architecture, rounded organic silhouettes, confident cropped shapes, compressed but readable perspective, sparse interior marks, and subtle paper tooth or ink-edge irregularity. Use almost no modeled shading; create depth through overlap, scale, silhouette, and the forceful balance between dense black masses and open ground. Let true near-black occupy a substantial portion of the composition instead of diluting it into olive charcoal. Keep the composition assured, stylish, and immediately legible rather than cute, diagrammatic, or decorative.

Use page and callout as the broad sage ground; ink, heading, steel, and cover-band for dominant outlines, clothing, shadow shapes, and deep negative space; meta and accent for limited but vivid vermilion and signal-orange focal areas; and soft, rule, deck, or muted for restrained supporting fields. Preserve crisp tonal separation: blacks must read as deep black, and oranges must read as clean, luminous, saturated orange rather than brown, rust, ochre, or muted terracotta. Limit the image to the authoritative palette. Avoid overfitting to style references: create an original subject, setting, and composition instead of repeating a recognizable portrait, landscape, house, boat, cup arrangement, plant grouping, or landmark.

Depict familiar people, objects, rooms, streets, and landscapes at normal scale with plausible anatomy, ordinary perspective, and physically coherent relationships. The scene must make literal sense before it is simplified; let contour, silhouette, crop, and flat color provide the visual character. Raster illustration only. No visual metaphors, dream logic, floating objects, impossible suns or clouds, altered anatomy, fused figures, surreal architecture, fantasy scenery, typography, captions, numbers, logos, watermarks, color swatches, borders, collage, photorealism, gradients, airbrush shading, glossy 3D, vector-perfect corporate illustration, psychedelic patterning, or decorative clutter.

[COVER ART CONSTRAINTS]`;

function role(family, fallback, weights) {
  return {
    family,
    weights,
    stack: `${JSON.stringify(family)}, ${fallback}`
  };
}

function inspiration(originalPairing, bundledPairing, substitutions = []) {
  return {
    articleTitle: PAIRING_ARTICLE_CREDIT.title,
    articleUrl: PAIRING_ARTICLE_CREDIT.url,
    writer: PAIRING_ARTICLE_CREDIT.writer,
    curator: PAIRING_ARTICLE_CREDIT.curator,
    originalPairing,
    bundledPairing,
    substitutions
  };
}

function googleFontSource(family, repositoryPath, license = "OFL-1.1") {
  return {
    family,
    url: `https://github.com/google/fonts/tree/${GOOGLE_FONTS_REF}/${repositoryPath}`,
    ref: GOOGLE_FONTS_REF,
    license
  };
}

const editorialThemes = [
  {
    id: "mazius-libre",
    aliases: ["brutal-elegance", "mazius-libre-baskerville"],
    name: "Brutal Elegance — Mazius + Libre Baskerville",
    inspiration: inspiration(
      ["Mazius Display", "Libre Baskerville"],
      ["Mazius Display", "Libre Baskerville"]
    ),
    fontSources: [
      {
        family: "Mazius Display",
        url: "https://github.com/collletttivo/mazius-display",
        ref: "5798d69b14f0b7c1691f031f2ecb98ebdb709b54",
        license: "OFL-1.1"
      },
      googleFontSource("Libre Baskerville", "ofl/librebaskerville")
    ],
    fonts: {
      display: role("Mazius Display", "Georgia, serif", [400, 700]),
      body: role("Libre Baskerville", "Georgia, serif", [400, 500, 600, 700]),
      ui: role("Libre Baskerville", "Georgia, serif", [400, 700]),
      accent: role("Mazius Display", "Georgia, serif", [400, 700]),
      faces: [
        { family: "Mazius Display", weight: 400, file: "MaziusDisplay-Regular.otf" },
        { family: "Mazius Display", weight: 700, file: "MaziusDisplay-Bold.otf" },
        { family: "Mazius Display", weight: 400, style: "italic", file: "MaziusDisplay-ExtraItalic.otf" },
        { family: "Libre Baskerville", weight: "400 700", file: "LibreBaskerville-Variable.ttf" },
        { family: "Libre Baskerville", weight: "400 700", style: "italic", file: "LibreBaskerville-Italic-Variable.ttf" }
      ],
      licenses: [
        { family: "Mazius Display", file: "Mazius-OFL.txt" },
        { family: "Libre Baskerville", file: "LibreBaskerville-OFL.txt" }
      ]
    },
    colors: {
      browser: "#121212", page: "#232323", ink: "#F9F9F9", heading: "#F9F9F9",
      deck: "#D6D6D6", muted: "#A5A5A5", meta: "#E4FF5E", accent: "#E4FF5E",
      soft: "#303030", rule: "#5A5A5A", steel: "#0E0E0E", coverBand: "#0E0E0E",
      callout: "#2D2D2D"
    },
    imagePrompt: {
      subjectPlaceholder: "[SUBJECT]",
      palettePlaceholder: "[COLOR PALETTE]",
      constraintPlaceholder: "[COVER ART CONSTRAINTS]",
      coverArt: {
        frame: "8.5in x 7.45in with the default cover band; runtime requests resolve the configured crop",
        aspectRatio: "1.14:1",
        preferredPixels: ["2400x2096", "2048x1792"],
        safeArea: "Keep the focal subject inside the central safe area with roughly 12% padding on every side. Preserve broad negative space around it for flexible cropping."
      },
      guidance: [
        "Use this prompt for manuscript-grounded cover and divider artwork whenever the mazius-libre theme is active.",
        "Replace [SUBJECT] with a specific, physically plausible everyday scene derived from the manuscript; the runtime supplies the authoritative palette and production crop.",
        "Keep HTML/CSS responsible for all typography, preserve the moody underexposed character through light and framing, and use a new subject for each generated image rather than repeating the cover composition."
      ],
      examples: [
        {
          file: "weekly-planning.png",
          subject: "An adult alone at a simple desk beside a tall window, writing a weekly plan while a narrow band of low morning light crosses the notebook and the rest of the room falls into deep shadow.",
          alt: "An adult writing at a dark desk as a narrow band of morning light crosses a chartreuse notebook."
        },
        {
          file: "focused-still-life.png",
          subject: "An open notebook, analog timer, metal key, and black pen arranged with deliberate spacing where a sharp diagonal of low sunlight cuts across a matte graphite table.",
          alt: "A notebook, chartreuse timer, key, and pen divided by hard light and deep shadow on a graphite table."
        },
        {
          file: "morning-walk.png",
          subject: "An adult in a chartreuse jacket walking away along a real paved path through a nearly empty urban park in low winter morning light, with long tree shadows across the ground.",
          alt: "An adult in a chartreuse jacket walking through a shadowed park in low winter light."
        }
      ],
      template: maziusLibreImagePromptTemplate
    }
  },
  {
    id: "regina-poppins",
    aliases: ["funkadelic", "regina-black-poppins"],
    name: "Funkadelic — Regina Black + Poppins",
    inspiration: inspiration(
      ["Regina Black", "Poppins"],
      ["Shrikhand", "Poppins"],
      [{
        original: "Regina Black",
        bundled: "Shrikhand",
        sourceUrl: "https://www.losttype.com/font/?name=regina",
        reason: "Regina Black is personal-use licensed and cannot be redistributed; Shrikhand preserves its bubbly retro display character under OFL-1.1."
      }]
    ),
    fontSources: [
      googleFontSource("Shrikhand", "ofl/shrikhand"),
      googleFontSource("Poppins", "ofl/poppins")
    ],
    fonts: {
      display: role("Shrikhand", "Georgia, serif", [400]),
      body: role("Poppins", "Arial, sans-serif", [400, 600]),
      ui: role("Poppins", "Arial, sans-serif", [400, 600]),
      accent: role("Shrikhand", "Georgia, serif", [400]),
      faces: [
        { family: "Shrikhand", weight: 400, file: "Shrikhand-Regular.ttf" },
        { family: "Poppins", weight: 400, file: "Poppins-Regular.ttf" },
        { family: "Poppins", weight: 600, file: "Poppins-SemiBold.ttf" }
      ],
      licenses: [
        { family: "Shrikhand", file: "Shrikhand-OFL.txt" },
        { family: "Poppins", file: "Poppins-OFL.txt" }
      ]
    },
    colors: {
      browser: "#D5A83B", page: "#FFDB60", ink: "#3B2028", heading: "#F74735",
      deck: "#5D2A2B", muted: "#7F5037", meta: "#F74735", accent: "#F74735",
      soft: "#FFE793", rule: "#ECA64B", steel: "#3A2031", coverBand: "#F74735",
      callout: "#FFF1BC"
    },
    imagePrompt: {
      subjectPlaceholder: "[SUBJECT]",
      palettePlaceholder: "[COLOR PALETTE]",
      constraintPlaceholder: "[COVER ART CONSTRAINTS]",
      coverArt: {
        frame: "8.5in x 7.45in with the default cover band; runtime requests resolve the configured crop",
        aspectRatio: "1.14:1",
        preferredPixels: ["2400x2096", "2048x1792"],
        safeArea: "Keep the primary subject inside the central safe area with roughly 12% padding on every side. Preserve one broad field of breathing room for flexible cropping."
      },
      guidance: [
        "Use this prompt for manuscript-grounded cover and divider artwork whenever the regina-poppins theme is active.",
        "Replace [SUBJECT] with one specific, physically plausible everyday action, object, or setting derived from the manuscript; the runtime supplies the authoritative palette and production crop.",
        "Keep HTML/CSS responsible for typography and vary the ordinary subject across generated images while preserving the grain, rounded shape language, and strong natural shadows."
      ],
      examples: [
        {
          file: "weekly-calendar.png",
          subject: "An adult seated at a kitchen table, calmly marking a weekly paper calendar beside a cup and a small bowl.",
          alt: "An adult planning the week at a golden kitchen table in a grainy airbrushed illustration."
        },
        {
          file: "parked-bicycle.png",
          subject: "A bicycle parked against the wall of a modest neighborhood shop in clear afternoon sunlight.",
          alt: "A coral bicycle parked beside a neighborhood shop, casting a natural plum shadow."
        },
        {
          file: "sorting-task-cards.png",
          subject: "A close view of two hands sorting ordinary blank task cards into three neat groups on a desk.",
          alt: "Two hands sorting coral and cream task cards on a golden desk."
        }
      ],
      template: reginaPoppinsImagePromptTemplate
    }
  },
  {
    id: "monument-space",
    aliases: ["fighting-robots", "monument-extended-space-mono"],
    name: "Fighting Robots — Monument Extended + Space Mono",
    inspiration: inspiration(
      ["Monument Extended", "Space Mono"],
      ["Archivo Black", "Space Mono"],
      [{
        original: "Monument Extended",
        bundled: "Archivo Black",
        sourceUrl: "https://pangrampangram.com/products/monument-extended",
        reason: "Monument Extended is free-to-try and forbids public redistribution; Archivo Black supplies comparable architectural weight under OFL-1.1."
      }]
    ),
    fontSources: [
      googleFontSource("Archivo Black", "ofl/archivoblack"),
      googleFontSource("Space Mono", "ofl/spacemono")
    ],
    fonts: {
      display: role("Archivo Black", "Arial Black, sans-serif", [400]),
      body: role("Space Mono", "monospace", [400, 700]),
      ui: role("Space Mono", "monospace", [400, 700]),
      accent: role("Space Mono", "monospace", [400, 700]),
      faces: [
        { family: "Archivo Black", weight: 400, file: "ArchivoBlack-Regular.ttf" },
        { family: "Space Mono", weight: 400, file: "SpaceMono-Regular.ttf" },
        { family: "Space Mono", weight: 700, file: "SpaceMono-Bold.ttf" }
      ],
      licenses: [
        { family: "Archivo Black", file: "ArchivoBlack-OFL.txt" },
        { family: "Space Mono", file: "SpaceMono-OFL.txt" }
      ]
    },
    colors: {
      browser: "#D7D7CF", page: "#F4F4EA", ink: "#181A24", heading: "#FF213A",
      deck: "#34384B", muted: "#696D79", meta: "#FF213A", accent: "#FF213A",
      soft: "#FFE4E7", rule: "#F2B8BF", steel: "#11182E", coverBand: "#FF213A",
      callout: "#FFF0F1"
    },
    imagePrompt: {
      subjectPlaceholder: "[SUBJECT]",
      palettePlaceholder: "[COLOR PALETTE]",
      constraintPlaceholder: "[COVER ART CONSTRAINTS]",
      coverArt: {
        frame: "8.5in x 7.45in with the default cover band; runtime requests resolve the configured crop",
        aspectRatio: "1.14:1",
        preferredPixels: ["2400x2096", "2048x1792"],
        safeArea: "Keep the primary subject and mechanism inside the central safe area with roughly 12% padding on every side. Preserve a broad exposed-paper field for flexible cropping."
      },
      guidance: [
        "Use this prompt for manuscript-grounded cover and divider artwork whenever the monument-space theme is active.",
        "Replace [SUBJECT] with one specific, physically plausible action, object arrangement, workplace, or domestic scene derived from the manuscript; the runtime supplies the authoritative palette and production crop.",
        "Keep HTML/CSS responsible for typography and vary the ordinary subject across images while preserving the limited inks, exposed paper, halftone construction, and slight registration drift."
      ],
      examples: [
        {
          file: "workbench-routine.png",
          subject: "An adult at a compact home workbench adjusting a normal mechanical timer beside a notebook and hand tools.",
          alt: "An adult adjusting a small timer at an orderly workbench in red and navy risograph ink."
        },
        {
          file: "planning-still-life.png",
          subject: "A mechanical metronome, plain key, and folded blank planning sheet arranged as a precise still life.",
          alt: "A red metronome, navy key, and folded paper rendered as a limited-ink risograph still life."
        },
        {
          file: "organized-workspace.png",
          subject: "An adult organizing labeled storage boxes and folders on ordinary shelves in a small home office.",
          alt: "An adult arranging boxes and folders on shelves in a limited red and navy risograph."
        }
      ],
      template: monumentSpaceImagePromptTemplate
    }
  },
  {
    id: "sporting-agrandir",
    aliases: ["weird-relaxed", "sporting-grotesque-agrandir"],
    name: "Weird Yet Relaxed — Sporting Grotesque + Agrandir",
    inspiration: inspiration(
      ["Sporting Grotesque", "Agrandir"],
      ["Sporting Grotesque", "Barlow Semi Condensed"],
      [{
        original: "Agrandir",
        bundled: "Barlow Semi Condensed",
        sourceUrl: "https://pangrampangram.com/products/agrandir",
        reason: "Agrandir is free-to-try and cannot be publicly redistributed; Barlow Semi Condensed retains its narrow geometric rhythm under OFL-1.1."
      }]
    ),
    fontSources: [
      {
        family: "Sporting Grotesque",
        url: "https://gitlab.com/velvetyne/Sporting-Grotesque",
        ref: "cf0a5a6350d61f9d299ca1c82f42f4c92dc2ff8c",
        license: "OFL-1.1"
      },
      googleFontSource("Barlow Semi Condensed", "ofl/barlowsemicondensed")
    ],
    fonts: {
      display: role("Sporting Grotesque", "Arial, sans-serif", [400, 700]),
      body: role("Barlow Semi Condensed", "Arial, sans-serif", [400, 600]),
      ui: role("Barlow Semi Condensed", "Arial, sans-serif", [400, 600]),
      accent: role("Sporting Grotesque", "Arial, sans-serif", [400, 700]),
      faces: [
        { family: "Sporting Grotesque", weight: 400, file: "SportingGrotesque-Regular.otf" },
        { family: "Sporting Grotesque", weight: 700, file: "SportingGrotesque-Bold.otf" },
        { family: "Barlow Semi Condensed", weight: 400, file: "BarlowSemiCondensed-Regular.ttf" },
        { family: "Barlow Semi Condensed", weight: 600, file: "BarlowSemiCondensed-SemiBold.ttf" }
      ],
      licenses: [
        { family: "Sporting Grotesque", file: "SportingGrotesque-OFL.txt" },
        { family: "Barlow Semi Condensed", file: "BarlowSemiCondensed-OFL.txt" }
      ]
    },
    colors: {
      browser: "#0000A8", page: "#0000FE", ink: "#FBFBEF", heading: "#FBFBEF",
      deck: "#D8D8FF", muted: "#B1B1E8", meta: "#C9FF68", accent: "#C9FF68",
      soft: "#1717D9", rule: "#7474FF", steel: "#000066", coverBand: "#000066",
      callout: "#0B0BC3"
    },
    imagePrompt: {
      subjectPlaceholder: "[SUBJECT]",
      palettePlaceholder: "[COLOR PALETTE]",
      constraintPlaceholder: "[COVER ART CONSTRAINTS]",
      coverArt: {
        frame: "8.5in x 7.45in with the default cover band; runtime requests resolve the configured crop",
        aspectRatio: "1.14:1",
        preferredPixels: ["2400x2096", "2048x1792"],
        safeArea: "Keep the primary subject inside the central safe area with roughly 12% padding on every side. Preserve generous uninterrupted negative space for flexible cropping."
      },
      guidance: [
        "Use this prompt for manuscript-grounded cover and divider artwork whenever the sporting-agrandir theme is active.",
        "Replace [SUBJECT] with one specific, physically plausible everyday action, familiar object arrangement, or sparse real-world scene derived from the manuscript; the runtime supplies the authoritative palette and production crop.",
        "Keep HTML/CSS responsible for typography and vary the ordinary subject across generated images while preserving the wobbly contours, scratchy fills, flat fields, gentle personality, and abundant negative space."
      ],
      examples: [
        {
          file: "weekly-desk.png",
          subject: "An adult seated at a small desk, looking down while planning the week in an open notebook beside a cup and desk lamp.",
          alt: "An adult planning the week at a small desk in a naïve electric-blue illustration."
        },
        {
          file: "chair-and-plant.png",
          subject: "A plain wooden chair with a small potted three-leaf plant placed beside it in a quiet room.",
          alt: "An off-white chair beside a small acid-lime potted plant on an electric-blue field."
        },
        {
          file: "patio-break.png",
          subject: "An adult sitting beneath a normal patio umbrella at a small outdoor table with a cup and closed notebook.",
          alt: "An adult taking a quiet break beneath a normal off-white patio umbrella."
        }
      ],
      template: sportingAgrandirImagePromptTemplate
    }
  },
  {
    id: "millimetre-mondwest",
    aliases: ["technical-specs"],
    name: "Technical Specs — Millimetre + Mondwest",
    inspiration: inspiration(
      ["Millimetre", "Mondwest"],
      ["Millimetre", "Departure Mono"],
      [{
        original: "Mondwest",
        bundled: "Departure Mono",
        sourceUrl: "https://pangrampangram.com/products/bitmap-mondwest",
        reason: "Mondwest is free-to-try and cannot be publicly redistributed; Departure Mono provides a legible pixel-built counterpoint under OFL-1.1."
      }]
    ),
    fontSources: [
      {
        family: "Millimetre",
        url: "https://github.com/davelab6/Millimetre",
        ref: "7cd77ff6c3e42d8776f1fea4bbcc8f6363cefdf0",
        license: "OFL-1.1"
      },
      {
        family: "Departure Mono",
        url: "https://github.com/rektdeckard/departure-mono",
        ref: "75152a3f1e6dacdd248a6c397c97dbf27e33eea0",
        license: "OFL-1.1"
      }
    ],
    fonts: {
      display: role("Millimetre", "Arial, sans-serif", [400, 700]),
      body: role("Departure Mono", "monospace", [400]),
      ui: role("Millimetre", "Arial, sans-serif", [400, 700]),
      accent: role("Departure Mono", "monospace", [400]),
      faces: [
        { family: "Millimetre", weight: 400, file: "Millimetre-Regular.otf" },
        { family: "Millimetre", weight: 700, file: "Millimetre-Bold.otf" },
        { family: "Departure Mono", weight: 400, file: "DepartureMono-Regular.otf" }
      ],
      licenses: [
        { family: "Millimetre", file: "Millimetre-OFL.txt" },
        { family: "Departure Mono", file: "DepartureMono-OFL.txt" }
      ]
    },
    colors: {
      browser: "#73766A", page: "#AEB1A0", ink: "#0A0A09", heading: "#0A0A09",
      deck: "#24251F", muted: "#4C5046", meta: "#E84C16", accent: "#FF7417",
      soft: "#C4C6B8", rule: "#7D8073", steel: "#171813", coverBand: "#0A0A09",
      callout: "#C9CBBE"
    },
    imagePrompt: {
      subjectPlaceholder: "[SUBJECT]",
      palettePlaceholder: "[COLOR PALETTE]",
      constraintPlaceholder: "[COVER ART CONSTRAINTS]",
      coverArt: {
        frame: "8.5in x 7.45in with the default cover band; runtime requests resolve the configured crop",
        aspectRatio: "1.14:1",
        preferredPixels: ["2400x2096", "2048x1792"],
        safeArea: "Keep the primary subject inside the central safe area with roughly 12% padding on every side. Preserve one broad sage or charcoal field for flexible cropping."
      },
      guidance: [
        "Use this prompt for manuscript-grounded cover and divider artwork whenever the millimetre-mondwest theme is active.",
        "Replace [SUBJECT] with one specific, physically plausible everyday action, still life, room, street, or landscape derived from the manuscript; the runtime supplies the authoritative palette and production crop.",
        "Keep HTML/CSS responsible for typography and vary ordinary subjects across generated images while preserving the heavy contours, broad deep-black masses, vivid signal-orange focal accents, flat matte fields, strong silhouettes, restrained print texture, and normal scale."
      ],
      examples: [
        {
          file: "weekly-worktable.png",
          subject: "An adult seated at a compact worktable, calmly reviewing an open blank weekly planner beside a normal desk lamp, ceramic cup, pencil, and analog clock.",
          alt: "An adult reviewing a weekly planner at a deep-black and sage worktable with bright-orange accents."
        },
        {
          file: "morning-still-life.png",
          subject: "A ceramic coffee cup, closed notebook, reading glasses, plain key, and small analog timer arranged naturally on a round breakfast table.",
          alt: "A coffee cup, notebook, glasses, key, and timer in a flat sage, deep-black, and signal-orange still life."
        },
        {
          file: "neighborhood-ride.png",
          subject: "An adult riding a bicycle at normal speed along a quiet neighborhood street with modest houses, trees, and a low wall in the distance.",
          alt: "A cyclist traveling along an ordinary sage and deep-black neighborhood street with bright-orange details."
        }
      ],
      template: millimetreMondwestImagePromptTemplate
    }
  }
];

export default editorialThemes;

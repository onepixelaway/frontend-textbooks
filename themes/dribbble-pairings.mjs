export const DRIBBBLE_PAIRING_ARTICLE = Object.freeze({
  title: "8 expressive free font combos for your next design",
  url: "https://dribbble.com/stories/2020/06/10/free-font-combinations",
  writer: "Renee Fleck",
  curator: "Davide Baratta"
});
const GOOGLE_FONTS_REF = "00e726a90e0b9698971c37b88c35ef958965448b";

function role(family, fallback, weights) {
  return {
    family,
    weights,
    stack: `${JSON.stringify(family)}, ${fallback}`
  };
}

function inspiration(originalPairing, bundledPairing, substitutions = []) {
  return {
    articleTitle: DRIBBBLE_PAIRING_ARTICLE.title,
    articleUrl: DRIBBBLE_PAIRING_ARTICLE.url,
    writer: DRIBBBLE_PAIRING_ARTICLE.writer,
    curator: DRIBBBLE_PAIRING_ARTICLE.curator,
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

function pairingTheme(theme) {
  return {
    ...theme,
    imagePrompt: null,
    imagePromptStatus: "pending-user-supplied"
  };
}

const dribbblePairingThemes = [
  pairingTheme({
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
    }
  }),
  pairingTheme({
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
    }
  }),
  pairingTheme({
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
    }
  }),
  pairingTheme({
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
    }
  }),
  pairingTheme({
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
      browser: "#888B7E", page: "#AEB1A0", ink: "#232323", heading: "#232323",
      deck: "#35362F", muted: "#5A5E52", meta: "#B95332", accent: "#D56F3D",
      soft: "#C4C6B8", rule: "#858879", steel: "#303428", coverBand: "#232323",
      callout: "#C9CBBE"
    }
  })
];

export default dribbblePairingThemes;

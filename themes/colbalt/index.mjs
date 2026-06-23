const imagePromptTemplate = `[SUBJECT / SCENE] in a minimal conceptual editorial illustration style, monochrome cobalt blue and warm white palette, quiet intellectual atmosphere, spacious composition with large areas of negative space.

Use expressive blue ink brushwork, dry-brush streaks, layered screenprint texture, fine contour-line patterns, fingerprint-like wave forms, and soft painterly gradients. Blend a lightly realistic human figure or object with abstract flowing visual metaphors of thought, knowledge, writing, data, memory, or creative process.

Composition should feel calm, sparse, and magazine-editorial: one clear focal subject, surrounded by oversized abstract marks, paper-like forms, flowing ribbons, circular brush loops, or stacked document shapes. Warm off-white paper background, visible canvas/paper grain, subtle ink bleed, imperfect handmade edges, high contrast but soft overall mood.

Elegant, poetic, restrained, modern, contemplative, tactile, printmaking-inspired, riso poster aesthetic, blue ink on paper, no text, no logo, no bright colors, no photorealism, no busy background, no multi-panel grid, no collage of separate images.`;

const colbaltTheme = {
  id: "colbalt",
  aliases: ["default", "executive", "cobalt"],
  name: "Colbalt Editorial",
  fonts: {
    header: {
      family: "Poppins",
      weights: [600, 700, 800],
      stack: '"Poppins", "Avenir Next", Helvetica, Arial, sans-serif'
    },
    body: {
      family: "Halant",
      weights: [400, 500, 600],
      stack: '"Halant", Georgia, serif'
    },
    ui: {
      family: "Poppins",
      weights: [600, 700, 800],
      stack: '"Poppins", "Avenir Next", Helvetica, Arial, sans-serif'
    },
    googleFontsHref: "https://fonts.googleapis.com/css2?family=Halant:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap"
  },
  colors: {
    browser: "#d7d7d3",
    page: "#fbfaf6",
    ink: "#10131A",
    heading: "#0A3695",
    deck: "#19419A",
    muted: "#2C3342",
    meta: "#69738F",
    accent: "#4F76D9",
    soft: "#B7C8F3",
    rule: "#9BB2EA",
    steel: "#19419A",
    coverBand: "#0A3695",
    callout: "#f1f5ff"
  },
  imagePrompt: {
    subjectPlaceholder: "[SUBJECT / SCENE]",
    coverArt: {
      frame: "8.5in x 7.45in",
      aspectRatio: "1.14:1",
      preferredPixels: ["2400x2096", "2048x1792"],
      safeArea: "Keep the focal subject inside the central safe area with roughly 10-15% padding on all sides."
    },
    guidance: [
      "Use this prompt template when generated images are useful and the user has not supplied a different image style.",
      "Replace only [SUBJECT / SCENE] with a concrete manuscript-grounded subject.",
      "Use the same template for cover and part-divider art, changing only the concrete subject phrase."
    ],
    template: imagePromptTemplate
  }
};

export default colbaltTheme;

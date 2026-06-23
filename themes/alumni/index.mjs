const imagePromptTemplate = `[SUBJECT] in a dark cinematic amber chiaroscuro scene, quiet minimalist composition, deep warm shadows, glowing ember-orange light, near-black silhouettes, soft atmospheric haze, subtle bloom, burnt orange and espresso brown monochrome palette, sparse negative space, elegant vertical framing, contemplative art-film still, poetic solitude, dramatic rim lighting, soft gradients, low-key exposure, warm window-light or horizon-glow effect, thin luminous light accents, refined cinematic realism, moody editorial photography, quiet luxury, no text, no logo, no bright colors, no clutter`;

const alumniTheme = {
  id: "alumni",
  name: "Alumni",
  fonts: {
    header: {
      family: "Bricolage Grotesque",
      weights: [600, 700, 800],
      stack: '"Bricolage Grotesque", "Avenir Next", Helvetica, Arial, sans-serif'
    },
    body: {
      family: "Fraunces",
      weights: [400, 500, 600],
      stack: '"Fraunces", Georgia, serif'
    },
    ui: {
      family: "Fraunces",
      weights: [400, 500, 600],
      stack: '"Fraunces", Georgia, serif'
    },
    googleFontsHref: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap"
  },
  colors: {
    browser: "#E8D7B6",
    page: "#FAF1E2",
    ink: "#2A1711",
    heading: "#8E2D1F",
    deck: "#B53D2A",
    muted: "#6F3C2F",
    meta: "#8E2D1F",
    accent: "#B53D2A",
    soft: "rgba(181, 61, 42, 0.32)",
    rule: "rgba(181, 61, 42, 0.5)",
    steel: "#8E2D1F",
    coverBand: "#8E2D1F",
    callout: "#F2E5CF"
  },
  imagePrompt: {
    subjectPlaceholder: "[SUBJECT]",
    coverArt: {
      frame: "8.5in x 7.45in",
      aspectRatio: "1.14:1",
      preferredPixels: ["2400x2096", "2048x1792"],
      safeArea: "Keep the focal subject inside the central safe area with roughly 10-15% padding on all sides."
    },
    guidance: [
      "Use this prompt template when generated images are useful and the alumni theme is active.",
      "Replace only [SUBJECT] with a concrete manuscript-grounded subject.",
      "Keep cover and divider images in the same amber cinematic language, changing only the subject phrase."
    ],
    template: imagePromptTemplate
  }
};

export default alumniTheme;

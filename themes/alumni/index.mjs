const imagePromptTemplate = `[SUBJECT] in a sun-drenched pastel Mediterranean setting, editorial lifestyle photography, warm coastal villa atmosphere, peach and coral stucco walls, powder blue painted trim, cream and ivory surfaces, terracotta accents, tomato red details, soft sage greenery, bright clear daylight, strong natural sunlight, crisp but gentle shadows, airy high-key exposure.

Styled with tactile handmade textures: glazed ceramic vases, woven baskets, linen curtains, boucle or woven textiles, fresh flowers, citrus fruit, potted palms, sculptural plants, painted wood, matte stucco, subtle vintage decor. Calm luxurious vacation-house mood, optimistic 1970s resort aesthetic, modern boutique hotel styling, art-directed color palette, clean composition, one clear focal point, spacious negative space, elegant magazine editorial framing.

Photorealistic but slightly stylized, soft film grain, natural skin tones if people are present, refined color harmony, warm nostalgic summer atmosphere, cover-ready composition, crisp details, gentle depth of field, no text, no logo, no clutter, no dark moody lighting, no harsh black shadows, no neon colors, no futuristic elements.

[COVER ART CONSTRAINTS]`;

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
    constraintPlaceholder: "[COVER ART CONSTRAINTS]",
    coverArt: {
      frame: "8.5in x 7.45in with the default cover band; runtime requests resolve the configured crop",
      aspectRatio: "1.14:1",
      preferredPixels: ["2400x2096", "2048x1792"],
      safeArea: "Keep the focal subject inside the central safe area with roughly 10-15% padding on all sides."
    },
    guidance: [
      "Use this prompt template for the required manuscript-grounded cover artwork whenever the alumni theme is active.",
      "The runtime replaces [SUBJECT] and [COVER ART CONSTRAINTS] from the validated plan and configured crop.",
      "Keep HTML/CSS responsible for all cover typography; the bitmap must contain no title, author, or logo.",
      "Keep any divider images in the same editorial language while changing the subject and never reusing the cover bitmap."
    ],
    template: imagePromptTemplate
  }
};

export default alumniTheme;

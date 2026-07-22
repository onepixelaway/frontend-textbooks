const imagePromptTemplate = `[SUBJECT] in a sun-drenched Mediterranean setting, editorial lifestyle photography, coastal villa atmosphere, strong natural sunlight, crisp but gentle shadows.

[COLOR PALETTE]

Styled with tactile handmade textures: glazed ceramic vases, woven baskets, linen curtains, boucle or woven textiles, fresh flowers, citrus fruit, potted palms, sculptural plants, painted wood, matte stucco, subtle vintage decor. Calm luxurious vacation-house mood, optimistic 1970s resort aesthetic, modern boutique hotel styling, clean composition, one clear focal point, spacious negative space, elegant magazine editorial framing.

Photorealistic but slightly stylized, soft film grain, natural skin tones if people are present, refined color harmony, nostalgic summer atmosphere, cover-ready composition, crisp details, gentle depth of field, no text, no logo, no clutter, no colors outside the authoritative palette, no futuristic elements.

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
    faces: [
      { family: "Bricolage Grotesque", weight: "200 800", file: "BricolageGrotesque-Variable.ttf" },
      { family: "Fraunces", weight: "100 900", file: "Fraunces-Variable.ttf" }
    ],
    licenses: [
      { family: "Bricolage Grotesque", file: "BricolageGrotesque-OFL.txt" },
      { family: "Fraunces", file: "Fraunces-OFL.txt" }
    ]
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
    palettePlaceholder: "[COLOR PALETTE]",
    constraintPlaceholder: "[COVER ART CONSTRAINTS]",
    coverArt: {
      frame: "8.5in x 7.45in with the default cover band; runtime requests resolve the configured crop",
      aspectRatio: "1.14:1",
      preferredPixels: ["2400x2096", "2048x1792"],
      safeArea: "Keep the focal subject inside the central safe area with roughly 10-15% padding on all sides."
    },
    guidance: [
      "Use this prompt template for the required manuscript-grounded cover artwork whenever the alumni theme is active.",
      "The runtime replaces [SUBJECT], [COLOR PALETTE], and [COVER ART CONSTRAINTS] from the validated plan, resolved theme colors, and configured crop.",
      "Keep HTML/CSS responsible for all cover typography; the bitmap must contain no title, author, or logo.",
      "Keep any divider images in the same editorial language while changing the subject and never reusing the cover bitmap."
    ],
    template: imagePromptTemplate
  }
};

export default alumniTheme;

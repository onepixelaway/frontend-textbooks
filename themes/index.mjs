import alumniTheme from "./alumni/index.mjs";
import colbaltTheme from "./colbalt/index.mjs";

const localThemes = [
  colbaltTheme,
  alumniTheme,
  {
    id: "field-guide",
    colors: {
      browser: "#c7c0ad",
      page: "#f7f1e5",
      ink: "#202018",
      muted: "#657060",
      accent: "#3f6f46",
      steel: "#1f2d22"
    },
    fonts: {
      header: { stack: '"Avenir Next", Inter, Helvetica, Arial, sans-serif' },
      body: { stack: 'Georgia, "Times New Roman", serif' },
      ui: { stack: '"Avenir Next", Inter, Helvetica, Arial, sans-serif' }
    }
  },
  {
    id: "scholarly",
    colors: {
      browser: "#d9d2c4",
      page: "#fbf7ed",
      ink: "#191714",
      muted: "#6f6659",
      accent: "#8d2f24",
      steel: "#15130f"
    },
    fonts: {
      header: { stack: 'Georgia, "Times New Roman", serif' },
      body: { stack: 'Georgia, "Times New Roman", serif' },
      ui: { stack: '"Avenir Next", Inter, Helvetica, Arial, sans-serif' }
    }
  },
  {
    id: "technical",
    colors: {
      browser: "#c9d0d2",
      page: "#ffffff",
      ink: "#15191d",
      muted: "#5b6770",
      accent: "#0b6fa4",
      steel: "#0e2638"
    },
    fonts: {
      header: { stack: "Arial, Helvetica, sans-serif" },
      body: { stack: "Arial, Helvetica, sans-serif" },
      ui: { stack: "Arial, Helvetica, sans-serif" }
    }
  },
  {
    id: "literary",
    colors: {
      browser: "#d3ccc0",
      page: "#fcfaf5",
      ink: "#1b1814",
      muted: "#6e675f",
      accent: "#6c2d2a",
      steel: "#1b1814"
    },
    fonts: {
      header: { stack: 'Georgia, "Times New Roman", serif' },
      body: { stack: 'Georgia, "Times New Roman", serif' },
      ui: { stack: '"Avenir Next", Inter, Helvetica, Arial, sans-serif' }
    }
  }
];

export const DEFAULT_THEME_NAME = colbaltTheme.id;
export const DEFAULT_THEME = colbaltTheme;
export const THEMES = Object.create(null);

for (const theme of localThemes) {
  for (const name of [theme.id, ...(theme.aliases ?? [])]) {
    THEMES[name] = theme;
  }
}

export const STYLE_NAMES = Object.keys(THEMES);

export function getTheme(name = DEFAULT_THEME_NAME) {
  return THEMES[name] ?? DEFAULT_THEME;
}

export function themeColors(theme) {
  return theme.colors ?? theme;
}

export function themeFontStack(theme, name) {
  const fonts = theme.fonts ?? {};
  if (name === "display") return fonts.display?.stack ?? fonts.header?.stack ?? theme.display;
  if (name === "body") return fonts.body?.stack ?? theme.body;
  if (name === "ui") return fonts.ui?.stack ?? fonts.header?.stack ?? theme.ui;
  return "";
}

export function renderThemeFontLinks(theme) {
  const href = theme.fonts?.googleFontsHref;
  if (!href) return "";
  return `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${href}" rel="stylesheet">`;
}

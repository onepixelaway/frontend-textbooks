import {
  DEFAULT_THEME_NAME,
  FONT_THEME_NAMES,
  getFontTheme,
  themeFontStack
} from "../../themes/index.mjs";

function fontRole(theme, role) {
  const metadata = role === "display"
    ? (theme.fonts.display ?? theme.fonts.header)
    : theme.fonts[role];
  return {
    family: metadata.family,
    weights: [...(metadata.weights ?? [])],
    stack: themeFontStack(theme, role)
  };
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), "en");
}

export function createRegisteredFontCatalog() {
  const packs = FONT_THEME_NAMES
    .map((id) => getFontTheme(id))
    .map((theme) => ({
      id: theme.id,
      name: theme.name ?? theme.id,
      aliases: [...(theme.aliases ?? [])].sort(compareText),
      roles: {
        display: fontRole(theme, "display"),
        body: fontRole(theme, "body"),
        ui: fontRole(theme, "ui")
      },
      faces: theme.fonts.faces
        .map((face) => ({
          family: face.family,
          weight: face.weight,
          style: face.style ?? "normal",
          file: face.file
        }))
        .sort((left, right) => compareText(left.family, right.family)
          || compareText(left.style, right.style)
          || compareText(left.weight, right.weight)
          || compareText(left.file, right.file)),
      licenses: theme.fonts.licenses
        .map((license) => ({ family: license.family, file: license.file }))
        .sort((left, right) => compareText(left.family, right.family) || compareText(left.file, right.file))
    }))
    .sort((left, right) => compareText(left.id, right.id));

  return {
    schemaVersion: 1,
    defaultFontTheme: DEFAULT_THEME_NAME,
    packs
  };
}

const GENERIC_FALLBACKS = new Set(["serif", "sans-serif", "monospace"]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

function normalizedText(value, label) {
  const raw = String(value ?? "");
  const text = raw.trim();
  if (!text) throw new Error(`${label} must not be empty`);
  if (CONTROL_CHARACTERS.test(raw)) throw new Error(`${label} contains a control character`);
  return text;
}

export function normalizeFontFamily(value, label) {
  const family = normalizedText(value, label);
  if (/[<>;{}]/u.test(family)) throw new Error(`${label} must be a plain font family name`);
  return family;
}

export function normalizeFontFallback(value, label) {
  const fallback = normalizedText(value, label);
  if (!GENERIC_FALLBACKS.has(fallback)) {
    throw new Error(`${label} must be serif, sans-serif, or monospace`);
  }
  return fallback;
}

export function normalizeFontWeight(value, label) {
  const text = normalizedText(value, label);
  if (/^(?:normal|bold)$/iu.test(text)) return text.toLowerCase();
  const parts = text.split(/\s+/u);
  const numeric = parts.length <= 2 && parts.every((part) => /^(?:\d+(?:\.\d+)?|\.\d+)$/u.test(part));
  const weights = numeric ? parts.map(Number) : [];
  if (!numeric || weights.some((weight) => weight < 1 || weight > 1000) || (weights.length === 2 && weights[0] > weights[1])) {
    throw new Error(`${label} must be normal, bold, a weight from 1 to 1000, or an ascending two-weight range`);
  }
  return text;
}

export function normalizeFontStyle(value, label) {
  const style = normalizedText(value ?? "normal", label);
  if (!/^(?:normal|italic|oblique)$/iu.test(style)) throw new Error(`${label} must be normal, italic, or oblique`);
  return style.toLowerCase();
}

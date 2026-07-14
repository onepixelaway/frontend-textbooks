function normalizedBookSignals(config) {
  return [config.style, config.bookType, config.title]
    .map((value) => String(value ?? "").trim().toLocaleLowerCase("und"))
    .join(" ");
}

export function isDesignedNonfiction(config) {
  return !/\b(plain|literary|reader|novel|fiction|poetry|memoir|essay collection)\b/u.test(normalizedBookSignals(config));
}

export function defaultRequireDiagrams(config) {
  return isDesignedNonfiction(config);
}

export function defaultRequireFeaturePages(config) {
  return isDesignedNonfiction(config);
}

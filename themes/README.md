# Themes

Theme modules keep scaffold styling data out of the generator. Each theme lives in its own folder and exports a default object with:

- `id`: the style name used in `book.json`
- `aliases`: optional legacy or convenience style names
- `fonts.display` (or legacy `fonts.header`), `fonts.body`, `fonts.ui`, and optional `fonts.accent`: named typography roles, supported weights, and fallback stacks
- `fonts.faces`: local font-face records (`family`, `weight`, optional `style`, and a safe filename in the theme's `fonts/` directory)
- `fonts.licenses`: license records copied alongside the active theme's font files
- `colors`: named color roles consumed by `scripts/build-html-book.mjs`
- `imagePrompt`: the active theme's single canonical generated-image template, or explicit `null` while a user-requested prompt is pending
- `imagePromptStatus`: `pending-user-supplied` when `imagePrompt` is intentionally blank

The default theme is `themes/colbalt`. It also supports `default`, `executive`, and `cobalt` aliases for existing books. The `themes/alumni` theme uses rust terracotta, cream paper, Bricolage Grotesque headers, Fraunces body text, and a sunlit Mediterranean image prompt. Runtime code compiles the template and resolved theme colors into `cover-image-request.json`; changing `themeOverrides` changes the authoritative palette section and request hash. Instructions and schemas must not duplicate prompt prose.

Font-bearing themes are self-contained. The build emits local `@font-face` rules, copies only the selected typography pack to `assets/fonts/<theme-id>/`, includes fonts and licenses in the static manifest, and fingerprints their contents for deterministic cache invalidation. `book.json.fontTheme` can select any registered font-bearing theme independently of `style`, so palette/image behavior and typography can be mixed without duplicating assets. The active theme's typography remains the default when it has a bundled pack. Palette-only legacy styles such as `technical`, `scholarly`, `field-guide`, and `literary` must explicitly select `fontTheme`, declare `fontOverrides`, or opt into `fontMode: "system"`.

Five additional themes are registered in `themes/editorial-themes.mjs` with the same runtime contract as every other theme. Each records its historical article attribution, original pairing, bundled pairing, immutable font sources, full semantic palette, and any license-driven substitution. See `themes/FONT_SOURCES.md` for the provenance ledger. Every theme has a canonical prompt plus three cross-subject validation samples. Their prompt contracts preserve the approved medium and palette while requiring ordinary subjects, plausible settings, normal scale, and physically coherent spatial relationships.

For a user-requested Google Fonts family that is not registered, `book.json.fontOverrides` describes a config-relative local bundle: `sourceDirectory`, display/body/UI roles, faces, and licenses. The builder publishes it under `assets/fonts/custom/` with the same path, symlink, cache, manifest, and offline-rendering guarantees. `fontTheme` and `fontOverrides` are mutually exclusive. `fontMode: "system"` is the explicit no-bundle opt-out; the legacy `remote` value now resolves to bundled fonts, and legacy plans may retain `allow-remote-fonts` as a compatibility no-op.

To add a theme, create `themes/<theme-name>/index.mjs`, place its licensed font files in `themes/<theme-name>/fonts/`, declare every face and license in the theme object, then import and add it to `localThemes` in `themes/index.mjs`. Use `node scripts/font-catalog.mjs` to inspect registered roles and `npm run render:theme-samples` to rebuild the comparison gallery.

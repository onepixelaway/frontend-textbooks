# Themes

Theme modules keep scaffold styling data out of the generator. Each theme lives in its own folder and exports a default object with:

- `id`: the style name used in `book.json`
- `aliases`: optional legacy or convenience style names
- `fonts.header`, `fonts.body`, and `fonts.ui`: font stacks and optional font metadata
- `colors`: named color roles consumed by `scripts/build-html-book.mjs`
- `imagePrompt`: prompt guidance and the reusable generated-image template

The default theme is `themes/colbalt`. It also supports `default`, `executive`, and `cobalt` aliases for existing books. The `themes/alumni` theme uses rust terracotta, cream paper, Bricolage Grotesque headers, Fraunces body text, and an amber cinematic image prompt.

To add a theme, create `themes/<theme-name>/index.mjs`, then import and add it to `localThemes` in `themes/index.mjs`.

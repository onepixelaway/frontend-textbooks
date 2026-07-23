# Font Sources and Pairing Provenance

The five themes in `dribbble-pairings.mjs` adapt selected pairings and specimen palettes from [“8 expressive free font combos for your next design”](https://dribbble.com/stories/2020/06/10/free-font-combinations), written by Renee Fleck and curated and visually demonstrated by Davide Baratta.

Only font files whose licenses permit redistribution are committed. Source revisions are immutable so the bundled bytes can be audited and reproduced. Google Fonts files use repository commit `00e726a90e0b9698971c37b88c35ef958965448b`.

## Bundled Families

| Theme | Family | Upstream source | Revision | License |
| --- | --- | --- | --- | --- |
| `mazius-libre` | Mazius Display | [Collletttivo](https://github.com/collletttivo/mazius-display) | `5798d69b14f0b7c1691f031f2ecb98ebdb709b54` | OFL-1.1 |
| `mazius-libre` | Libre Baskerville | [google/fonts](https://github.com/google/fonts/tree/00e726a90e0b9698971c37b88c35ef958965448b/ofl/librebaskerville) | Google Fonts revision above | OFL-1.1 |
| `regina-poppins` | Shrikhand | [google/fonts](https://github.com/google/fonts/tree/00e726a90e0b9698971c37b88c35ef958965448b/ofl/shrikhand) | Google Fonts revision above | OFL-1.1 |
| `regina-poppins` | Poppins | [google/fonts](https://github.com/google/fonts/tree/00e726a90e0b9698971c37b88c35ef958965448b/ofl/poppins) | Google Fonts revision above | OFL-1.1 |
| `monument-space` | Archivo Black | [google/fonts](https://github.com/google/fonts/tree/00e726a90e0b9698971c37b88c35ef958965448b/ofl/archivoblack) | Google Fonts revision above | OFL-1.1 |
| `monument-space` | Space Mono | [google/fonts](https://github.com/google/fonts/tree/00e726a90e0b9698971c37b88c35ef958965448b/ofl/spacemono) | Google Fonts revision above | OFL-1.1 |
| `sporting-agrandir` | Sporting Grotesque | [Velvetyne](https://gitlab.com/velvetyne/Sporting-Grotesque) | `cf0a5a6350d61f9d299ca1c82f42f4c92dc2ff8c` | OFL-1.1 |
| `sporting-agrandir` | Barlow Semi Condensed | [google/fonts](https://github.com/google/fonts/tree/00e726a90e0b9698971c37b88c35ef958965448b/ofl/barlowsemicondensed) | Google Fonts revision above | OFL-1.1 |
| `millimetre-mondwest` | Millimetre | [Millimetre mirror](https://github.com/davelab6/Millimetre) | `7cd77ff6c3e42d8776f1fea4bbcc8f6363cefdf0` | OFL-1.1 |
| `millimetre-mondwest` | Departure Mono | [Departure Mono](https://github.com/rektdeckard/departure-mono) | `75152a3f1e6dacdd248a6c397c97dbf27e33eea0` | OFL-1.1 |

Every theme’s `fonts/` directory includes the corresponding complete license text. `themes/font-assets.mjs` validates both the declared files and a supported license identity before publishing them into a generated book.

## License-Driven Substitutions

| Original in article | Bundled substitute | Reason |
| --- | --- | --- |
| Regina Black | Shrikhand | Regina’s available license is personal-use and does not permit repository redistribution. Shrikhand keeps the rounded, exuberant retro display character under OFL-1.1. |
| Monument Extended | Archivo Black | Monument Extended is offered as free-to-try, while its commercial terms prohibit public redistribution. Archivo Black provides similarly architectural weight under OFL-1.1. |
| Agrandir | Barlow Semi Condensed | Agrandir is free-to-try and cannot be republished here. Barlow Semi Condensed preserves its narrow geometric rhythm under OFL-1.1. |
| Mondwest | Departure Mono | Mondwest is free-to-try and cannot be republished here. Departure Mono supplies a legible pixel-built counterpoint under OFL-1.1. |

The original names remain in theme metadata for attribution and search aliases. Runtime CSS references only the bundled families.

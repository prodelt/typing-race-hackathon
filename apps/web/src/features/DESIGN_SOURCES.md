# Design sources

Every learning screen is built from the brand site **b-red v4** (`Ametrin_website5/variants/v4/b-red`,
2026-09-25). Values were read from its computed styles at 1440×900 (served over HTTP) and from its
`style.css`, `hero.css`, `grad.css`, `grad.js`. The earlier `variants/b-red` (2026-09-17) supplied the
form-step, passport and pill measurements, which v4 keeps unchanged.

| What we use | Where (file) | Taken from b-red | Value |
|---|---|---|---|
| Canvas, paper, ink, red scale | `packages/ui/src/tokens.css` | v4 `:root` | `#ffffff`, `#fcf1ef`, `#f9e6e3`, ink `#141414`, `#2e2e2e`, mute `#666`, grey `#8a8a8a`, graphite `#171717`, red `#c21f13` / `#9c170d` / `#6e0f08`, tint `#f2dcd9`, pale `#fbe3e0` |
| Header | `app/shell.css` | `.head` | 72 px, white, nav 15/500, lang 14/500, red pill 40 px 14/600 |
| Bottom bar | `app/SectionBar.tsx`, `shell.css` | `.pbar` | 56 px, 14/500 tabular, indices `#666` → red when current, dark pill tooltip 13 px |
| Screen title | `screen.css .screen-title` | `h2.display` | Unbounded 700, line-height .95, tracking −.045em (sized down to ≤ 76 px for an app screen) |
| Lede | `.screen-lede` | `.process__lede` | 20 px, 500, line-height 1.4, ink-soft |
| `[01]` index | `ui/Index` | `.sec-num`, `.pbar__cur b` | 14 px 500, number in red |
| Statement (next action, goal) | `.statement` | `.manifesto` | Onest 38 px, 500, lh 1.12, −.025em |
| Hero number | `.num` | `.cell__num` | Unbounded 500, −.05em, lh .95, red |
| Discs | `.disc` | `.point__n` | 72 px circle, red tint, 19 px 600 red; 44 px variant from `.points--role` |
| Passport lists | `.passport` | `.passport` | dt 15–16 px mute, dd 15–17 px 500, gap 15–16 |
| Blocks | `.panel` | `.cell`, `.aud__card` | flat blush, no border, no radius; one `0 72px 0 0` corner on the block read first |
| Poster button | `.poster` | `.submit` | full pill, Unbounded 700 uppercase, red → ink on hover, arrow slides 8 px |
| Choice pills | `.pills`, `.pill` | `.pills`, `.pill span` | 52 px pill, 16/500, 8 px gap; chosen = ink fill + check (red kept for the action) |
| Form steps (Settings, Formulas) | `.fstep`, `.fsec` | `.fstep`, `.fstep__h` | "(1) Look" 56/500 −.045em sticky left, controls right |
| Torn headline (between blocks) | `session.css .torn2` | `.torn` | Unbounded 400, 62 px, grey line then ink line offset |
| Live gradient | `features/grad.tsx`, `grad.css` | `grad.js` scheme B | palettes `bright` / `ember` value for value, seeded blobs, transform-only drift 20–34 s, paused off-screen, grain .05/.07 |
| Product hero | `product/hero.css` | `hero.css` | full-bleed red duotone, wordmark ≈ 88 % of width, title Unbounded 700 clamp(30, 3.9vw, 58), lede 19.4/500, content above the bar |
| Motion | `tokens.css` | `--ease`, `--ease-soft` | expo-out `cubic-bezier(.16,1,.3,1)` for reveals and links, `(.5,1,.89,1)` for layers, 350–400 ms |

Adaptations, and why: titles are smaller than the brand's 104 px sections because a screen must
show its content above the fold; the chosen pill is ink rather than red so that red stays on the
one action, the awaited key and one number; the typing line sits on a plain blush panel (no
gradient) so nothing moves near the text; the low-vision theme flattens every gradient.

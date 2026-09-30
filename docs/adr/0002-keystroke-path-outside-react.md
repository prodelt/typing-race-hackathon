# The keystroke path lives outside React, read from beforeinput and compositionend

A hidden focused textarea is read through `beforeinput` and `compositionend`; `keydown` is used only for
timing and modifiers. No engine delivers a `keydown` for Cyrillic, Playwright cannot type Cyrillic
through its keyboard API, and Firefox ignores `preventDefault()` on `beforeinput` and delivers non-US
characters as IME compositions, so the engine commits on `compositionend` and clears the sink itself.
e2e specs drive `beforeinput`/`compositionend`; a physical ЙЦУКЕН layout needs CDP (Chromium-only).

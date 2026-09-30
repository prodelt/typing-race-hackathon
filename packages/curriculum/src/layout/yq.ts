import type { Key } from '@typing-race/domain'
import { commonKeys, key, LI, LM, LP, LR, RI, RM, RP, RR } from './key'

/**
 * ЙЦУКЕН. Physical order is left to right within each row; the Unlock Order and the vertical
 * generator both rely on it, so do not reorder.
 *
 * Finger assignments follow CONTEXT.md's Finger-to-Key Mapping. The keys the requirements omit but
 * §8.4 demands a finger for were decided in ticket 10 (grilling round 2):
 *  - apostrophe: the key left of `1`, where Windows "Ukrainian (Enhanced)" and Linux xkb both type
 *    U+0027 — left pinky;
 *  - `ґ`: the backslash key — right pinky;
 *  - hyphen: the key right of `0` — right pinky;
 *  - digits: classic assignment, left pinky on `1` through right pinky on `0`.
 * macOS puts `ґ` and the apostrophe elsewhere; correcting that is T037, and it is a change to this
 * data, never to code.
 *
 * Shifted punctuation is listed where the Ukrainian layout puts it: `"` on 2, `;` on 4, `:` on 6
 * and `,` on the `.` key. The other shifted digits are unsupported and no key produces them.
 */
export const yqKeys: readonly Key[] = [
  key('Backquote', 'digit', LP, "'", null, 'punctuation'),
  key('Digit1', 'digit', LP, '1', null, 'digit'),
  key('Digit2', 'digit', LR, '2', '"', 'digit'),
  key('Digit3', 'digit', LM, '3', null, 'digit'),
  key('Digit4', 'digit', LI, '4', ';', 'digit'),
  key('Digit5', 'digit', LI, '5', null, 'digit'),
  key('Digit6', 'digit', RI, '6', ':', 'digit'),
  key('Digit7', 'digit', RI, '7', null, 'digit'),
  key('Digit8', 'digit', RM, '8', null, 'digit'),
  key('Digit9', 'digit', RR, '9', null, 'digit'),
  key('Digit0', 'digit', RP, '0', null, 'digit'),
  key('Minus', 'digit', RP, '-', null, 'punctuation'),

  key('KeyQ', 'top', LP, 'й', 'Й'),
  key('KeyW', 'top', LR, 'ц', 'Ц'),
  key('KeyE', 'top', LM, 'у', 'У'),
  key('KeyR', 'top', LI, 'к', 'К'),
  key('KeyT', 'top', LI, 'е', 'Е'),
  key('KeyY', 'top', RI, 'н', 'Н'),
  key('KeyU', 'top', RI, 'г', 'Г'),
  key('KeyI', 'top', RM, 'ш', 'Ш'),
  key('KeyO', 'top', RR, 'щ', 'Щ'),
  key('KeyP', 'top', RP, 'з', 'З'),
  key('BracketLeft', 'top', RP, 'х', 'Х'),
  key('BracketRight', 'top', RP, 'ї', 'Ї'),
  // `ґ` is a letter, but it is filed as `punctuation` so the Unlock Order (R7 step 4) places it with
  // the extension keys, last, instead of among the letters by finger rank.
  key('Backslash', 'top', RP, 'ґ', 'Ґ', 'punctuation'),

  key('KeyA', 'home', LP, 'ф', 'Ф'),
  key('KeyS', 'home', LR, 'і', 'І'),
  key('KeyD', 'home', LM, 'в', 'В'),
  key('KeyF', 'home', LI, 'а', 'А'),
  key('KeyG', 'home', LI, 'п', 'П'),
  key('KeyH', 'home', RI, 'р', 'Р'),
  key('KeyJ', 'home', RI, 'о', 'О'),
  key('KeyK', 'home', RM, 'л', 'Л'),
  key('KeyL', 'home', RR, 'д', 'Д'),
  key('Semicolon', 'home', RP, 'ж', 'Ж'),
  key('Quote', 'home', RP, 'є', 'Є'),

  key('KeyZ', 'bottom', LP, 'я', 'Я'),
  key('KeyX', 'bottom', LR, 'ч', 'Ч'),
  key('KeyC', 'bottom', LM, 'с', 'С'),
  key('KeyV', 'bottom', LI, 'м', 'М'),
  key('KeyB', 'bottom', LI, 'и', 'И'),
  key('KeyN', 'bottom', RI, 'т', 'Т'),
  key('KeyM', 'bottom', RI, 'ь', 'Ь'),
  key('Comma', 'bottom', RM, 'б', 'Б'),
  key('Period', 'bottom', RR, 'ю', 'Ю'),
  key('Slash', 'bottom', RP, '.', ',', 'punctuation'),

  ...commonKeys,
]

/** `ФІВА ОЛДЖ`. */
export const yqAnchors: readonly string[] = ['ф', 'і', 'в', 'а', 'о', 'л', 'д', 'ж']

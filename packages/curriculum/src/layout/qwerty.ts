import type { Key } from '@typing-race/domain'
import { commonKeys, key, LI, LM, LP, LR, RI, RM, RP, RR } from './key'

/**
 * QWERTY. Physical order is left to right within each row; the Unlock Order and the vertical
 * generator both rely on it, so do not reorder.
 *
 * Shifted characters are listed only where the character is in the supported set (capitals, `:`
 * and `"`). `_` and the shifted digits are unsupported, so no key produces them and they cannot be
 * typed into an exercise.
 */
export const qwertyKeys: readonly Key[] = [
  key('Digit1', 'digit', LP, '1', null, 'digit'),
  key('Digit2', 'digit', LR, '2', null, 'digit'),
  key('Digit3', 'digit', LM, '3', null, 'digit'),
  key('Digit4', 'digit', LI, '4', null, 'digit'),
  key('Digit5', 'digit', LI, '5', null, 'digit'),
  key('Digit6', 'digit', RI, '6', null, 'digit'),
  key('Digit7', 'digit', RI, '7', null, 'digit'),
  key('Digit8', 'digit', RM, '8', null, 'digit'),
  key('Digit9', 'digit', RR, '9', null, 'digit'),
  key('Digit0', 'digit', RP, '0', null, 'digit'),
  key('Minus', 'digit', RP, '-', null, 'punctuation'),

  key('KeyQ', 'top', LP, 'q', 'Q'),
  key('KeyW', 'top', LR, 'w', 'W'),
  key('KeyE', 'top', LM, 'e', 'E'),
  key('KeyR', 'top', LI, 'r', 'R'),
  key('KeyT', 'top', LI, 't', 'T'),
  key('KeyY', 'top', RI, 'y', 'Y'),
  key('KeyU', 'top', RI, 'u', 'U'),
  key('KeyI', 'top', RM, 'i', 'I'),
  key('KeyO', 'top', RR, 'o', 'O'),
  key('KeyP', 'top', RP, 'p', 'P'),

  key('KeyA', 'home', LP, 'a', 'A'),
  key('KeyS', 'home', LR, 's', 'S'),
  key('KeyD', 'home', LM, 'd', 'D'),
  key('KeyF', 'home', LI, 'f', 'F'),
  key('KeyG', 'home', LI, 'g', 'G'),
  key('KeyH', 'home', RI, 'h', 'H'),
  key('KeyJ', 'home', RI, 'j', 'J'),
  key('KeyK', 'home', RM, 'k', 'K'),
  key('KeyL', 'home', RR, 'l', 'L'),
  key('Semicolon', 'home', RP, ';', ':', 'punctuation'),
  // Ticket 10: the apostrophe is on the right pinky in QWERTY, where it physically sits.
  key('Quote', 'home', RP, "'", '"', 'punctuation'),

  key('KeyZ', 'bottom', LP, 'z', 'Z'),
  key('KeyX', 'bottom', LR, 'x', 'X'),
  key('KeyC', 'bottom', LM, 'c', 'C'),
  key('KeyV', 'bottom', LI, 'v', 'V'),
  key('KeyB', 'bottom', LI, 'b', 'B'),
  key('KeyN', 'bottom', RI, 'n', 'N'),
  key('KeyM', 'bottom', RI, 'm', 'M'),
  key('Comma', 'bottom', RM, ',', null, 'punctuation'),
  key('Period', 'bottom', RR, '.', null, 'punctuation'),

  ...commonKeys,
]

/** `ASDF JKL;` — present from the first exercise, never "unlocked" later. */
export const qwertyAnchors: readonly string[] = ['a', 's', 'd', 'f', 'j', 'k', 'l', ';']

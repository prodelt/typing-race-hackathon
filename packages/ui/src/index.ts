/**
 * Public surface of @typing-race/ui: tokens, the three themes, primitives, icons and the motion
 * flag.
 *
 * The CSS entry points are separate imports, because a consumer that only wants a `Button` should
 * not pull in every token:
 *
 * ```ts
 * import '@typing-race/ui/tokens.css'
 * import '@typing-race/ui/themes.css'
 * ```
 */

export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  buttonClass,
} from './components/Button.js'
export { Card, type CardProps } from './components/Card.js'
export { Chip, type ChipProps, type ChipTone } from './components/Chip.js'
export { Field, type FieldProps } from './components/Field.js'
export { Index, type IndexProps } from './components/Index.js'
export {
  type GuideTier,
  Keycap,
  type KeycapProps,
} from './components/Keycap.js'
export { Wordmark, type WordmarkProps } from './components/Wordmark.js'
export { cx } from './cx.js'
export * from './icons/index.js'
export {
  allowsCelebration,
  allowsSound,
  currentMotion,
  motionAttribute,
  prefersReducedMotion,
  type ResolvedMotion,
  resolveMotion,
  watchMotion,
} from './motion.js'

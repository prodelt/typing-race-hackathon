/**
 * Public surface of @typing-race/ui — Serene Script.
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
} from './components/Button.js'
export { Card, type CardProps } from './components/Card.js'
export { Chip, type ChipProps, type ChipTone } from './components/Chip.js'
export { Field, type FieldProps } from './components/Field.js'
export {
  type GuideTier,
  Keycap,
  type KeycapProps,
} from './components/Keycap.js'
export { cx } from './cx.js'
export * from './icons/index.js'
export {
  allowsCelebration,
  allowsSound,
  motionAttribute,
  prefersReducedMotion,
  type ResolvedMotion,
  resolveMotion,
} from './motion.js'

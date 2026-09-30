// The layout vocabulary lives in `@typing-race/domain` so that `metrics` can share it without a
// package cycle. Re-exported here so the rest of this package has one place to import it from.
export type {
  Finger,
  FingerAssignment,
  Hand,
  Key,
  KeyKind,
  Layout,
  LayoutId,
  Row,
  Transition,
} from '@typing-race/domain'

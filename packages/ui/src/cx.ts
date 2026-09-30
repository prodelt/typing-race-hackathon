/**
 * Joins class names, dropping anything falsy.
 *
 * Deliberately not `clsx`: this is the whole of what the primitives need, and a dependency in the
 * initial bundle has to earn its place against ticket 15's 150 KB budget.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

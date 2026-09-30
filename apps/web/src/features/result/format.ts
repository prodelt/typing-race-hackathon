import { getLocale } from '../../paraglide/runtime.js'

/** One number formatter per call, in the interface language, so `96,7` and `96.7` follow it. */
export function number(value: number, digits = 0): string {
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** A difference with its sign written out, using a true minus (U+2212) rather than a hyphen. */
export function signed(value: number, digits = 0): string {
  const rounded = Number(value.toFixed(digits))
  if (rounded === 0) return number(0, digits)
  return `${rounded > 0 ? '+' : '\u2212'}${number(Math.abs(rounded), digits)}`
}

/** `m:ss,t`, for an attempt time that is usually seconds and occasionally minutes. */
export function duration(elapsedMs: number): string {
  const tenths = Math.round(elapsedMs / 100)
  const minutes = Math.floor(tenths / 600)
  const seconds = (tenths % 600) / 10
  const tail = number(seconds, 1)
  return `${minutes}:${seconds < 10 ? '0' : ''}${tail}`
}

import type { AttemptSummary } from '@typing-race/domain'
import { Index } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { number } from './format.js'
import { displayChar } from './model.js'

/** Past this many strokes a tally stops being countable at a glance; the text carries the rest. */
const TALLY_MAX = 20

/**
 * A count as tally marks, the way it would be kept on paper: four upright strokes and a fifth
 * across them. Each stroke is nudged a little so the group reads as drawn, not ruled; the nudges
 * come from the position, so the drawing is the same every time.
 */
function Tally({ count }: { readonly count: number }) {
  const shown = Math.min(count, TALLY_MAX)
  const groups = Math.ceil(shown / 5)
  const width = groups * 30
  const strokes: string[] = []
  for (let i = 0; i < shown; i++) {
    const group = Math.floor(i / 5)
    const inGroup = i % 5
    const x0 = group * 30 + 3
    const wobble = ((i * 7) % 3) - 1
    if (inGroup < 4) {
      const x = x0 + inGroup * 5.5
      strokes.push(`M${x + wobble * 0.4} ${2 + (inGroup % 2)} L${x - wobble * 0.3} ${22 - (i % 2)}`)
    } else {
      strokes.push(`M${x0 - 3} ${17 + wobble} L${x0 + 21} ${6 - wobble}`)
    }
  }
  return (
    <svg
      className="tally"
      width={width}
      height="24"
      viewBox={`0 0 ${width} 24`}
      aria-hidden="true"
      focusable="false"
    >
      {strokes.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="var(--color-terracotta)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

/**
 * The named error list: each wrong character with its count and its weight, the share of all
 * errors it accounts for. Weight is what tells the learner which one to fix first. The tally
 * repeats the count as a drawing, and the sentence beside it says it in words, so the picture is
 * never the only carrier of the figure.
 */
export function ErrorList({ attempt }: { readonly attempt: AttemptSummary }) {
  const entries = Object.entries(attempt.metrics.errorsByChar)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  const total = entries.reduce((sum, [, count]) => sum + count, 0)

  return (
    <section
      id="errors"
      data-section={m.result_errors_heading()}
      aria-labelledby="result-errors"
      className="result-sec"
    >
      <Index n={1} />
      <h2 id="result-errors" className="result-sec__title">
        {m.result_errors_heading()}
      </h2>
      {entries.length === 0 ? (
        <p className="result-sec__lede">{m.result_errors_none()}</p>
      ) : (
        <ul className="errs">
          {entries.map(([char, count]) => {
            const share = (count / total) * 100
            return (
              <li key={char} className="errs__item">
                <span className="errs__glyph">{displayChar(char)}</span>
                <span className="errs__body">
                  <Tally count={count} />
                  <span className="errs__text">
                    {count === 1
                      ? m.result_errors_item_one({ share: number(share) })
                      : m.result_errors_item({ count, share: number(share) })}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

import type { AttemptSummary } from '@typing-race/domain'
import { Card } from '@typing-race/ui'
import { m } from '../../paraglide/messages.js'
import { number } from './format.js'
import { displayChar } from './model.js'

/**
 * T102. The named error list: each wrong character with its count and its weight, the share of all
 * errors it accounts for. Weight is what tells the learner which one to fix first (FR-025). The
 * bar repeats the percentage in text, so it is never the only carrier of the figure.
 */
export function ErrorList({ attempt }: { readonly attempt: AttemptSummary }) {
  const entries = Object.entries(attempt.metrics.errorsByChar)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  const total = entries.reduce((sum, [, count]) => sum + count, 0)

  return (
    <Card aria-labelledby="result-errors" role="region" className="p-5">
      <h2 id="result-errors" className="font-ui text-lg font-bold">
        {m.result_errors_heading()}
      </h2>
      {entries.length === 0 ? (
        <p className="mt-2 font-ui">{m.result_errors_none()}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map(([char, count]) => {
            const share = (count / total) * 100
            return (
              <li key={char} className="flex items-center gap-3">
                <span className="w-16 text-center font-typing text-xl text-terracotta">
                  {displayChar(char)}
                </span>
                <span className="flex-1" aria-hidden="true">
                  <span className="block h-2 rounded-full bg-terracotta-tint">
                    <span
                      className="block h-2 rounded-full bg-terracotta"
                      style={{ width: `${share}%` }}
                    />
                  </span>
                </span>
                <span className="font-mono text-sm text-ink">
                  {count === 1
                    ? m.result_errors_item_one({ share: number(share) })
                    : m.result_errors_item({ count, share: number(share) })}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

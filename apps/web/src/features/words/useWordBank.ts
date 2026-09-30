import type { WordBank } from '@typing-race/curriculum'
import type { Language } from '@typing-race/domain'
import { useEffect, useState } from 'react'
import { loadWordBank } from '../../app/state/wordData.js'

export type BankState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly bank: WordBank }
  | { readonly status: 'error' }

/**
 * The typing language's Word Bank, fetched on first use. It is a lazy chunk (a few hundred KB of
 * JSON), so it never weighs on the first paint; `loadWordBank` caches the promise, so every screen
 * after the first gets it at once.
 */
export function useWordBank(language: Language): BankState {
  const [state, setState] = useState<{ language: Language; value: BankState }>({
    language,
    value: { status: 'loading' },
  })

  useEffect(() => {
    let live = true
    loadWordBank(language).then(
      (bank) => {
        if (live) setState({ language, value: { status: 'ready', bank } })
      },
      (error: unknown) => {
        console.error('The word bank could not be loaded', error)
        if (live) setState({ language, value: { status: 'error' } })
      },
    )
    return () => {
      live = false
    }
  }, [language])

  return state.language === language ? state.value : { status: 'loading' }
}

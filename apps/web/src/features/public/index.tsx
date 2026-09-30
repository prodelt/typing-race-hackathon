import { Link } from '@tanstack/react-router'
import { buttonClass, Index, Wordmark } from '@typing-race/ui'
import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'
import { GradLayer } from '../grad.js'
import { ScreenHead } from '../screen.js'
import './public.css'

/**
 * The three small public pages the footer links to. They are behind no sign-in, because the
 * product rule lists them alongside the product page and Formulas.
 *
 * Licences and Privacy are prose, set the way the brand site sets its "about" text: a head, then
 * the words as a large manifesto offset into the right-hand two thirds. About is the product's own
 * statement, on the brand's live red gradient with the wordmark across it, a full-bleed page like
 * the product page it points to.
 */

function Page({
  n,
  title,
  children,
}: {
  readonly n: number
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <article className="screen">
      <ScreenHead n={n} label={m.footer_nav()} title={title} dot />
      <div className="public">
        <div className="public__body">{children}</div>
      </div>
    </article>
  )
}

/**
 * Every third-party source the shipped app or its derived data rests on (requirements §5.4). Names,
 * licences and URLs are proper names and stay untranslated; only the "what for" is a message.
 */
const SOURCES = [
  {
    name: 'FrequencyWords (hermitdave/FrequencyWords, 2018)',
    licence: 'CC BY-SA 4.0 (content), MIT (code)',
    url: 'https://github.com/hermitdave/FrequencyWords',
    use: () => m.page_licences_frequency(),
  },
  {
    name: 'Hunspell uk — brown-uk/dict_uk',
    licence: 'GPL-3.0 (as packaged)',
    url: 'https://github.com/brown-uk/dict_uk',
    use: () => m.page_licences_hunspell_uk(),
  },
  {
    name: 'Hunspell en — SCOWL',
    licence: 'SCOWL licence (permissive, with notice), MIT (packaging)',
    url: 'https://github.com/wooorm/dictionaries',
    use: () => m.page_licences_hunspell_en(),
  },
  {
    name: 'dwyl/english-words',
    licence: 'Unlicense',
    url: 'https://github.com/dwyl/english-words',
    use: () => m.page_licences_dwyl(),
  },
  {
    name: 'Typing-Race 2026 (academy, knowledge, texts)',
    licence: 'used with the organisers’ permission',
    url: 'https://github.com/StsZu/Typing-race-2026',
    use: () => m.academy_licence_use(),
  },
  {
    name: 'Unbounded, Onest',
    licence: 'SIL Open Font License 1.1',
    url: 'https://openfontlicense.org',
    use: () => m.page_licences_fonts(),
  },
] as const

export function LicencesPage() {
  return (
    <Page n={6} title={m.page_licences_title()}>
      <p>{m.page_licences_body()}</p>
      <h2 className="font-ui text-xl font-bold">{m.page_licences_sources()}</h2>
      <ul className="flex flex-col gap-3">
        {SOURCES.map((source) => (
          <li key={source.name}>
            <a href={source.url} className="font-bold underline" rel="noreferrer">
              {source.name}
            </a>{' '}
            ({source.licence}) — {source.use()}
          </li>
        ))}
      </ul>
    </Page>
  )
}

export function PrivacyPage() {
  return (
    <Page n={7} title={m.page_privacy_title()}>
      <p>{m.page_privacy_body()}</p>
    </Page>
  )
}

export function AboutPage() {
  return (
    <article className="about gp-host gp-host--ember" aria-labelledby="about-title">
      <GradLayer tone="ember" seed={3} count={6} />
      <div className="about__inner">
        <Index n={1}>{m.footer_nav()}</Index>
        <div className="about__grid">
          <h1 id="about-title" className="about__title">
            {m.page_about_title()}
            <span className="red-dot about__dot" aria-hidden="true" />
          </h1>
          <div>
            <p className="about__text">{m.page_about_body()}</p>
            <div className="about__cta">
              <Link to="/" className={`${buttonClass('secondary', 'lg')} about__white`}>
                {m.product_cta_how()}
              </Link>
              <Link to="/formulas" className="ulink about__link">
                {m.product_audit_link()}
              </Link>
            </div>
          </div>
        </div>
        <div className="about__mark" aria-hidden="true">
          <Wordmark className="about__wordmark" />
        </div>
      </div>
    </article>
  )
}

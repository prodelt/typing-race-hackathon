import { m } from '../../paraglide/messages.js'

/**
 * The three small public pages the footer links to. They are behind no sign-in, in F1 and in every
 * later feature, because the product rule lists them alongside the product page and Formulas.
 *
 * They live together because each is a page of prose with no state, and three directories holding
 * one component apiece would be three places to forget.
 */

function Page({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="font-ui text-3xl font-bold">{title}</h1>
      <div className="mt-6 flex flex-col gap-4 font-ui leading-relaxed text-ink">{children}</div>
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
    name: 'Unbounded, Onest',
    licence: 'SIL Open Font License 1.1',
    url: 'https://openfontlicense.org',
    use: () => m.page_licences_fonts(),
  },
] as const

export function LicencesPage() {
  return (
    <Page title={m.page_licences_title()}>
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
    <Page title={m.page_privacy_title()}>
      <p>{m.page_privacy_body()}</p>
    </Page>
  )
}

export function AboutPage() {
  return (
    <Page title={m.page_about_title()}>
      <p>{m.page_about_body()}</p>
    </Page>
  )
}

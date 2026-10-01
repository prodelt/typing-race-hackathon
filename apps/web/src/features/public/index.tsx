import { Link } from '@tanstack/react-router'
import { m } from '../../paraglide/messages.js'
import { RefPage } from './RefPage.js'

/**
 * The small reference pages of the «Про гру» menu. They are behind no sign-in, in F1 and in every
 * later feature, because the product rule lists them alongside the product page and Formulas.
 *
 * They live together because each is a page of prose with no state, and three directories holding
 * one component apiece would be three places to forget. `RefPage` gives them the game frame's
 * reading layout, which Formulas shares.
 */

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
    <RefPage title={m.page_licences_title()} current="/licences">
      <p className="ref-lead">{m.page_licences_body()}</p>
      <h2 className="ref-h2">{m.page_licences_sources()}</h2>
      <ul className="ref-sources">
        {SOURCES.map((source) => (
          <li key={source.name} className="ref-source">
            <a href={source.url} className="ref-source__name" rel="noreferrer">
              {source.name}
            </a>
            <span className="ref-source__licence">{source.licence}</span>
            <span className="ref-source__use">{source.use()}</span>
          </li>
        ))}
      </ul>
    </RefPage>
  )
}

export function PrivacyPage() {
  return (
    <RefPage title={m.page_privacy_title()} current="/privacy">
      <p className="ref-lead">{m.page_privacy_body()}</p>
      <section className="ref-section" aria-labelledby="privacy-local">
        <h2 className="ref-h2" id="privacy-local">
          {m.page_privacy_local_title()}
        </h2>
        <p className="ref-p">{m.page_privacy_local()}</p>
      </section>
      <section className="ref-section" aria-labelledby="privacy-server">
        <h2 className="ref-h2" id="privacy-server">
          {m.page_privacy_server_title()}
        </h2>
        <p className="ref-p">{m.page_privacy_server()}</p>
      </section>
    </RefPage>
  )
}

export function AboutPage() {
  const stages = [m.page_about_stage_1(), m.page_about_stage_2(), m.page_about_stage_3()]
  return (
    <RefPage title={m.page_about_title()} current="/about/project">
      <p className="ref-lead">{m.page_about_body()}</p>
      <section className="ref-section" aria-labelledby="about-stages">
        <h2 className="ref-h2" id="about-stages">
          {m.page_about_stages_title()}
        </h2>
        <ol className="ref-steps">
          {stages.map((stage, i) => (
            <li key={stage} className="ref-step">
              <span className="ref-step__n">{String(i + 1).padStart(2, '0')}</span>
              <span>{stage}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="ref-section" aria-labelledby="about-rule">
        <h2 className="ref-h2" id="about-rule">
          {m.page_about_rule_title()}
        </h2>
        <p className="ref-p">{m.page_about_rule()}</p>
        <p className="ref-p ref-more">
          <Link to="/formulas">{m.shell_menu_formulas()} →</Link>
        </p>
      </section>
    </RefPage>
  )
}

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

export function LicencesPage() {
  return (
    <Page title={m.page_licences_title()}>
      <p>{m.page_licences_body()}</p>
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

import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { ProductPage } from './ProductPage.js'

describe('ProductPage', () => {
  it('renders with no props, under exactly one h1', () => {
    render(<ProductPage />)
    // The `main` landmark belongs to the app shell, which wraps every route once;
    // a page that declared its own would give the document two.
    expect(screen.queryAllByRole('main')).toHaveLength(0)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.product_h1())
  })

  it('names the three stages in order', () => {
    render(<ProductPage />)
    const stages = screen.getByRole('region', { name: m.product_stages_title() })
    const items = within(stages).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent(m.product_stage1_title())
    expect(items[1]).toHaveTextContent(m.product_stage2_title())
    expect(items[2]).toHaveTextContent(m.product_stage3_title())
  })

  it('offers the way into practice and to the formulas', () => {
    render(<ProductPage practiceHref="/go" formulasHref="/f" />)
    expect(screen.getByRole('link', { name: m.product_cta_start() })).toHaveAttribute('href', '/go')
    for (const link of screen.getAllByRole('link', {
      name: new RegExp(`${m.product_cta_formulas()}|${m.product_open_link()}`),
    })) {
      expect(link).toHaveAttribute('href', '/f')
    }
  })

  it('keeps heading levels in order without skipping', () => {
    render(<ProductPage />)
    const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName.slice(1)))
    for (const [i, level] of levels.entries()) {
      if (i > 0) expect(level - (levels[i - 1] ?? 0)).toBeLessThanOrEqual(1)
    }
  })
})

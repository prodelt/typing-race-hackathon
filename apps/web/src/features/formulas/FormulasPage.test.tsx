import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { m } from '../../paraglide/messages.js'
import { FormulasPage } from './FormulasPage.js'

describe('FormulasPage', () => {
  it('renders with no props and no store, under exactly one h1', () => {
    render(<FormulasPage />)
    // The `main` landmark belongs to the app shell, which wraps every route once;
    // a page that declared its own would give the document two.
    expect(screen.queryAllByRole('main')).toHaveLength(0)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.formulas_page_title())
  })

  it('states speed, WPM as SPM / 5 marked secondary, and accuracy exactly', () => {
    render(<FormulasPage />)
    expect(screen.getByRole('heading', { name: m.formulas_spm_title() })).toBeInTheDocument()
    expect(screen.getByText(/SPM = characterKeystrokes/)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: new RegExp(m.formulas_wpm_title()) }),
    ).toBeInTheDocument()
    expect(screen.getByText('WPM = SPM / 5')).toBeInTheDocument()
    expect(screen.getByText(m.formulas_secondary())).toBeInTheDocument()
    expect(screen.getByText(/accuracy = correctCharKeystrokes/)).toBeInTheDocument()
    expect(screen.getByText(m.formulas_accuracy_corrected())).toBeInTheDocument()
    expect(screen.getByText(m.formulas_accuracy_backspace())).toBeInTheDocument()
  })

  it('gives both row-change readings and says which one is counted', () => {
    render(<FormulasPage />)
    expect(screen.getByRole('heading', { name: m.formulas_rowa_title() })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: m.formulas_rowb_title() })).toBeInTheDocument()
    expect(screen.getByText(m.formulas_row_counted_body())).toBeInTheDocument()
    expect(screen.getByText(m.formulas_row_ambiguity())).toBeInTheDocument()
    expect(screen.getByText(m.formulas_row_example_a())).toBeInTheDocument()
    expect(screen.getByText(m.formulas_row_example_b())).toBeInTheDocument()
  })

  it('publishes the level table, the mastery rule and Stage 1 completion', () => {
    render(<FormulasPage />)
    const table = screen.getByRole('table', { name: m.formulas_levels_caption() })
    expect(table).toHaveTextContent('95 %')
    expect(table).toHaveTextContent('98 %')
    expect(screen.getByText(/mastered ⇔ last 3 test attempts/)).toBeInTheDocument()
    expect(screen.getByText(/stage1Complete/)).toBeInTheDocument()
    expect(screen.getByText(m.formulas_speed_gates_body())).toBeInTheDocument()
  })

  it('defines rhythm consistency and confidence, and says confidence gates nothing', () => {
    render(<FormulasPage />)
    expect(screen.getByText(/rhythmConsistency = 100 × max\(0, 1 − cv\)/)).toBeInTheDocument()
    expect(screen.getByText(/speedFactor = min\(1, 400 \/ meanIki\)/)).toBeInTheDocument()
    expect(screen.getByText(m.formulas_conf_gates_head())).toBeInTheDocument()
    expect(screen.getByText(m.formulas_conf_gates_body())).toBeInTheDocument()
  })

  it('keeps heading levels in order without skipping', () => {
    render(<FormulasPage />)
    const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName.slice(1)))
    expect(levels[0]).toBe(1)
    for (const [i, level] of levels.entries()) {
      if (i > 0) expect(level - (levels[i - 1] ?? 0)).toBeLessThanOrEqual(1)
    }
  })
})

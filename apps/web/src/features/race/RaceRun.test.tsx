import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RaceRun } from './RaceRun.js'

const TEXT = 'Київ стоїть на пагорбах'

function mount(live: boolean, language: 'uk' | 'en' = 'uk') {
  const noop = () => {}
  return render(
    <RaceRun
      text={TEXT}
      language={language}
      live={live}
      sizePx={32}
      onProgress={noop}
      onFinish={noop}
      onIdle={noop}
    />,
  )
}

function type(chars: string): void {
  const input = screen.getByTestId('typing-input')
  for (const char of chars) {
    act(() => {
      input.dispatchEvent(
        new window.InputEvent('beforeinput', {
          inputType: 'insertText',
          data: char,
          bubbles: true,
          cancelable: true,
        }),
      )
    })
  }
}

describe('RaceRun on the wrong Active layout', () => {
  it('says why the line is not moving after three letters of another layout', () => {
    // The reported bug: in a Ukrainian race with the US layout every key is a silent error, the
    // line never moves and nothing says why.
    mount(true)
    expect(screen.queryByTestId('race-layout-notice')).toBeNull()

    type('he')
    expect(screen.queryByTestId('race-layout-notice')).toBeNull()

    type('l')
    const notice = screen.getByRole('alert')
    expect(notice.getAttribute('data-testid')).toBe('race-layout-notice')
    expect(notice.textContent).toContain('ЙЦУКЕН')
  })

  it('takes the warning away once the learner types the layout it asked for', () => {
    mount(true)
    type('hel')
    expect(screen.queryByRole('alert')).not.toBeNull()

    type('К')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not warn about a slip: two stray letters and then the right one', () => {
    mount(true)
    type('hlК')
    expect(screen.queryByTestId('race-layout-notice')).toBeNull()
  })

  it('warns an English race about Cyrillic letters', () => {
    mount(true, 'en')
    type('при')
    expect(screen.getByRole('alert').textContent).toContain('QWERTY')
  })

  it('hears letters typed during the countdown, and still keeps them away from the engine', () => {
    // Pre-start detection that works in every browser: the learner taps a key and is told, before
    // the race can count a single error.
    mount(false)
    type('hel')
    expect(screen.getByRole('alert').textContent).toContain('ЙЦУКЕН')
    expect(screen.getByTestId('typing-line').getAttribute('data-state')).toBe('idle')
  })

  it('tells the learner, calmly, which layout the race needs while the countdown runs', () => {
    mount(false)
    expect(screen.getByRole('status').textContent).toContain('ЙЦУКЕН')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('confirms the layout once a letter of it is typed during the countdown', () => {
    mount(false)
    type('К')
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('підтверджено')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  describe('with a keyboard map', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'keyboard')
    afterEach(() => {
      if (original) Object.defineProperty(navigator, 'keyboard', original)
      else Reflect.deleteProperty(navigator, 'keyboard')
    })

    function stubMap(entries: [string, string][]) {
      Object.defineProperty(navigator, 'keyboard', {
        configurable: true,
        value: { getLayoutMap: () => Promise.resolve(new Map(entries)) },
      })
    }

    it('warns before the start when an English race meets a machine with no Latin layout', async () => {
      stubMap([
        ['KeyF', 'а'],
        ['KeyS', 'і'],
      ])
      mount(false, 'en')
      const notice = await screen.findByRole('alert')
      expect(notice.textContent).toContain('QWERTY')
    })

    it('stays quiet on a Latin map: it cannot say Ukrainian is not active', async () => {
      // getLayoutMap() returns the highest-priority Latin layout, so a US+Ukrainian machine reports
      // «f» while Ukrainian is active. Warning here would be a false alarm for most learners.
      stubMap([
        ['KeyF', 'f'],
        ['KeyS', 's'],
      ])
      mount(false)
      await act(async () => {})
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })
})

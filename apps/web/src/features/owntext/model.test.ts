import { describe, expect, it } from 'vitest'
import { lastOwnText, ownTextWording, rememberOwnText } from './model.js'

describe('own text', () => {
  it('remembers the last text for its layout only', () => {
    expect(lastOwnText('yq')).toBeNull()
    rememberOwnText({ text: 'фі ва', cut: false, layoutId: 'yq' })
    expect(lastOwnText('yq')?.text).toBe('фі ва')
    expect(lastOwnText('qwerty')).toBeNull()
  })

  it('names a cut text on the pre-start card, with the length kept', () => {
    const cut = ownTextWording({ text: 'фіва олдж.', cut: true, layoutId: 'yq' })
    expect(cut.notice).toMatch(/10/)
    expect(ownTextWording({ text: 'фіва', cut: false, layoutId: 'yq' }).notice).toBeUndefined()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { type RematchBackend, readInvite, rematch, rematchPlan } from './rematch.js'

const quickRoom = { visibility: 'quick', language: 'uk' } as const
const privateRoom = { visibility: 'private', language: 'en' } as const
const olyaInvite = { code: 'K7M2PQ', from: 'Оля' }

describe('rematchPlan: where «Ще заїзд» sends the learner', () => {
  it('sends a quick-match racer into the next quick match, as before', () => {
    expect(rematchPlan(quickRoom, null)).toEqual({ kind: 'quick', language: 'uk' })
  })

  it('never takes a private room into public quick match: the first to ask opens the next room', () => {
    expect(rematchPlan(privateRoom, null)).toEqual({ kind: 'host', language: 'en' })
  })

  it('follows a friend who already opened the next room instead of opening another', () => {
    expect(rematchPlan(privateRoom, olyaInvite)).toEqual({
      kind: 'join',
      code: 'K7M2PQ',
      from: 'Оля',
      language: 'en',
    })
  })

  it('ignores an invite in a quick match, where nobody sends one', () => {
    expect(rematchPlan(quickRoom, olyaInvite)).toEqual({ kind: 'quick', language: 'uk' })
  })
})

describe('readInvite: what another racer broadcast, checked before it is shown or followed', () => {
  it('reads a code and a name', () => {
    expect(readInvite({ code: 'k7m2pq', from: '  Оля ' })).toEqual(olyaInvite)
  })

  it.each([
    null,
    'K7M2PQ',
    {},
    { code: 'K7M2PQ' },
    { code: 'K7M2PQ', from: '' },
    { code: 'K7M2PQ', from: 42 },
    { code: 'K7M2', from: 'Оля' },
    { code: 'K7M2PQ/../x', from: 'Оля' },
  ])('refuses %j', (payload) => {
    expect(readInvite(payload)).toBeNull()
  })

  it('keeps a long name to the 32 characters a nick may have', () => {
    expect(readInvite({ code: 'K7M2PQ', from: 'я'.repeat(80) })?.from).toBe('я'.repeat(32))
  })
})

function fakeBackend(overrides: Partial<RematchBackend> = {}) {
  const calls: string[] = []
  const backend: RematchBackend = {
    quickMatch: vi.fn(async (language) => {
      calls.push(`quickMatch ${language}`)
      return 'quick-room'
    }),
    createPrivateRoom: vi.fn(async (language) => {
      calls.push(`createPrivateRoom ${language}`)
      return { roomId: 'new-room', code: 'NEW234' }
    }),
    joinByCode: vi.fn(async (code) => {
      calls.push(`joinByCode ${code}`)
      return 'friend-room'
    }),
    ...overrides,
  }
  const announce = vi.fn(async (invite: { code: string; from: string }) => {
    calls.push(`announce ${invite.code} from ${invite.from}`)
  })
  return { backend, announce, calls }
}

describe('rematch: carrying the plan out', () => {
  it('quick-matches a quick-match racer and tells nobody', async () => {
    const { backend, announce, calls } = fakeBackend()
    const roomId = await rematch({ kind: 'quick', language: 'uk' }, { backend, announce, me: 'Ія' })
    expect(roomId).toBe('quick-room')
    expect(calls).toEqual(['quickMatch uk'])
  })

  it('opens a private room and tells the old room its code before leaving for it', async () => {
    const { backend, announce, calls } = fakeBackend()
    const roomId = await rematch({ kind: 'host', language: 'en' }, { backend, announce, me: 'Ія' })
    expect(roomId).toBe('new-room')
    expect(calls).toEqual(['createPrivateRoom en', 'announce NEW234 from Ія'])
  })

  it('joins the room a friend opened', async () => {
    const { backend, announce, calls } = fakeBackend()
    const roomId = await rematch(
      { kind: 'join', code: 'K7M2PQ', from: 'Оля', language: 'en' },
      { backend, announce, me: 'Ія' },
    )
    expect(roomId).toBe('friend-room')
    expect(calls).toEqual(['joinByCode K7M2PQ'])
  })

  it('opens its own room when the friend’s can no longer be joined', async () => {
    const { backend, announce, calls } = fakeBackend({
      joinByCode: vi.fn(async () => {
        throw new Error('no room with that code')
      }),
    })
    const roomId = await rematch(
      { kind: 'join', code: 'K7M2PQ', from: 'Оля', language: 'en' },
      { backend, announce, me: 'Ія' },
    )
    expect(roomId).toBe('new-room')
    expect(calls).toEqual(['createPrivateRoom en', 'announce NEW234 from Ія'])
  })

  it('still goes to its new room when telling the others fails', async () => {
    const { backend } = fakeBackend()
    const announce = vi.fn(async () => {
      throw new Error('channel closed')
    })
    const roomId = await rematch({ kind: 'host', language: 'en' }, { backend, announce, me: 'Ія' })
    expect(roomId).toBe('new-room')
    expect(announce).toHaveBeenCalledOnce()
  })
})

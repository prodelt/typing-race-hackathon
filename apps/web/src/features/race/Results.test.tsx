import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RaceBackend, RematchInvite, RoomSnapshot } from '../../sync/race.js'
import { Results } from './Results.js'

const navigate = vi.fn(async (_to: unknown) => {})
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

afterEach(() => navigate.mockReset())

/** A race this learner has finished while a friend is still typing (so no rating is fetched). */
function room(visibility: RoomSnapshot['visibility']): RoomSnapshot {
  return {
    id: 'old-room',
    state: 'running',
    visibility,
    joinCode: visibility === 'private' ? 'OLD234' : null,
    language: 'uk',
    hostId: 'me',
    createdAt: '2026-10-06T10:00:00.000Z',
    startsAt: '2026-10-06T10:00:10.000Z',
    deadline: null,
    text: 'Київ стоїть на пагорбах',
    me: 'me',
    participants: [
      { userId: 'me', nickname: 'Ія', role: 'racer', joinedAt: '2026-10-06T10:00:00.000Z' },
      { userId: 'olya', nickname: 'Оля', role: 'racer', joinedAt: '2026-10-06T10:00:01.000Z' },
    ],
    results: [
      {
        userId: 'me',
        nickname: 'Ія',
        spm: 210,
        accuracy: 0.97,
        score: 200,
        validated: true,
        reason: null,
        finishedAt: '2026-10-06T10:01:00.000Z',
      },
    ],
    offsetMs: 0,
  }
}

function fakeBackend() {
  return {
    quickMatch: vi.fn(async () => 'quick-room'),
    createPrivateRoom: vi.fn(async () => ({ roomId: 'new-room', code: 'NEW234' })),
    joinByCode: vi.fn(async () => 'friend-room'),
  }
}

function show(visibility: RoomSnapshot['visibility'], invite: RematchInvite | null = null) {
  const backend = fakeBackend()
  const announce = vi.fn(async (_invite: RematchInvite) => {})
  render(
    <Results
      backend={backend as unknown as RaceBackend}
      snapshot={room(visibility)}
      mine={{ kind: 'none' }}
      lanes={[]}
      invite={invite}
      announce={announce}
    />,
  )
  return { backend, announce }
}

const wentTo = (roomId: string) => ({ to: '/races/room/$roomId', params: { roomId } })

describe('«Ще заїзд» on the results', () => {
  it('goes into the next quick match after a quick match, as before', async () => {
    const { backend, announce } = show('quick')
    expect(screen.queryByTestId('race-again-note')).toBeNull()

    await userEvent.click(screen.getByTestId('race-again'))

    expect(backend.quickMatch).toHaveBeenCalledWith('uk')
    expect(announce).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith(wentTo('quick-room'))
  })

  it('after a private room, opens a new private room and calls the friends, never quick match', async () => {
    const { backend, announce } = show('private')
    expect(screen.getByTestId('race-again').textContent).toContain('Ще заїзд')
    expect(screen.getByTestId('race-again-note').textContent).toContain('нову кімнату')

    await userEvent.click(screen.getByTestId('race-again'))

    expect(backend.quickMatch).not.toHaveBeenCalled()
    expect(backend.createPrivateRoom).toHaveBeenCalledWith('uk')
    expect(announce).toHaveBeenCalledWith({ code: 'NEW234', from: 'Ія' })
    expect(navigate).toHaveBeenCalledWith(wentTo('new-room'))
  })

  it('after a friend opened the next room, Enter follows them there', async () => {
    const { backend, announce } = show('private', { code: 'K7M2PQ', from: 'Оля' })
    expect(screen.getByTestId('race-again').textContent).toContain('Приєднатися')
    expect(screen.getByTestId('race-again-note').textContent).toContain('Оля кличе всіх')

    await userEvent.keyboard('{Enter}')

    expect(backend.joinByCode).toHaveBeenCalledWith('K7M2PQ')
    expect(backend.createPrivateRoom).not.toHaveBeenCalled()
    expect(backend.quickMatch).not.toHaveBeenCalled()
    expect(announce).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith(wentTo('friend-room'))
  })
})

import type { Language } from '@typing-race/domain'
import type { RaceBackend, RematchInvite, RoomSnapshot } from '../../sync/race.js'

/**
 * «Ще заїзд»: where the next race is. A quick match goes back into quick match. A private room
 * keeps its friends together: whoever asks first opens a new private room and tells the old one its
 * code over the room's channel; everyone who asks after that follows the code instead of opening a
 * room of their own. A private room never lands anyone in public quick match.
 */
export type RematchPlan =
  | { readonly kind: 'quick'; readonly language: Language }
  | { readonly kind: 'host'; readonly language: Language }
  | {
      readonly kind: 'join'
      readonly code: string
      readonly from: string
      /** For a new room of one's own, when the friend's can no longer be joined. */
      readonly language: Language
    }

export function rematchPlan(
  room: Pick<RoomSnapshot, 'visibility' | 'language'>,
  invite: RematchInvite | null,
): RematchPlan {
  if (room.visibility === 'quick') return { kind: 'quick', language: room.language }
  if (invite === null) return { kind: 'host', language: room.language }
  return { kind: 'join', code: invite.code, from: invite.from, language: room.language }
}

const CODE = /^[A-Z0-9]{6}$/
const NAME_MAX = 32

/**
 * An invite as another racer broadcast it, or `null`. Anyone in the room can send anything on its
 * channel, so it is checked before its name is shown or its code is followed.
 */
export function readInvite(payload: unknown): RematchInvite | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { code, from } = payload as Record<string, unknown>
  if (typeof code !== 'string' || typeof from !== 'string') return null
  const clean = code.trim().toUpperCase()
  const name = Array.from(from.trim()).slice(0, NAME_MAX).join('')
  if (!CODE.test(clean) || name === '') return null
  return { code: clean, from: name }
}

export type RematchBackend = Pick<RaceBackend, 'quickMatch' | 'createPrivateRoom' | 'joinByCode'>

/** Carries the plan out and answers the room to go to. */
export async function rematch(
  plan: RematchPlan,
  {
    backend,
    announce,
    me,
  }: {
    readonly backend: RematchBackend
    /** Tells everyone still in the old room where the next race is. */
    readonly announce: (invite: RematchInvite) => Promise<void>
    /** This racer's name, as the invite will show it. */
    readonly me: string
  },
): Promise<string> {
  if (plan.kind === 'quick') return backend.quickMatch(plan.language)
  if (plan.kind === 'join') {
    try {
      return await backend.joinByCode(plan.code)
    } catch {
      // The friend's room went (or filled up): open the next one here rather than strand anyone.
    }
  }
  const room = await backend.createPrivateRoom(plan.language)
  // The new room's code is on its own screen too, so a lost message only costs reading it aloud.
  await announce({ code: room.code, from: me }).catch(() => undefined)
  return room.roomId
}

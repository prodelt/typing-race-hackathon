import { Link } from '@tanstack/react-router'
import { buttonClass } from '@typing-race/ui'
import { type ReactNode, useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { GroupError, type GroupsBackend, groupsBackend } from '../../sync/groups.js'
import type { Identity } from '../../sync/race.js'
import './community.css'

/**
 * What the groups and leaderboards screens share: the backend (or a calm "unavailable"), the
 * learner's race identity, and the error copy.
 */

type Status =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'ready'; readonly backend: GroupsBackend }

export function WithGroups({
  children,
}: {
  readonly children: (backend: GroupsBackend) => ReactNode
}) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  useEffect(() => {
    let live = true
    void groupsBackend().then((backend) => {
      if (live) setStatus(backend === null ? { kind: 'unavailable' } : { kind: 'ready', backend })
    })
    return () => {
      live = false
    }
  }, [])

  if (status.kind === 'loading') {
    return (
      <div className="cm-calm" aria-busy="true">
        <p className="cm-lede">{m.community_loading()}</p>
      </div>
    )
  }
  if (status.kind === 'unavailable') {
    return (
      <div className="cm-calm" data-testid="community-unavailable">
        <h1 className="cm-display cm-calm__title">{m.community_unavailable_title()}</h1>
        <p className="cm-lede">{m.community_unavailable()}</p>
        <Link to="/" className={buttonClass('primary', 'md')}>
          {m.community_unavailable_action()}
        </Link>
      </div>
    )
  }
  return <>{children(status.backend)}</>
}

/** A display name the server will accept: 2 to 32 characters after trimming. */
export function validName(name: string): boolean {
  const length = [...name.trim()].length
  return length >= 2 && length <= 32
}

export function describe(caught: unknown): string {
  if (caught instanceof GroupError) {
    if (caught.code === 'no_group') return m.groups_error_no_group()
    if (caught.code === 'not_member') return m.group_not_member()
    if (caught.code === 'invalid_name') return m.groups_name_invalid()
  }
  return m.community_error_generic()
}

/**
 * The race identity: restored from the stored session, or created with the typed name right
 * before the first thing that needs it (creating or joining a group).
 */
export function useIdentity(backend: GroupsBackend): {
  identity: Identity | null
  name: string
  setName(name: string): void
  ensure(): Promise<Identity>
} {
  const race = backend.race
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [name, setName] = useState(() => race.rememberedName())

  useEffect(() => {
    let live = true
    void race.identity().then((found) => {
      if (!live || found === null) return
      setIdentity(found)
      setName(found.nickname)
    })
    return () => {
      live = false
    }
  }, [race])

  const ensure = async (): Promise<Identity> => {
    const wanted = name.trim()
    let current = identity ?? (await race.identity())
    if (current === null) current = await race.signIn(wanted)
    else if (current.nickname !== wanted && !current.nickname.startsWith(`${wanted}-`)) {
      current = await race.rename(wanted)
    }
    setIdentity(current)
    setName(current.nickname)
    return current
  }

  return { identity, name, setName, ensure }
}

export function inviteLink(code: string): string {
  return `${globalThis.location.origin}/groups/join/${code}`
}

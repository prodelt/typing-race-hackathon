import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Button, buttonClass, cx, Field, Index } from '@typing-race/ui'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import type { GroupSnapshot, GroupSummary, GroupsBackend } from '../../sync/groups.js'
import { describe, inviteLink, useIdentity, validName, WithGroups } from './shared.js'

/**
 * Groups: create one and get a code, join one by code or by link, see who is in it. The router
 * imports these three names lazily, so none of this, nor the Supabase client, is in the entry.
 */

const CODE = /^[A-Z0-9]{6}$/

export function GroupsScreen() {
  return <WithGroups>{(backend) => <Groups backend={backend} />}</WithGroups>
}

export function GroupScreen() {
  const { groupId } = useParams({ strict: false }) as { groupId: string }
  return (
    <WithGroups>
      {(backend) => <Group key={groupId} backend={backend} groupId={groupId} />}
    </WithGroups>
  )
}

export function GroupJoinScreen() {
  const { code } = useParams({ strict: false }) as { code: string }
  return (
    <WithGroups>{(backend) => <Join backend={backend} code={code.toUpperCase()} />}</WithGroups>
  )
}

// ---------------------------------------------------------------------------------------------
// The index: who you are, create, join, and your groups
// ---------------------------------------------------------------------------------------------

function Groups({ backend }: { readonly backend: GroupsBackend }) {
  const navigate = useNavigate()
  const { identity, name, setName, ensure } = useIdentity(backend)
  const [groupName, setGroupName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mine, setMine] = useState<readonly GroupSummary[] | null>(null)

  // Re-read once the stored session has been restored: before that, nobody is signed in.
  const signedIn = identity?.userId
  useEffect(() => {
    let live = true
    if (signedIn === undefined) setMine(null)
    backend
      .myGroups()
      .then((groups) => live && setMine(groups))
      .catch(() => live && setMine([]))
    return () => {
      live = false
    }
  }, [backend, signedIn])

  const run = async (kind: 'create' | 'join', go: () => Promise<string>) => {
    setError(null)
    if (!validName(name)) return setError(m.community_name_invalid())
    setBusy(kind)
    try {
      await ensure()
      const groupId = await go()
      await navigate({ to: '/groups/$groupId', params: { groupId } })
    } catch (caught) {
      setError(describe(caught))
      setBusy(null)
    }
  }

  const create = (event: FormEvent) => {
    event.preventDefault()
    const clean = groupName.trim()
    if ([...clean].length < 2 || [...clean].length > 64) return setError(m.groups_name_invalid())
    void run('create', async () => (await backend.createGroup(clean)).groupId)
  }

  const join = (event: FormEvent) => {
    event.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!CODE.test(clean)) return setError(m.groups_code_invalid())
    void run('join', () => backend.joinGroup(clean))
  }

  // A learner who already belongs somewhere sees their groups first; the ways in follow.
  const returning = mine !== null && mine.length > 0
  const mineSection = (
    <section className="cm-mine" aria-labelledby="cm-mine">
      <h2 id="cm-mine" className="cm-section-title">
        {m.groups_mine_title()}
      </h2>
      {mine === null ? (
        <div className="cm-skeleton" />
      ) : mine.length === 0 ? (
        <p className="cm-note">{m.groups_mine_empty()}</p>
      ) : (
        <ol className="cm-list">
          {mine.map((group, index) => (
            <li key={group.id}>
              <Link
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                className="cm-list__row"
                data-testid="my-group"
              >
                <span className="cm-list__n">[{String(index + 1).padStart(2, '0')}]</span>
                <span className="cm-list__name">{group.name}</span>
                <span className="cm-list__meta">
                  {group.role === 'owner' ? (
                    <span className="cm-tag">{m.groups_role_owner()}</span>
                  ) : null}
                  {m.groups_members_count({ count: group.members })}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )

  return (
    <div className="cm-page">
      <header className="cm-head">
        <h1 className="cm-display cm-head__title">{m.groups_title()}</h1>
        <p className="cm-lede">{m.groups_lede()}</p>
      </header>

      {returning ? mineSection : null}

      <div className="cm-name">
        <Field
          label={m.community_name_label()}
          hint={m.community_name_hint()}
          value={name}
          maxLength={32}
          autoComplete="nickname"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="cm-ways">
        <form className="cm-way cm-way--lead" onSubmit={create} aria-labelledby="cm-create">
          <Index n={1}>{m.groups_create_index()}</Index>
          <h2 id="cm-create" className="cm-way__title">
            {m.groups_create_title()}
          </h2>
          <div className="cm-way__row">
            <Field
              label={m.groups_create_label()}
              value={groupName}
              maxLength={64}
              autoComplete="off"
              onChange={(event) => setGroupName(event.target.value)}
            />
            <Button type="submit" variant="primary" size="lg" disabled={busy !== null}>
              {busy === 'create' ? m.groups_create_busy() : m.groups_create_action()}
            </Button>
          </div>
        </form>

        <form className="cm-way" onSubmit={join} aria-labelledby="cm-join">
          <Index n={2}>{m.groups_join_index()}</Index>
          <h2 id="cm-join" className="cm-way__title">
            {m.groups_join_title()}
          </h2>
          <div className="cm-way__row">
            <Field
              label={m.groups_code_label()}
              value={code}
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
              className="cm-code-input"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <Button type="submit" variant="secondary" size="lg" disabled={busy !== null}>
              {busy === 'join' ? m.groups_join_busy() : m.groups_join_action()}
            </Button>
          </div>
        </form>
      </div>

      {error === null ? null : (
        <p role="alert" className="cm-error">
          {error}
        </p>
      )}

      {returning ? null : mineSection}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// One group
// ---------------------------------------------------------------------------------------------

function Group({
  backend,
  groupId,
}: {
  readonly backend: GroupsBackend
  readonly groupId: string
}) {
  const navigate = useNavigate()
  const [group, setGroup] = useState<GroupSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setGroup(await backend.group(groupId))
      setError(null)
    } catch (caught) {
      setError(describe(caught))
    }
  }, [backend, groupId])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (go: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await go()
      await load()
    } catch (caught) {
      setError(describe(caught))
    } finally {
      setBusy(false)
    }
  }

  if (group === null) {
    return error === null ? (
      <div className="cm-page" aria-busy="true">
        <div className="cm-skeleton cm-skeleton--panel" />
      </div>
    ) : (
      <div className="cm-calm">
        <p role="alert" className="cm-lede">
          {error}
        </p>
        <Link to="/groups" className={buttonClass('secondary', 'md')}>
          {m.group_back()}
        </Link>
      </div>
    )
  }

  const owner = group.ownerId === group.me
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(group.joinCode))
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="cm-page">
      <Link to="/groups" className="cm-back">
        {m.group_back()}
      </Link>

      <section className="cm-panel" aria-labelledby="cm-group-name">
        <div className="cm-panel__main">
          <h1 id="cm-group-name" className="cm-display cm-panel__title" data-testid="group-name">
            {group.name}
          </h1>
          <p className="cm-panel__meta">
            {m.groups_members_count({ count: group.members.length })}
          </p>
        </div>
        <div className="cm-panel__code">
          <p className="cm-panel__label">{m.group_code_label()}</p>
          <p className="cm-panel__codeval" data-testid="group-code">
            {group.joinCode}
          </p>
          <div className="cm-panel__actions">
            <button type="button" className="cm-onred" onClick={() => void copy()}>
              {copied ? m.group_copied() : m.group_copy_link()}
            </button>
            {owner ? (
              <button
                type="button"
                className="cm-onred cm-onred--quiet"
                title={m.group_regenerate_hint()}
                disabled={busy}
                onClick={() => void act(() => backend.regenerateCode(group.id))}
              >
                {m.group_regenerate()}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="cm-members">
        <h2 id="cm-members" className="cm-section-title">
          {m.group_members_title()}
        </h2>
        <ol className="cm-members" data-testid="group-members">
          {group.members.map((member, index) => (
            <li
              key={member.userId}
              className={cx('cm-member', member.userId === group.me && 'cm-member--me')}
              data-testid="group-member"
            >
              <span className="cm-member__n">{String(index + 1).padStart(2, '0')}</span>
              <span className="cm-member__name">{member.nickname}</span>
              <span className="cm-member__tags">
                {member.role === 'owner' ? (
                  <span className="cm-tag">{m.groups_role_owner()}</span>
                ) : null}
                {member.userId === group.me ? (
                  <span className="cm-tag cm-tag--you">{m.groups_you()}</span>
                ) : null}
              </span>
              {owner && member.userId !== group.me ? (
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={busy}
                  aria-label={m.group_remove_label({ name: member.nickname })}
                  onClick={() => void act(() => backend.removeMember(group.id, member.userId))}
                >
                  {m.group_remove()}
                </Button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ol>
      </section>

      {error === null ? null : (
        <p role="alert" className="cm-error">
          {error}
        </p>
      )}

      <div className="cm-actions">
        <Link
          to="/leaderboards"
          search={{ scope: 'group', group: group.id }}
          className={buttonClass('primary', 'lg')}
        >
          {m.group_board_action()}
        </Link>
        {leaving ? (
          <Button
            variant="danger"
            size="lg"
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true)
                try {
                  await backend.leave(group.id)
                  await navigate({ to: '/groups' })
                } catch (caught) {
                  setError(describe(caught))
                  setBusy(false)
                }
              })()
            }
          >
            {m.group_leave_confirm()}
          </Button>
        ) : (
          <Button variant="secondary" size="lg" onClick={() => setLeaving(true)}>
            {m.group_leave()}
          </Button>
        )}
      </div>
      {leaving && owner && group.members.length > 1 ? (
        <p className="cm-note">{m.group_leave_owner_note()}</p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// An invite link
// ---------------------------------------------------------------------------------------------

/** With a name already known it joins at once; otherwise it asks for the name first. */
function Join({ backend, code }: { readonly backend: GroupsBackend; readonly code: string }) {
  const navigate = useNavigate()
  const { identity, name, setName, ensure } = useIdentity(backend)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tried = useRef(false)
  const [remembered] = useState(() => validName(backend.race.rememberedName()))
  const known = remembered || identity !== null

  const go = async () => {
    setError(null)
    if (!validName(name)) return setError(m.community_name_invalid())
    setBusy(true)
    try {
      await ensure()
      const groupId = await backend.joinGroup(code)
      await navigate({ to: '/groups/$groupId', params: { groupId }, replace: true })
    } catch (caught) {
      setError(describe(caught))
      setBusy(false)
    }
  }

  useEffect(() => {
    if (tried.current || !known || !validName(name)) return
    tried.current = true
    void go()
  })

  return (
    <div className="cm-calm">
      <p className="cm-panel__label cm-panel__label--ink">{m.group_join_title()}</p>
      <h1 className="cm-bigcode">{code}</h1>
      <form
        className="cm-join"
        onSubmit={(event) => {
          event.preventDefault()
          void go()
        }}
      >
        <Field
          label={m.community_name_label()}
          value={name}
          maxLength={32}
          autoComplete="nickname"
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" variant="primary" size="lg" disabled={busy}>
          {busy ? m.groups_join_busy() : m.groups_join_action()}
        </Button>
      </form>
      {error === null ? null : (
        <p role="alert" className="cm-error">
          {error}
        </p>
      )}
    </div>
  )
}

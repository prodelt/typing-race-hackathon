import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Button, buttonClass, cx, Field } from '@typing-race/ui'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Panel, Screen, ScreenHead } from '../../app/Screen.js'
import { m } from '../../paraglide/messages.js'
import type { GroupSnapshot, GroupSummary, GroupsBackend } from '../../sync/groups.js'
import {
  CommunityTabs,
  describe,
  inviteLink,
  useIdentity,
  validName,
  WithGroups,
} from './shared.js'

/**
 * Groups: create one and get a code, join one by code or by link, see who is in it. The router
 * imports these three names lazily, so none of this, nor the Supabase client, is in the entry.
 *
 * In direction B: the head bar with the Community switch, the learner's groups on the left, and
 * the ways in — name, create, join — on the right. A group's join code is its one red block.
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

  return (
    <Screen className="cm scr--fill">
      <ScreenHead title={m.groups_title()} lead={m.groups_lede()}>
        <CommunityTabs current="/groups" />
      </ScreenHead>

      <div className="cm-grid">
        <Panel
          id="cm-mine"
          n={1}
          title={m.groups_mine_title()}
          meta={mine === null || mine.length === 0 ? undefined : String(mine.length)}
          className="cm-mine"
        >
          {mine === null ? (
            <div className="scr-rows" aria-busy="true">
              <div className="scr-skeleton" />
              <div className="scr-skeleton" />
            </div>
          ) : mine.length === 0 ? (
            <div className="scr-empty cm-mine__empty">
              <p className="cm-mine__none">{m.groups_mine_empty()}</p>
              <p className="scr-say">{m.groups_mine_lede()}</p>
              <ol className="cm-steps" aria-label={m.groups_steps_label()}>
                {[m.groups_step_1(), m.groups_step_2(), m.groups_step_3()].map((step, i) => (
                  <li key={step} className="cm-step">
                    <span className="cm-step__n num">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <ol className="scr-rows">
              {mine.map((group, index) => (
                <li key={group.id}>
                  <Link
                    to="/groups/$groupId"
                    params={{ groupId: group.id }}
                    className="scr-row cm-list__row"
                    data-testid="my-group"
                  >
                    <span className="cm-list__n num">{String(index + 1).padStart(2, '0')}</span>
                    <span className="cm-list__name">{group.name}</span>
                    <span className="cm-list__meta">
                      {group.role === 'owner' ? (
                        <span className="scr-tag scr-tag--ink">{m.groups_role_owner()}</span>
                      ) : null}
                      {m.groups_members_count({ count: group.members })}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <div className="cm-ways">
          <Panel id="cm-player" n={2} title={m.groups_player_title()}>
            <Field
              label={m.community_name_label()}
              hint={m.community_name_hint()}
              value={name}
              maxLength={32}
              autoComplete="nickname"
              onChange={(event) => setName(event.target.value)}
            />
          </Panel>

          <section className="scr-panel" aria-labelledby="cm-create">
            <form className="cm-way" onSubmit={create}>
              <div className="scr-panel__head">
                <span className="scr-idx">03</span>
                <h2 id="cm-create" className="scr-panel__title">
                  {m.groups_create_title()}
                </h2>
              </div>
              <div className="cm-way__row">
                <Field
                  label={m.groups_create_label()}
                  value={groupName}
                  maxLength={64}
                  autoComplete="off"
                  onChange={(event) => setGroupName(event.target.value)}
                />
                <Button type="submit" variant="primary" disabled={busy !== null}>
                  {busy === 'create' ? m.groups_create_busy() : m.groups_create_action()}
                </Button>
              </div>
            </form>
          </section>

          <section className="scr-panel" aria-labelledby="cm-join">
            <form className="cm-way" onSubmit={join}>
              <div className="scr-panel__head">
                <span className="scr-idx">04</span>
                <h2 id="cm-join" className="scr-panel__title">
                  {m.groups_join_title()}
                </h2>
              </div>
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
                <Button type="submit" variant="secondary" disabled={busy !== null}>
                  {busy === 'join' ? m.groups_join_busy() : m.groups_join_action()}
                </Button>
              </div>
            </form>
          </section>

          {error === null ? null : (
            <p role="alert" className="scr-panel scr-error">
              {error}
            </p>
          )}
        </div>
      </div>
    </Screen>
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
      <Screen>
        <div className="scr-panel cm-calm" aria-busy="true">
          <div className="scr-skeleton" />
        </div>
      </Screen>
    ) : (
      <Screen>
        <div className="scr-panel cm-calm">
          <p role="alert" className="scr-say">
            {error}
          </p>
          <Link to="/groups" className={buttonClass('secondary', 'md')}>
            {m.group_back()}
          </Link>
        </div>
      </Screen>
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
    <Screen className="cm scr--fill">
      <ScreenHead
        title={<span data-testid="group-name">{group.name}</span>}
        lead={m.groups_members_count({ count: group.members.length })}
      >
        <Link to="/groups" className="scr-seg__btn cm-back">
          ← {m.group_back()}
        </Link>
      </ScreenHead>

      <div className="cm-grid cm-grid--group">
        <Panel
          id="cm-members"
          n={1}
          title={m.group_members_title()}
          meta={m.group_members_meta({ count: group.members.length })}
          className="cm-members-panel"
        >
          <ol className="scr-rows" data-testid="group-members">
            {group.members.map((member, index) => (
              <li
                key={member.userId}
                className={cx('scr-row cm-member', member.userId === group.me && 'cm-member--me')}
                data-testid="group-member"
              >
                <span className="cm-list__n num">{String(index + 1).padStart(2, '0')}</span>
                <span className="cm-member__name">{member.nickname}</span>
                <span className="cm-member__tags">
                  {member.role === 'owner' ? (
                    <span className="scr-tag scr-tag--ink">{m.groups_role_owner()}</span>
                  ) : null}
                  {member.userId === group.me ? (
                    <span className="scr-tag">{m.groups_you()}</span>
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
        </Panel>

        <div className="cm-ways">
          <section className="scr-panel scr-loud cm-code" aria-labelledby="cm-code-title">
            <div className="scr-panel__head">
              <span className="scr-idx">02</span>
              <h2 className="scr-panel__title" id="cm-code-title">
                {m.group_code_label()}
              </h2>
            </div>
            <p className="cm-code__value" data-testid="group-code">
              {group.joinCode}
            </p>
            <p className="cm-code__hint">{m.group_code_hint()}</p>
            <div className="cm-code__actions">
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
          </section>

          <section className="scr-panel cm-actions" aria-label={m.group_board_action()}>
            <Link
              to="/leaderboards"
              search={{ scope: 'group', group: group.id }}
              className={buttonClass('secondary', 'md')}
            >
              {m.group_board_action()}
            </Link>
            {leaving ? (
              <Button
                variant="danger"
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
              <Button variant="quiet" onClick={() => setLeaving(true)}>
                {m.group_leave()}
              </Button>
            )}
            {leaving && owner && group.members.length > 1 ? (
              <p className="scr-note cm-actions__note">{m.group_leave_owner_note()}</p>
            ) : null}
          </section>

          {error === null ? null : (
            <p role="alert" className="scr-panel scr-error">
              {error}
            </p>
          )}
        </div>
      </div>
    </Screen>
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
    <Screen className="cm cm--center">
      <div className="cm-invite">
        <section className="scr-panel scr-loud cm-code" aria-labelledby="cm-invite-title">
          <div className="scr-panel__head">
            <p className="scr-panel__title" id="cm-invite-title">
              {m.group_join_title()}
            </p>
          </div>
          <h1 className="cm-code__value">{code}</h1>
        </section>
        <form
          className="scr-panel cm-invite__form"
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
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? m.groups_join_busy() : m.groups_join_action()}
          </Button>
          {error === null ? null : (
            <p role="alert" className="scr-error cm-invite__error">
              {error}
            </p>
          )}
        </form>
      </div>
    </Screen>
  )
}

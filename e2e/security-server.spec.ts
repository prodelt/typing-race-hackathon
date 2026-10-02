import { expect, type TestInfo, test } from '@playwright/test'
import {
  ANON_KEY,
  API,
  type Caller,
  caller,
  evidence,
  localStackConfigured,
  type Reply,
  rows,
  type Session,
  signUpEmail,
  signUpGuest,
  visitor,
} from './harness/attack.js'

/**
 * The server, attacked as an anonymous internet user who holds the public anon key (the
 * repository is public, so is the key). Edge Functions, row-level security, the RPCs, Realtime,
 * account deletion and the rate limits, each with the request, what was expected and what came
 * back attached to the report.
 *
 * Destructive by design: it forges logs, floods a limiter and deletes accounts. It therefore runs
 * only against a stack on this machine (`localStackConfigured`), which the CI lane starts for the
 * job, and never against the live project. Every account it makes is a test account.
 *
 * Tagged `@backend` (skipped without a Supabase configuration) and `@security`.
 */

test.describe('server attack suite', { tag: ['@backend', '@security'] }, () => {
  test.skip(!localStackConfigured(), 'needs a Supabase stack on this machine')

  const FUNCTIONS = ['submit-attempt', 'finish-race', 'delete-account'] as const

  let visit: Caller
  let api: Awaited<ReturnType<typeof visitor>>
  let s: Session // submits attempts
  let a: Session // hosts room 1, forges a result
  let b: Session // honest racer in room 1
  let c: Session // hosts room 2, corrects a keystroke
  let d: Session // in no room
  let x: Session // floods the rate limiter
  let z: Session // tries to delete someone else
  let asS: Caller
  let asA: Caller
  let asB: Caller
  let asC: Caller
  let asD: Caller
  let nickA = ''

  // ---- Fixtures ------------------------------------------------------------------------------

  const TEXT = 'asdf jkl; asdf jkl;'

  function paced(text: string, gap = 150) {
    const chars = [...text]
    return {
      formatVersion: 1,
      dt: chars.map((_, i) => (i === 0 ? 400 : gap)),
      kind: chars.map(() => 'char'),
      char: chars,
      correct: chars.map(() => true),
    }
  }

  function submission(
    id: string,
    over: { attempt?: Record<string, unknown>; log?: Record<string, unknown> } = {},
  ) {
    const log = (over.log ?? paced(TEXT)) as { dt: number[] }
    const elapsed = log.dt.reduce((sum, delta) => sum + Number(delta), 0)
    return {
      attempt: {
        id,
        scaleId: 'qwerty.run.anchors',
        layoutId: 'qwerty',
        language: 'en',
        mode: 'practice',
        text: TEXT,
        seed: 7,
        startedAt: Date.now() - elapsed - 5000,
        completedAt: Date.now() - 5000,
        elapsedMs: elapsed,
        ...over.attempt,
      },
      log,
    }
  }

  const uuid = (): string => crypto.randomUUID()

  /** A private room that has been started: its id, text and the moment the race goes live. */
  async function startedRoom(host: Caller, guests: Caller[] = []) {
    const made = rows(await host.rpc('create_private_room', { p_language: 'en' }))[0]
    const roomId = String(made?.['room_id'])
    const code = String(made?.['join_code'])
    for (const guest of guests) await guest.rpc('join_by_code', { p_code: code })
    await host.rpc('start_race', { p_room: roomId })
    const room = rows(await host.select(`race_rooms?id=eq.${roomId}&select=text_id,starts_at`))[0]
    const textRow = rows(await host.select(`race_texts?id=eq.${room?.['text_id']}&select=body`))[0]
    return {
      roomId,
      code,
      text: String(textRow?.['body'] ?? ''),
      startsAt: Date.parse(String(room?.['starts_at'])),
    }
  }

  let room1: Awaited<ReturnType<typeof startedRoom>>
  let room2: Awaited<ReturnType<typeof startedRoom>>

  test.beforeAll(async () => {
    api = await visitor()
    visit = caller(api, null)
    ;[s, a, b, c, d, x, z] = await Promise.all([
      signUpEmail(api),
      signUpEmail(api),
      signUpEmail(api),
      signUpEmail(api),
      signUpEmail(api),
      signUpEmail(api),
      signUpEmail(api),
    ])
    asS = caller(api, s)
    asA = caller(api, a)
    asB = caller(api, b)
    asC = caller(api, c)
    asD = caller(api, d)
    nickA = String(
      rows(await asA.select(`profiles?id=eq.${a.id}&select=nickname`))[0]?.['nickname'],
    )
    ;[room1, room2] = await Promise.all([startedRoom(asA, [asB]), startedRoom(asC)])
  })

  test.afterAll(async () => {
    await api.dispose()
  })

  const mark = (info: TestInfo, attack: string, sent: string, expected: string, reply: Reply) =>
    evidence(info, { attack, sent, expected, reply })

  // ---- Edge Functions: who may call ----------------------------------------------------------

  test.describe('Edge Functions refuse a caller who is nobody', () => {
    for (const name of FUNCTIONS) {
      test(`${name}: no Authorization, the anon key, garbage and a tampered JWT all get 401`, async () => {
        const info = test.info()
        const tampered = (() => {
          const [head, payload, signature] = s.token.split('.')
          const body = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8'))
          body.sub = b.id
          return `${head}.${Buffer.from(JSON.stringify(body)).toString('base64url')}.${signature}`
        })()
        const cases: [string, string | null][] = [
          ['no Authorization header', null],
          ['the public anon key as a bearer token', ANON_KEY],
          ['a garbage token', 'a.b.c'],
          ['a real token with its subject swapped for another user', tampered],
        ]
        for (const [label, token] of cases) {
          const reply = await visit.fn(name, { attempts: [] }, { token })
          await mark(info, `${name}: ${label}`, 'POST {}', '401', reply)
          expect(reply.status, `${name}: ${label}`).toBe(401)
        }
      })
    }
  })

  // ---- submit-attempt ------------------------------------------------------------------------

  test.describe('submit-attempt', () => {
    test('accepts an honest attempt, once: a replay stores nothing new', async () => {
      const info = test.info()
      const id = uuid()
      const first = await asS.fn('submit-attempt', { attempts: [submission(id)] })
      await mark(info, 'honest attempt', 'one plausible log', 'accepted', first)
      expect(first.status).toBe(200)
      expect((first.body as { accepted: string[] }).accepted).toEqual([id])

      const again = await asS.fn('submit-attempt', { attempts: [submission(id)] })
      expect(again.status).toBe(200)
      const stored = await asS.select(`attempts?id=eq.${id}&select=id`)
      await mark(info, 'replay of a stored attempt id', 'same id again', 'still one row', stored)
      expect(rows(stored)).toHaveLength(1)
    })

    test('another user cannot overwrite an attempt by sending its id', async () => {
      const info = test.info()
      const id = uuid()
      await asS.fn('submit-attempt', { attempts: [submission(id)] })
      const before = rows(await asS.select(`attempts?id=eq.${id}&select=metrics,mode`))[0]
      const forged = submission(id, { attempt: { mode: 'test' }, log: paced(TEXT, 90) })
      const reply = await asB.fn('submit-attempt', { attempts: [forged] })
      await mark(
        info,
        'overwrite by id',
        "B sends S's attempt id with other data",
        "S's row unchanged",
        reply,
      )
      const after = rows(await asS.select(`attempts?id=eq.${id}&select=metrics,mode`))[0]
      expect(after).toEqual(before)
      expect(rows(await asB.select(`attempts?id=eq.${id}&select=id`))).toHaveLength(0)
    })

    test('every number is recomputed: claimed metrics are ignored', async () => {
      const info = test.info()
      const id = uuid()
      const forged = submission(id)
      Object.assign(forged.attempt, { metrics: { spm: 99_999, accuracy: 1, wpm: 99_999 } })
      const reply = await asS.fn('submit-attempt', { attempts: [forged] })
      await mark(info, 'claimed metrics', 'attempt.metrics.spm = 99999', 'recomputed', reply)
      const stored = rows(await asS.select(`attempts?id=eq.${id}&select=metrics`))[0]
      const spm = Number((stored?.['metrics'] as { spm: number } | undefined)?.spm)
      expect(spm).toBeGreaterThan(100)
      expect(spm).toBeLessThan(1000)
    })

    const rejections: [string, Record<string, unknown>, string][] = [
      [
        'a log faster than a hand (5 ms between keys)',
        { log: paced(TEXT, 5), attempt: { elapsedMs: 2_000 } },
        'implausible_interval',
      ],
      ['an attempt that took 100 ms', { attempt: { elapsedMs: 100 } }, 'too_fast'],
      ['a log that cannot produce its text', { log: paced('asdf') }, 'text_mismatch'],
      [
        'a completion time ten minutes in the future',
        { attempt: { completedAt: Date.now() + 600_000 } },
        'future_timestamp',
      ],
      [
        'an exercise that does not exist',
        { attempt: { scaleId: 'no.such.exercise' } },
        'unknown_scale',
      ],
      ['a 100 KB exercise id', { attempt: { scaleId: 'x'.repeat(100_000) } }, 'unknown_scale'],
    ]
    for (const [label, over, reason] of rejections) {
      test(`rejects ${label}`, async () => {
        const info = test.info()
        const id = uuid()
        const reply = await asS.fn('submit-attempt', { attempts: [submission(id, over)] })
        await mark(info, `rejects ${label}`, 'one forged attempt', reason, reply)
        expect(reply.status).toBe(200)
        const body = reply.body as {
          accepted: string[]
          rejected: { id: string; reason: string }[]
        }
        expect(body.accepted).not.toContain(id)
        expect(body.rejected.find((entry) => entry.id === id)?.reason).toBe(reason)
      })
    }

    test('malformed bodies are refused or rejected, never a server error', async () => {
      const info = test.info()
      const good = submission(uuid())
      const shapes: [string, unknown, string?][] = [
        ['attempts is a string', { attempts: 'x' }],
        ['attempts holds null', { attempts: [null] }],
        ['an empty attempt', { attempts: [{}] }],
        ['an attempt with no log', { attempts: [{ attempt: good.attempt }] }],
        ['a log of the wrong shape', { attempts: [{ attempt: good.attempt, log: { dt: 'x' } }] }],
        ['an id that is not a uuid', { attempts: [submission('not-a-uuid')] }],
        [
          'a completion time that is not a number',
          { attempts: [submission(uuid(), { attempt: { completedAt: 'tomorrow' } })] },
        ],
        [
          'a start time beyond the date range',
          { attempts: [submission(uuid(), { attempt: { startedAt: 1e300 } })] },
        ],
        ['a seed beyond bigint', { attempts: [submission(uuid(), { attempt: { seed: 1e30 } })] }],
        [
          'a language that does not match the layout',
          { attempts: [submission(uuid(), { attempt: { language: 'uk' } })] },
        ],
        ['a JSON array as the body', [good]],
        ['null as the body', null],
      ]
      for (const [label, body] of shapes) {
        const reply = await asS.fn('submit-attempt', body)
        await mark(
          info,
          `malformed: ${label}`,
          'a hostile body',
          '4xx, or 200 with a rejection',
          reply,
        )
        expect(reply.status, label).toBeLessThan(500)
      }
      const notJson = await asS.fn('submit-attempt', null, { raw: 'this is not json' })
      await mark(info, 'malformed: not JSON', 'raw text', '400', notJson)
      expect(notJson.status).toBe(400)
    })

    test('an oversized batch and an oversized log are refused', async () => {
      const info = test.info()
      const many = Array.from({ length: 1500 }, () => submission(uuid()))
      const batch = await asS.fn('submit-attempt', { attempts: many })
      await mark(info, 'batch of 1500 attempts', 'one request', '413 (the client sends 50)', batch)
      expect(batch.status).toBe(413)

      const long = 200_000
      const log = {
        formatVersion: 1,
        dt: Array.from({ length: long }, () => 150),
        kind: Array.from({ length: long }, () => 'char'),
        char: Array.from({ length: long }, () => 'a'),
        correct: Array.from({ length: long }, () => true),
      }
      const huge = await asS.fn('submit-attempt', {
        attempts: [submission(uuid(), { log, attempt: { text: 'a'.repeat(long) } })],
      })
      await mark(info, 'log of 200000 keystrokes', 'one attempt', '413 or a rejection', huge)
      expect([200, 400, 413]).toContain(huge.status)
      if (huge.status === 200) {
        expect((huge.body as { accepted: string[] }).accepted).toHaveLength(0)
      }
    })

    test('the rate limit holds: 60 requests in ten minutes, then 429 with Retry-After', async () => {
      const info = test.info()
      const asX = caller(api, x)
      const replies: Reply[] = []
      for (let i = 0; i < 70; i++) replies.push(await asX.fn('submit-attempt', { attempts: [] }))
      const limited = replies.filter((reply) => reply.status === 429)
      await mark(info, 'flood', '70 requests', '429 after 60', replies[69] as Reply)
      expect(limited.length).toBeGreaterThanOrEqual(5)
      expect(limited[0]?.headers['retry-after']).toBeDefined()
      expect(replies.slice(0, 60).every((reply) => reply.status === 200)).toBe(true)
    })
  })

  // ---- finish-race ---------------------------------------------------------------------------

  test.describe('finish-race', () => {
    const raceLog = (text: string, gap: number, extra: string[] = []) => {
      const keys = [...text]
      // `extra` is spliced in after the third key: ['BS', ...] means a Backspace then retyping.
      const out: { kind: string; char: string | null }[] = keys.map((char) => ({
        kind: 'char',
        char,
      }))
      if (extra.length > 0) {
        out.splice(3, 0, { kind: 'backspace', char: null }, { kind: 'char', char: keys[2] ?? '' })
      }
      return {
        formatVersion: 1,
        dt: out.map((_, i) => (i === 0 ? 400 : gap)),
        kind: out.map((key) => key.kind),
        char: out.map((key) => key.char),
        // What a forger would claim; the server must not read it.
        correct: out.map(() => true),
      }
    }
    const elapsedOf = (log: { dt: number[] }) => log.dt.reduce((sum, delta) => sum + delta, 0)

    test.beforeAll(async () => {
      // The race is only submittable once enough time has passed since it went live: wait for it.
      const longest = Math.max(room1.text.length, room2.text.length) * 55 + 3_000
      const wait = room1.startsAt + longest - Date.now()
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    })

    test('a log typed in a millisecond a key is rejected as a script, and the verdict is final', async () => {
      const info = test.info()
      const log = raceLog(room1.text, 1)
      const forged = await asA.fn('finish-race', {
        roomId: room1.roomId,
        log,
        elapsedMs: elapsedOf(log),
      })
      await mark(info, 'forged race log', '1 ms between keys', 'validated:false', forged)
      expect(forged.status).toBe(200)
      expect((forged.body as { validated: boolean }).validated).toBe(false)

      // A second submission with an honest log gets the first answer back: a result is immutable.
      const honest = raceLog(room1.text, 55)
      const second = await asA.fn('finish-race', {
        roomId: room1.roomId,
        log: honest,
        elapsedMs: elapsedOf(honest),
      })
      await mark(
        info,
        'second submission',
        'an honest log after a forged one',
        'the first verdict',
        second,
      )
      expect((second.body as { validated: boolean }).validated).toBe(false)
    })

    test('an honest log is validated, and the server judges it from the text, not from the flags', async () => {
      const info = test.info()
      const log = raceLog(room1.text, 55)
      const reply = await asB.fn('finish-race', {
        roomId: room1.roomId,
        log,
        elapsedMs: elapsedOf(log),
      })
      await mark(info, 'honest race log', 'paced log', 'validated:true', reply)
      expect(reply.status).toBe(200)
      expect((reply.body as { validated: boolean }).validated).toBe(true)
    })

    test('a racer who pressed Backspace after a correct letter and retyped it is still validated', async () => {
      const info = test.info()
      const log = raceLog(room2.text, 55, ['BS'])
      const reply = await asC.fn('finish-race', {
        roomId: room2.roomId,
        log,
        elapsedMs: elapsedOf(log),
      })
      await mark(info, 'honest race with a Backspace', 'k k k ⌫ k ...', 'validated:true', reply)
      expect(reply.status).toBe(200)
      expect((reply.body as { validated: boolean; reason?: string }).validated).toBe(true)
    })

    test('someone who is not in the room cannot finish it, and a race that has not started cannot be finished', async () => {
      const info = test.info()
      const log = raceLog(room1.text, 55)
      const outsider = await asD.fn('finish-race', {
        roomId: room1.roomId,
        log,
        elapsedMs: elapsedOf(log),
      })
      await mark(info, 'not in the room', 'a stranger submits a log', '403', outsider)
      expect(outsider.status).toBe(403)

      const made = rows(await asD.rpc('create_private_room', { p_language: 'en' }))[0]
      const unstarted = await asD.fn('finish-race', {
        roomId: String(made?.['room_id']),
        log,
        elapsedMs: elapsedOf(log),
      })
      await mark(info, 'before the start', 'finish a gathering room', '409', unstarted)
      expect(unstarted.status).toBe(409)

      const junk = await asD.fn('finish-race', { roomId: 'not-a-uuid', log, elapsedMs: 1000 })
      await mark(info, 'malformed room id', "roomId 'not-a-uuid'", '4xx', junk)
      expect(junk.status).toBeGreaterThanOrEqual(400)
      expect(junk.status).toBeLessThan(500)

      const hugeLog = {
        formatVersion: 1,
        dt: Array.from({ length: 200_000 }, () => 55),
        kind: Array.from({ length: 200_000 }, () => 'char'),
        char: Array.from({ length: 200_000 }, () => 'a'),
        correct: [],
      }
      const flood = await asB.fn('finish-race', {
        roomId: room1.roomId,
        log: hugeLog,
        elapsedMs: 1000,
      })
      await mark(info, 'huge race log', '200000 keystrokes', '4xx, not a long computation', flood)
      expect([400, 413]).toContain(flood.status)
      expect(flood.ms).toBeLessThan(15_000)
    })
  })

  // ---- Row-level security and RPCs -----------------------------------------------------------

  test.describe('row-level security', () => {
    const TABLES = [
      'profiles',
      'attempts',
      'keystroke_logs',
      'progress',
      'groups',
      'group_members',
      'race_texts',
      'race_rooms',
      'race_participants',
      'race_results',
      'lb_global',
      'lb_weekly',
      'group_practice',
      'race_ratings',
      'race_rating_changes',
    ]

    test('a visitor with only the anon key reads no table', async () => {
      const info = test.info()
      for (const table of TABLES) {
        const reply = await visit.select(`${table}?select=*&limit=5`)
        await mark(info, `visitor reads ${table}`, 'GET with the anon key', 'nothing', reply)
        expect(reply.status === 200 ? rows(reply) : [], table).toHaveLength(0)
      }
    })

    test('another user cannot read, change or delete my rows', async () => {
      const info = test.info()
      // B looks for A's profile, attempts and rooms by id.
      for (const [table, column] of [
        ['profiles', 'id'],
        ['attempts', 'user_id'],
        ['progress', 'user_id'],
        ['keystroke_logs', 'user_id'],
      ] as const) {
        const reply = await asB.select(`${table}?${column}=eq.${a.id}&select=*`)
        await mark(info, `B reads A's ${table}`, 'GET filtered by A', 'no rows', reply)
        expect(rows(reply), table).toHaveLength(0)
      }
      const rename = await asB.patch(`profiles?id=eq.${a.id}`, { nickname: 'taken-over' })
      await mark(info, 'B renames A', "PATCH A's profile", 'no row changed', rename)
      expect(rows(rename)).toHaveLength(0)
      const nickNow = rows(await asA.select(`profiles?id=eq.${a.id}&select=nickname`))[0]?.[
        'nickname'
      ]
      expect(nickNow).toBe(nickA)
      // S has an attempt of its own to lose (this test does not rely on the order of the others).
      await asS.fn('submit-attempt', { attempts: [submission(uuid())] })
      const wipe = await asB.remove(`attempts?user_id=eq.${s.id}`)
      expect(rows(wipe)).toHaveLength(0)
      expect(rows(await asS.select('attempts?select=id')).length).toBeGreaterThan(0)
    })

    test('a user cannot take another nick, flip the test flag or move a profile', async () => {
      const info = test.info()
      const takeover = await asB.patch(`profiles?id=eq.${b.id}`, { nickname: nickA.toUpperCase() })
      await mark(info, 'nick takeover', "PATCH my nick to A's nick", '409', takeover)
      expect(takeover.status).toBe(409)

      for (const patch of [{ is_test: false }, { id: a.id }, { created_at: '2000-01-01' }]) {
        const reply = await asB.patch(`profiles?id=eq.${b.id}`, patch)
        await mark(
          info,
          `profile patch ${JSON.stringify(patch)}`,
          'PATCH a protected column',
          '4xx',
          reply,
        )
        expect(reply.status).toBeGreaterThanOrEqual(400)
      }
    })

    test('nobody writes attempts, results, ratings or boards through the data API', async () => {
      const info = test.info()
      const writes: [string, Record<string, unknown>][] = [
        [
          'attempts',
          {
            id: uuid(),
            user_id: b.id,
            scale_id: 'x',
            layout_id: 'qwerty',
            language: 'en',
            mode: 'test',
            seed: 1,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            elapsed_ms: 1000,
            metrics: { spm: 9999 },
            aggregates: {},
          },
        ],
        [
          'race_results',
          {
            room_id: room1.roomId,
            user_id: b.id,
            spm: 5000,
            accuracy: 1,
            score: 5000,
            validated: true,
          },
        ],
        ['race_ratings', { user_id: b.id, rating: 3000 }],
        ['lb_global', { user_id: b.id, score: 99999 }],
        ['groups', { name: 'x', join_code: 'ZZZZZZ', owner_id: b.id }],
        ['race_participants', { room_id: room1.roomId, user_id: d.id, role: 'racer' }],
        ['race_rooms', { visibility: 'private', language: 'en', difficulty: 1 }],
      ]
      for (const [table, row] of writes) {
        const reply = await asB.insert(table, row)
        await mark(info, `insert into ${table}`, 'POST a forged row', '4xx', reply)
        expect(reply.status, table).toBeGreaterThanOrEqual(400)
      }
      const result = await asB.patch(`race_results?room_id=eq.${room1.roomId}`, {
        spm: 9999,
        score: 9999,
      })
      expect(rows(result)).toHaveLength(0)
    })

    test('internal functions are not callable, as a user or as a visitor', async () => {
      const info = test.info()
      const room = room1.roomId
      const calls: [string, Record<string, unknown>][] = [
        ['race_notify', { p_room: room, p_event: 'x', p_payload: {} }],
        ['settle_race', { p_room: room }],
        ['rate_race', { p_room: room }],
        [
          'consume_request_quota',
          { p_user: b.id, p_bucket: 'x', p_limit: 1, p_window: '1 minute' },
        ],
        ['hand_over_owned_groups', { p_user: a.id }],
        ['prune_keystroke_logs', { keep_per_user: 0 }],
        ['race_text_for', { p_language: 'en', p_difficulty: 2 }],
        ['is_group_owner', { target: uuid() }],
        ['race_rating_field', { p_room: room }],
        ['race_room_capacity', {}],
        ['race_time_limit', {}],
        ['race_rating_start', {}],
        ['race_rating_k', {}],
        ['race_rating_floor', {}],
        ['fresh_group_code', {}],
      ]
      for (const [name, args] of calls) {
        for (const [who, caller_] of [
          ['user', asB],
          ['visitor', visit],
        ] as const) {
          const reply = await caller_.rpc(name, args)
          await mark(info, `${who} calls ${name}`, 'POST /rpc', '401 or 403', reply)
          expect([401, 403], `${who} ${name}`).toContain(reply.status)
        }
      }
    })

    test('room and group operations need a session, and the right seat', async () => {
      const info = test.info()
      for (const [name, args] of [
        ['create_private_room', { p_language: 'en' }],
        ['join_by_code', { p_code: room1.code }],
        ['start_race', { p_room: room1.roomId }],
        ['create_group', { p_name: 'visitors' }],
        ['my_groups', {}],
      ] as [string, Record<string, unknown>][]) {
        const reply = await visit.rpc(name, args)
        await mark(info, `visitor calls ${name}`, 'POST /rpc with no user', '4xx', reply)
        expect(reply.status, name).toBeGreaterThanOrEqual(400)
      }

      // A stranger neither starts someone else's room nor reads it.
      const start = await asD.rpc('start_race', { p_room: room1.roomId })
      await mark(info, 'stranger starts a room', 'start_race by a non-participant', 'error', start)
      expect(start.status).toBeGreaterThanOrEqual(400)
      const snapshot = await asD.rpc('room_snapshot', { p_room: room1.roomId })
      await mark(
        info,
        'stranger reads a room',
        'room_snapshot by a non-participant',
        'error or empty',
        snapshot,
      )
      expect(
        snapshot.status >= 400 || snapshot.body === null || JSON.stringify(snapshot.body) === '{}',
      ).toBe(true)

      // A guest in the room is not the host: they cannot start it.
      const made = rows(await asA.rpc('create_private_room', { p_language: 'en' }))[0]
      await asB.rpc('join_by_code', { p_code: String(made?.['join_code']) })
      const guestStart = await asB.rpc('start_race', { p_room: String(made?.['room_id']) })
      await mark(
        info,
        'guest starts a private room',
        'start_race by the guest',
        'no start',
        guestStart,
      )
      expect(guestStart.body ?? null).toBeNull()
    })

    test('groups: a stranger cannot remove a member, rotate the code or read the group', async () => {
      const info = test.info()
      const made = rows(
        await asA.rpc('create_group', { p_name: `Attack ${Date.now() % 100_000}` }),
      )[0]
      const group = String(made?.['group_id'])
      await asB.rpc('join_group', { p_code: String(made?.['join_code']) })

      const remove = await asB.rpc('remove_group_member', { p_group: group, p_user: a.id })
      await mark(
        info,
        'member removes the owner',
        'remove_group_member by a member',
        'error',
        remove,
      )
      expect(remove.status).toBeGreaterThanOrEqual(400)

      const rotate = await asB.rpc('regenerate_group_code', { p_group: group })
      await mark(
        info,
        'member rotates the code',
        'regenerate_group_code by a member',
        'error',
        rotate,
      )
      expect(rotate.status).toBeGreaterThanOrEqual(400)

      const read = await asD.rpc('group_snapshot', { p_group: group })
      await mark(
        info,
        'stranger reads a group',
        'group_snapshot by a non-member',
        'error or empty',
        read,
      )
      expect(read.status >= 400 || read.body === null || JSON.stringify(read.body) === '{}').toBe(
        true,
      )
      expect(rows(await asD.select(`groups?id=eq.${group}&select=*`))).toHaveLength(0)
    })

    test('the public leaderboard carries only the documented columns, never an email', async () => {
      const info = test.info()
      const reply = await visit.rpc('leaderboard', {
        p_scope: 'all',
        p_language: 'en',
        p_group: null,
        p_limit: 20,
      })
      await mark(
        info,
        'visitor reads the leaderboard',
        'leaderboard() with the anon key',
        'only the documented columns',
        reply,
      )
      expect(reply.status).toBe(200)
      // `userId` is on the board so the client can mark the viewer's own row. It is a random uuid
      // and opens nothing (row-level security does not trust it), but it is the one identifier a
      // visitor can read; recorded as a finding, not asserted away.
      const allowed = new Set([
        'place',
        'userId',
        'nickname',
        'spm',
        'accuracy',
        'score',
        'races',
        'finishedAt',
      ])
      const board = (reply.body as { rows: Record<string, unknown>[] }).rows
      for (const row of board) {
        for (const key of Object.keys(row)) expect(allowed.has(key), key).toBe(true)
      }
      expect(JSON.stringify(reply.body)).not.toMatch(/@[a-z0-9-]+\.[a-z]/i)
    })
  })

  // ---- Realtime ------------------------------------------------------------------------------

  test.describe('Realtime', () => {
    /** Joins a private channel over the raw Phoenix protocol; answers `ok` or why it was refused. */
    async function join(session: Session, topic: string): Promise<string> {
      const base = (API ?? '').replace(/^http/, 'ws')
      const socket = new WebSocket(`${base}/realtime/v1/websocket?apikey=${ANON_KEY}&vsn=1.0.0`)
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve()
        socket.onerror = () => reject(new Error('realtime socket did not open'))
      })
      const verdict = new Promise<string>((resolve) => {
        let joined = false
        const timer = setTimeout(() => resolve(joined ? 'ok' : 'timeout'), 5_000)
        socket.onmessage = (event) => {
          const message = JSON.parse(String(event.data)) as {
            event: string
            payload: { status?: string; response?: unknown; message?: string }
          }
          if (message.event === 'phx_reply' && message.payload.status === 'error') {
            clearTimeout(timer)
            resolve('denied')
          } else if (message.event === 'system' && message.payload.status === 'error') {
            clearTimeout(timer)
            resolve('denied')
          } else if (message.event === 'phx_reply' && message.payload.status === 'ok') {
            joined = true
          }
        }
      })
      socket.send(
        JSON.stringify({
          topic: `realtime:${topic}`,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: '' },
              private: true,
            },
            access_token: session.token,
          },
          ref: '1',
          join_ref: '1',
        }),
      )
      const result = await verdict
      socket.close()
      return result
    }

    test('a participant hears the room, a stranger and a visitor do not', async () => {
      const info = test.info()
      const topic = `race:${room1.roomId}`
      const member = await join(a, topic)
      expect(member, 'the host joins its own room (control)').toBe('ok')
      const stranger = await join(d, topic)
      await info.attach('realtime stranger', { body: `stranger joins ${topic}: ${stranger}` })
      // The control above shows a participant gets an explicit `ok`; a stranger must never get one
      // (Realtime answers an unauthorised private join with an error or with nothing at all).
      expect(stranger).not.toBe('ok')
      const other = await join(d, `race:${uuid()}`)
      expect(other).not.toBe('ok')
    })
  })

  // ---- delete-account ------------------------------------------------------------------------

  test.describe('delete-account', () => {
    test('deletes only the caller, whoever the body names', async () => {
      const info = test.info()
      const reply = await caller(api, z).fn('delete-account', {
        userId: a.id,
        id: a.id,
        user_id: a.id,
      })
      await mark(
        info,
        'delete another user',
        "body names A, token is Z's",
        'only Z is deleted',
        reply,
      )
      expect(reply.status).toBe(200)
      // A is untouched and Z is gone.
      expect(rows(await asA.select(`profiles?id=eq.${a.id}&select=id`))).toHaveLength(1)
      const zAgain = await caller(api, z).fn('delete-account', {})
      expect(zAgain.status).toBe(401)
    })
  })

  // ---- Anonymous sign-in ---------------------------------------------------------------------

  test('a guest can be made without an email, and holds no more rights than a user', async () => {
    const info = test.info()
    const guest = await signUpGuest(api)
    const asGuest = caller(api, guest)
    const profile = await asGuest.select(`profiles?id=eq.${guest.id}&select=nickname,is_test`)
    await mark(info, 'guest profile', 'anonymous sign-up', 'a generated nick', profile)
    expect(rows(profile)).toHaveLength(1)
    // The guest cannot read anyone else's profile either.
    expect(rows(await asGuest.select(`profiles?id=eq.${a.id}&select=id`))).toHaveLength(0)
  })
})

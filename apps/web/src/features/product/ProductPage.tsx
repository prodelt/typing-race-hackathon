import { Link } from '@tanstack/react-router'
import {
  buttonClass,
  Chip,
  currentMotion,
  Index,
  type ResolvedMotion,
  Wordmark,
  watchMotion,
} from '@typing-race/ui'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { GradLayer } from '../grad.js'
import type { HeroShader } from './heroShader.js'
import { Reveal } from './Reveal.js'
import { TypingSpecimen } from './TypingSpecimen.js'
import './hero.css'
import './product.css'

/** Where "Start practising" leads: Today asks a new learner where to begin. */
const PRACTICE = '/today'
const FORMULAS = '/formulas'

/** `--i` orders a staggered reveal; typed here once instead of casting at every use. */
function order(i: number): CSSProperties {
  return { '--i': i } as CSSProperties
}

function useMotion(): ResolvedMotion {
  const [motion, setMotion] = useState<ResolvedMotion>(() => currentMotion())
  useEffect(() => watchMotion(setMotion), [])
  return motion
}

/**
 * The hero's backdrop. The CSS gradient under the canvas *is* the picture at motion `off`, and
 * the first paint everywhere; the shader, when it loads, fades in over it. It is imported only
 * once the page is idle, as its own chunk, so it never delays the first paint or counts against
 * the initial-JS budget.
 */
function HeroBackdrop({
  motion,
  playing,
}: {
  readonly motion: ResolvedMotion
  readonly playing: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const shader = useRef<HeroShader | null>(null)
  const [ready, setReady] = useState(false)
  const wanted = useRef(playing && motion === 'full')
  wanted.current = playing && motion === 'full'

  useEffect(() => {
    if (motion === 'off') return
    let cancelled = false
    const start = () => {
      void import('./heroShader.js').then(({ startHeroShader }) => {
        const node = canvas.current
        if (cancelled || node === null) return
        shader.current = startHeroShader(node, wanted.current)
        if (shader.current !== null) setReady(true)
      })
    }
    const idle =
      window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 200))
    const handle = idle(start)
    return () => {
      cancelled = true
      if (typeof handle === 'number') window.cancelIdleCallback?.(handle)
      shader.current?.destroy()
      shader.current = null
      setReady(false)
    }
  }, [motion])

  useEffect(() => {
    shader.current?.setPlaying(playing && motion === 'full')
  }, [playing, motion])

  return (
    <div className="hero__backdrop" aria-hidden="true">
      <canvas ref={canvas} className="hero__canvas" data-ready={ready || undefined} />
    </div>
  )
}

/**
 * The product page: the one screen before the learner, so it reads nothing about them.
 *
 * Built the way the brand site is built: a dark hero panel with a huge headline and one outlined
 * word, then numbered sections, each a different layout family (a row of stage cells, a manifesto
 * beside offset number cells, a card with a torn headline and circled points, and a poster-sized
 * call to action), so the page never reads as a template of equal boxes.
 *
 * Its visual asset is the product itself: the live typing demo in the hero shows a wrong key
 * marked in place, a Backspace, and an error count that does not fall.
 */
export function ProductPage() {
  const motion = useMotion()
  const [playing, setPlaying] = useState(true)
  const animated = motion === 'full'

  const stages = [
    {
      n: 1,
      name: m.product_stage1_name(),
      title: m.product_stage1_title(),
      body: m.product_stage1_body(),
      live: true,
    },
    {
      n: 2,
      name: m.product_stage2_name(),
      title: m.product_stage2_title(),
      body: m.product_stage2_body(),
      live: false,
    },
    {
      n: 3,
      name: m.product_stage3_name(),
      title: m.product_stage3_title(),
      body: m.product_stage3_body(),
      live: false,
    },
  ] as const

  const facts = [
    { value: '3', label: m.product_fact_attempts() },
    { value: '8', label: m.product_fact_scales() },
    { value: '0', label: m.product_fact_peek() },
    { value: '1', label: m.product_fact_next() },
  ] as const

  const principles = [
    { title: m.product_p_blind_title(), body: m.product_p_blind_body() },
    { title: m.product_p_speed_title(), body: m.product_p_speed_body() },
    { title: m.product_p_errors_title(), body: m.product_p_errors_body() },
    { title: m.product_p_next_title(), body: m.product_p_next_body() },
  ] as const

  return (
    <article className="landing">
      {/* ---- Hero ------------------------------------------------------------------------ */}
      <section className="hero" aria-labelledby="product-title">
        <div className="hero__frame">
          <HeroBackdrop motion={motion} playing={playing} />

          <div className="hero__top">
            <span className="hero__tag">{m.product_layouts()}</span>
            {animated && (
              <button
                type="button"
                className="hero__pause"
                aria-pressed={!playing}
                aria-label={playing ? m.product_motion_pause() : m.product_motion_play()}
                onClick={() => setPlaying((value) => !value)}
              >
                {playing ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <rect x="2" y="1" width="3.5" height="12" rx="1" />
                    <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <path d="M3 1.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 3 1.5Z" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {/* The brand's hero: the wordmark set across nearly the whole frame, white on the red
              duotone. Decorative: the h1 below carries the words. */}
          <div className="hero__mark" aria-hidden="true">
            <span className="hero__mark-line">
              <Wordmark className="hero__wordmark" />
            </span>
          </div>

          <div className="hero__content">
            <div className="hero__text">
              <h1 id="product-title" className="hero__title">
                <span className="hero__line">
                  <span style={order(2)}>{m.product_hero_line1()}</span>
                </span>{' '}
                <span className="hero__line">
                  <span style={order(3)}>
                    {m.product_hero_line2()}
                    <span className="dot dot--white" aria-hidden="true" />
                  </span>
                </span>
              </h1>
              <p className="hero__lede">{m.product_lead()}</p>
              <div className="hero__cta">
                <Link to={PRACTICE} className={`${buttonClass('primary', 'lg')} hero__cta-white`}>
                  {m.product_cta_start()}
                </Link>
                <a href="#method" className={`${buttonClass('secondary', 'lg')} hero__cta-veil`}>
                  {m.product_cta_how()}
                </a>
              </div>
            </div>

            <div className="hero__aside">
              <TypingSpecimen playing={playing && animated} still={motion === 'off'} />
            </div>
          </div>
        </div>
      </section>

      {/* ---- [01] Method: three stage cells, the live one in red ---------------------------- */}
      <Reveal
        as="section"
        id="method"
        data-section={m.product_section_method()}
        aria-labelledby="method-title"
        className="sec"
      >
        <div className="sec__head">
          <div data-reveal="" style={order(0)}>
            <Index n={1}>{m.product_section_method()}</Index>
            <h2 id="method-title" className="sec__title">
              {m.product_stages_title()}
            </h2>
          </div>
          <p className="sec__lede" data-reveal="" style={order(1)}>
            {m.product_stages_lede()}
          </p>
        </div>

        <ol className="stages">
          {stages.map((stage, i) => (
            <li
              key={stage.n}
              className="stage"
              data-live={stage.live || undefined}
              data-reveal=""
              style={order(i + 1)}
            >
              <div className="stage__top">
                <span className="stage__n">
                  [{String(stage.n).padStart(2, '0')}]{' '}
                  {m.product_stage_label({ n: String(stage.n) })}
                </span>
                <Chip tone={stage.live ? 'neutral' : 'muted'}>
                  {stage.live ? m.product_stage_now() : m.product_stage_later()}
                </Chip>
              </div>
              <h3 className="stage__name">{stage.name}</h3>
              <div className="stage__text">
                <p className="stage__title">{stage.title}</p>
                <p className="stage__body">{stage.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>

      {/* ---- [02] Accuracy: a manifesto beside offset number cells ------------------------ */}
      <Reveal
        as="section"
        id="accuracy"
        data-section={m.product_section_accuracy()}
        aria-labelledby="accuracy-title"
        className="sec sec--accuracy gp-host gp-host--ember"
      >
        <GradLayer tone="ember" seed={1} count={5} />
        <div className="accuracy">
          <div className="accuracy__text" data-reveal="" style={order(0)}>
            <Index n={2}>{m.product_section_accuracy()}</Index>
            <h2 id="accuracy-title" className="sec__title">
              {m.product_accuracy_title()}
            </h2>
            <p className="manifesto">
              {m.product_accuracy_a()}{' '}
              <span className="manifesto__red">{m.product_accuracy_b()}</span>
            </p>
          </div>
          {/* Two columns, the second set lower, so the four numbers read as a staggered
              pair of stacks rather than a table. */}
          <div className="facts">
            {[0, 1].map((column) => (
              <ul key={column} className="facts__col">
                {facts
                  .filter((_, i) => i % 2 === column)
                  .map((fact, i) => (
                    <li
                      key={fact.value}
                      className="fact"
                      data-reveal=""
                      style={order(i * 2 + column + 1)}
                    >
                      <span className="fact__num">{fact.value}</span>
                      <span className="fact__label">{fact.label}</span>
                    </li>
                  ))}
              </ul>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ---- [03] Principles: a torn headline and circled points ------------------------- */}
      <Reveal
        as="section"
        id="principles"
        data-section={m.product_section_principles()}
        aria-labelledby="principles-title"
        className="sec sec--card"
      >
        <div className="card gp-host gp-host--bright">
          <GradLayer tone="bright" seed={2} count={5} />
          <Index n={3} className="card__index">
            {m.product_section_principles()}
          </Index>
          <h2 id="principles-title" className="torn" data-reveal="" style={order(0)}>
            <span className="torn__a">{m.product_principles_a()}</span>{' '}
            <span className="torn__b">{m.product_principles_b()}</span>
          </h2>

          <div className="card__body">
            <div className="card__aside" data-reveal="" style={order(1)}>
              <p className="card__lede">{m.product_audit_body()}</p>
              <Link to={FORMULAS} className="ulink">
                {m.product_audit_link()}
              </Link>
            </div>
            <ol className="points">
              {principles.map((point, i) => (
                <li key={point.title} className="point" data-reveal="" style={order(i + 2)}>
                  <span className="point__n" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="point__title">{point.title}</h3>
                    <p className="point__body">{point.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Reveal>

      {/* ---- [04] Start: a poster headline and one enormous red pill -------------------- */}
      <Reveal
        as="section"
        id="start"
        data-section={m.product_section_start()}
        aria-labelledby="start-title"
        className="sec sec--lead gp-host gp-host--bright"
      >
        <GradLayer tone="bright" seed={7} count={4} />
        <div className="lead__top">
          <div data-reveal="" style={order(0)}>
            <Index n={4}>{m.product_section_start()}</Index>
            <h2 id="start-title" className="lead__title">
              <span>{m.product_final_a()}</span>{' '}
              <span>
                {m.product_final_b()}
                <span className="dot" aria-hidden="true" />
              </span>
            </h2>
          </div>
          <p className="lead__lede" data-reveal="" style={order(1)}>
            {m.product_final_lede()}
          </p>
        </div>
        <Link to={PRACTICE} className="submit" data-reveal="" style={order(2)}>
          <span>{m.product_cta_start()}</span>
          <svg width="44" height="24" viewBox="0 0 44 24" aria-hidden="true">
            <path
              d="M0 12h40M30 2l10 10-10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            />
          </svg>
        </Link>
      </Reveal>
    </article>
  )
}

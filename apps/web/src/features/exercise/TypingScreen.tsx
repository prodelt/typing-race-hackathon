import type { AttemptMode, AttemptSummary, Layout } from '@typing-race/domain'
import type { Engine } from '@typing-race/engine'
import { useCallback } from 'react'
import { m } from '../../paraglide/messages.js'
import { Hud } from './Hud.js'
import './play.css'
import { KeyboardGuide } from './KeyboardGuide.js'
import { FingerDiagram, NextKeyCard } from './NextKey.js'
import { PaceCue } from './PaceCue.js'
import { TypingLine } from './TypingLine.js'
import type { ExerciseTarget, ExerciseWording } from './wording.js'

export interface TypingScreenProps {
  readonly engine: Engine
  readonly scale: ExerciseTarget
  readonly wording: ExerciseWording
  readonly mode: AttemptMode
  readonly layout: Layout
  readonly text: string
  readonly sizePx: number
  readonly unlocked: readonly string[]
  readonly keyConfidence: Readonly<Record<string, number | undefined>>
  readonly last: AttemptSummary | null
}

/**
 * The attempt in Play Mode (direction B): one centred block — the HUD, the typing line with its
 * progress stations, and in a Practice Attempt the keyboard beside the next-key card.
 *
 * **Zero-peek is decided here, by not rendering.** In a Test Attempt the keyboard, the next-key
 * card, the finger diagram and the last-exercise numbers in the HUD do not exist in the document:
 * `mode === 'practice' && ...` yields no node, rather than a node that CSS hides.
 *
 * The typing line is the first thing under the HUD, and its own box has a height that depends on
 * the text size alone, so it sits at the same vertical position in both modes.
 *
 * Every child below is `memo`-ed and takes only values that cannot change during an attempt, so
 * the parent re-rendering on pause cannot reach a DOM node either.
 */
export function TypingScreen({
  engine,
  scale,
  wording,
  mode,
  layout,
  text,
  sizePx,
  unlocked,
  keyConfidence,
  last,
}: TypingScreenProps) {
  const pause = useCallback(() => {
    if (engine.view.state === 'running') engine.pause()
  }, [engine])

  return (
    <div className="play" data-mode={mode}>
      <Hud wording={wording} mode={mode} last={last} onPause={pause} />

      <div className="play__line">
        <TypingLine engine={engine} text={text} sizePx={sizePx} />
        <PaceCue engine={engine} scale={scale} text={text} />
      </div>

      {mode === 'practice' ? (
        <div className="play__guide">
          <KeyboardGuide
            engine={engine}
            text={text}
            layout={layout}
            unlocked={unlocked}
            keyConfidence={keyConfidence}
          />
          <aside className="play__next">
            <NextKeyCard engine={engine} text={text} layout={layout} />
            <FingerDiagram engine={engine} text={text} layout={layout} />
          </aside>
        </div>
      ) : (
        <p className="play__zero">{m.exercise_rail_zero_peek()}</p>
      )}
    </div>
  )
}

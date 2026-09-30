import type { AttemptMode, AttemptSummary, Layout } from '@typing-race/domain'
import type { Engine } from '@typing-race/engine'
import { KeyboardGuide } from './KeyboardGuide.js'
import { FingerDiagram, NextKeyCard } from './NextKey.js'
import { PaceCue } from './PaceCue.js'
import { Rail } from './Rail.js'
import { TypingLine } from './TypingLine.js'
import type { ExerciseTarget, ExerciseWording } from './wording.js'
import './exercise.css'

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
  readonly thisScaleIsNext: boolean | null
}

/**
 * The typing screen: a quiet rail of plain type, and beside it the typing line on its own panel
 * with, in a Practice Attempt, the guides underneath.
 *
 * **Zero-peek is decided here, by not rendering.** In a Test Attempt the keyboard, the next-key
 * card, the finger diagram and the speed/accuracy figures (inside the rail) do not exist in the
 * document: `mode === 'practice' && ...` yields no node, rather than a node that CSS hides. A hidden
 * element is still in the accessibility tree, still in the DOM for an extension to read, and still
 * one `display` toggle from a learner's curiosity; absence is the only form zero-peek accepts.
 *
 * The typing line is the first child of a column whose top is fixed, and its own box has a height
 * that depends on the text size alone, so it sits at the same vertical position in a Practice
 * Attempt, where guides follow it, and in a Test Attempt, where nothing does.
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
  thisScaleIsNext,
}: TypingScreenProps) {
  return (
    <div className="attempt">
      <Rail wording={wording} mode={mode} last={last} thisScaleIsNext={thisScaleIsNext} />

      <div className="attempt__main">
        <div>
          <TypingLine engine={engine} text={text} sizePx={sizePx} />
          <PaceCue engine={engine} scale={scale} text={text} />
        </div>

        {mode === 'practice' ? (
          <div className="attempt__guides">
            <KeyboardGuide
              engine={engine}
              text={text}
              layout={layout}
              unlocked={unlocked}
              keyConfidence={keyConfidence}
            />
            <div className="attempt__hands">
              <NextKeyCard engine={engine} text={text} layout={layout} />
              <FingerDiagram engine={engine} text={text} layout={layout} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

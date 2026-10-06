import {
  type AcademyCourse,
  academyLevel,
  academyProgress,
  catalogue,
  DEFAULT_GOAL_MINUTES,
  dailyGoal,
  dayKeyAtOffset,
  deriveProgress,
  isAcademyExerciseId,
  isFreePracticeId,
  layouts,
  levelForStage,
  levelStanding,
  type MasteryCount,
  streakOf,
  typedByHand,
} from '@typing-race/curriculum'
import type { AttemptSummary, LayoutId, StartingLevelChoice } from '@typing-race/domain'
import { useMemo } from 'react'
import { useAcademyCourse } from '../../features/academy/data.js'
import { useRaceStanding } from './raceStanding.js'
import { useAppStore } from './store.js'

/**
 * The game layer's numbers for the status bar and Home: Level, XP, Streak and the daily goal.
 *
 * Every value is a fold over the attempt history (ADR-0004); the rules live in
 * `@typing-race/curriculum`'s `game/` and this file only wires the app's state into them.
 */

export interface GameStats {
  readonly level: number
  readonly xpInLevel: number
  readonly xpForNextLevel: number
  readonly streak: { readonly days: number; readonly freezes: number }
  readonly dailyGoal: {
    readonly minutesToday: number
    readonly goalMinutes: number
    readonly last7: readonly { readonly date: string; readonly minutes: number }[] // oldest first, ISO yyyy-mm-dd, today last
  }
  /** The server-computed Race Rating, or `null` while there is none to show (`raceStanding.ts`). */
  readonly raceRating: number | null
}

/** The learner's local calendar day of an instant, honouring the zone's offset at that instant. */
export function localDay(ms: number): string {
  return dayKeyAtOffset(ms, -new Date(ms).getTimezoneOffset())
}

export interface GameStatsInput {
  /** Every attempt, any layout. Level and XP read the current layout's; streak and minutes all. */
  readonly attempts: readonly AttemptSummary[]
  readonly layoutId: LayoutId
  /** `null` before the starting-level question is answered: nothing is unlocked yet. */
  readonly startingLevelChoice: StartingLevelChoice | null
  /** The Academy course for this layout, or `null` while it loads (modules then count as 0). */
  readonly academyCourse: AcademyCourse | null
  /** Today's local day key, `yyyy-mm-dd`. */
  readonly today: string
  readonly dayOf?: (ms: number) => string
  /** The Race Rating the server last reported, if any. */
  readonly raceRating?: number | null
  /** Settings carry no goal yet, so this defaults to the constant. */
  readonly goalMinutes?: number
}

/** Each attempt is judged against the floor of the level its stage is in — the Mastery Rule's. */
function floorFor(attempt: AttemptSummary): number {
  return isAcademyExerciseId(attempt.scaleId)
    ? academyLevel.accuracyFloor
    : levelForStage(1).accuracyFloor
}

export function deriveGameStats(input: GameStatsInput): GameStats {
  const layout = layouts[input.layoutId]
  const scales = catalogue[input.layoutId]
  const course = input.academyCourse?.layout === input.layoutId ? input.academyCourse : null
  const { startingLevelChoice } = input
  // Typing no hand produces earns nothing here: no XP, no level, no streak day, no minutes
  // (ADR-0003, 2026-10-06). It keeps its result screen and its place in the profile's list.
  const attempts = input.attempts.filter(typedByHand)

  const masteryAt = (prefix: readonly AttemptSummary[]): MasteryCount => ({
    keysUnlocked:
      startingLevelChoice === null
        ? 0
        : deriveProgress({ attempts: prefix, layout, catalogue: scales, startingLevelChoice })
            .unlockedSet.length -
          layout.homeAnchors.length -
          1, // the space bar
    modulesCompleted: course === null ? 0 : academyProgress(course, prefix).modulesComplete,
  })

  // Free practice (the daily challenge, own text) earns no XP and counts toward neither the streak
  // nor the daily goal.
  const counted = attempts.filter((attempt) => !isFreePracticeId(attempt.scaleId))
  const standing = levelStanding({
    attempts: counted.filter((attempt) => attempt.layoutId === input.layoutId),
    masteryAt,
    floorFor,
  })
  const dayOf = input.dayOf ?? localDay

  return {
    level: standing.level,
    xpInLevel: standing.xpInLevel,
    xpForNextLevel: standing.xpForNextLevel,
    streak: streakOf(
      counted.map((attempt) => dayOf(attempt.completedAt)),
      input.today,
    ),
    dailyGoal: dailyGoal(counted, {
      today: input.today,
      dayOf,
      goalMinutes: input.goalMinutes ?? DEFAULT_GOAL_MINUTES,
    }),
    raceRating: input.raceRating ?? null,
  }
}

/**
 * Recomputed only when the attempt history, the layout, the starting level, the Academy course or
 * the calendar day changes — never per keystroke, which never reaches the store (ADR-0002).
 */
export function useGameStats(): GameStats {
  const attempts = useAppStore((state) => state.attempts)
  const layoutId = useAppStore((state) => state.settings.layoutId)
  const language = useAppStore((state) => state.settings.typingLanguage)
  const startingLevelChoice = useAppStore((state) => state.startingLevelChoice)
  const courseState = useAcademyCourse(language)
  const academyCourse = courseState.status === 'ready' ? courseState.course : null
  const today = localDay(Date.now())
  const raceRating = useRaceStanding((state) =>
    state.standing.kind === 'rated' ? state.standing.rating : null,
  )

  return useMemo(
    () =>
      deriveGameStats({
        attempts,
        layoutId,
        startingLevelChoice,
        academyCourse,
        today,
        raceRating,
      }),
    [attempts, layoutId, startingLevelChoice, academyCourse, today, raceRating],
  )
}

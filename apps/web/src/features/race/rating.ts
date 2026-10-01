/**
 * The Race Rating rule, in TypeScript.
 *
 * The rating is computed on the server (`supabase/migrations/20261001140000_race_rating.sql`,
 * `rate_race`) when a room finishes; the browser only reads it. This mirror exists so the rule has
 * unit tests and so the lobby's "how it is counted" line quotes real constants. The two must stay
 * equal: change one, change both.
 *
 * Multiplayer Elo:
 * - everyone starts at {@link RATING_START};
 * - every pair of rated racers in a finished room is one game: the higher score wins, equal scores
 *   draw;
 * - expected = 1 / (1 + 10 ^ ((their rating − my rating) / 400));
 * - change = round(K × Σ(actual − expected) / (racers − 1)), never below {@link RATING_FLOOR}.
 *
 * A score is the room's validated score; an unvalidated result, one below the 90% accuracy floor,
 * and an unfinished race all count as 0 (last place). Fewer than two racers rates nothing.
 */

export const RATING_START = 1000
export const RATING_K = 32
export const RATING_FLOOR = 100
/** Matches `finish-race`: below it a result is shown but scores 0. */
export const RATING_ACCURACY_FLOOR = 0.9

export interface RatedRacer {
  readonly userId: string
  /** The rating before this race; {@link RATING_START} for a first race. */
  readonly rating: number
  /** The room's score for this racer, already 0 when it does not count. */
  readonly score: number
}

export interface RatingChange {
  readonly userId: string
  readonly before: number
  readonly after: number
  readonly delta: number
}

/** The score a result counts as for the rating. */
export function ratedScore(
  result: { readonly validated: boolean; readonly accuracy: number; readonly score: number } | null,
): number {
  if (result === null || !result.validated || result.accuracy < RATING_ACCURACY_FLOOR) return 0
  return result.score
}

export function expectedScore(mine: number, theirs: number): number {
  return 1 / (1 + 10 ** ((theirs - mine) / 400))
}

/** Postgres `round(numeric)`: half away from zero. `Math.round` would send −0.5 to 0. */
function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}

/** One finished room's rating changes. Empty when fewer than two racers count. */
export function rateRoom(field: readonly RatedRacer[]): RatingChange[] {
  if (field.length < 2) return []
  return field.map((me) => {
    let surplus = 0
    for (const them of field) {
      if (them.userId === me.userId) continue
      const actual = me.score > them.score ? 1 : me.score === them.score ? 0.5 : 0
      surplus += actual - expectedScore(me.rating, them.rating)
    }
    const after = Math.max(
      RATING_FLOOR,
      me.rating + roundHalfAway((RATING_K * surplus) / (field.length - 1)),
    )
    return { userId: me.userId, before: me.rating, after, delta: after - me.rating }
  })
}

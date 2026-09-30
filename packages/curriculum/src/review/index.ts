export type { ReviewDrill, ReviewDrillArgs } from './drill'
export {
  buildReviewDrill,
  isReviewDrillId,
  parseReviewDrillId,
  REVIEW_DRILL_SIZE,
  REVIEW_DRILL_SPOTS,
  reviewDrillId,
} from './drill'
export type { RealText, RealTextArgs, RealTextKind } from './real-text'
export {
  courseSentences,
  isRealTextId,
  MIN_SENTENCES,
  REAL_TEXT_SIZE,
  realTextBlock,
  realTextId,
} from './real-text'
export type { SpotStats, SpotVerdict, WeakSpot } from './weak-spots'
export {
  compareSpot,
  ERROR_RATE_FLOOR,
  elementStats,
  REVIEW_WINDOW,
  rankWeakSpots,
  SLOW_IKI_MS,
  spotScore,
  statsOf,
  sumAggregates,
  WEAK_SPOT_LIMIT,
} from './weak-spots'

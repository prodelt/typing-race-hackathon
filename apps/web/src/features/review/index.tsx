/**
 * Weak-spot review. `app/router.tsx` imports `ReviewScreen`; the exercise screen imports
 * `ReviewDrill.tsx` and the result screen `Outcome.tsx` directly, so neither pulls the review page
 * into its own chunk.
 */
export { ReviewScreen } from './ReviewScreen.js'

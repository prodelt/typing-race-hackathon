import { create } from 'zustand'

/**
 * Keeps the first run on screen while it commits its answers.
 *
 * Home and the Map show the first run while the learner has no starting level. The last step
 * records one and then opens the first exercise; without this flag the hub would flash up for the
 * frames in between, because recording the level is what ends the "no starting level" state. The
 * flow raises it before committing and lowers it when it unmounts.
 *
 * Its own tiny module rather than part of the flow, so Home (the one eagerly loaded screen) can
 * read it without pulling the flow into the entry chunk.
 */
export const useFirstRunHold = create<{ readonly holding: boolean }>(() => ({ holding: false }))

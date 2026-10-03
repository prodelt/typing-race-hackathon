import {
  findExercise,
  isAcademyExerciseId,
  isRealTextId,
  isReviewDrillId,
  isWordDrillId,
  resolveWordDrill,
  scaleById,
} from '@typing-race/curriculum'
import type { Layout } from '@typing-race/domain'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { languageOfExercise, loadAcademyCourse } from '../academy/data.js'
import { drillName } from '../words/labels.js'
import { scaleName } from './model.js'

/**
 * What the result header calls the exercise that was just typed. Every family of exercise has its
 * own name here, so the header never falls back to an id such as `academy.uk.bigrams.1`.
 *
 * An Academy exercise's title lives in the course data, which loads lazily; until it arrives (or
 * if it never does) the header says "Academy exercise".
 */
export function exerciseLabel(
  layout: Layout,
  scaleId: string,
  academyTitle: string | null = null,
): string {
  const scale = scaleById(layout, scaleId)
  if (scale !== undefined) return scaleName(scale)
  if (isWordDrillId(scaleId)) {
    const drill = resolveWordDrill(scaleId)
    return drill === undefined ? m.result_label_words() : drillName(drill)
  }
  if (isReviewDrillId(scaleId)) return m.review_drill_title()
  if (isRealTextId(scaleId)) return m.session_realtext_title()
  if (isAcademyExerciseId(scaleId)) return academyTitle ?? m.result_label_academy()
  return m.result_label_exercise()
}

/** The title of an Academy exercise, once the course has loaded; `null` for any other exercise. */
export function useAcademyTitle(scaleId: string): string | null {
  const language = isAcademyExerciseId(scaleId) ? languageOfExercise(scaleId) : undefined
  const [title, setTitle] = useState<string | null>(null)
  useEffect(() => {
    setTitle(null)
    if (language === undefined) return
    let live = true
    loadAcademyCourse(language).then(
      (course) => {
        if (live) setTitle(findExercise(course, scaleId)?.exercise.title ?? null)
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [language, scaleId])
  return title
}

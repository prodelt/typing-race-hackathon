import { type AcademyCourse, parseAcademyCourse } from '@typing-race/curriculum'
import type { Language, Scale } from '@typing-race/domain'
import { useEffect, useState } from 'react'

/**
 * The Academy courses (`data/curriculum/<lang>/academy.json`), loaded lazily per language so they
 * never enter the initial bundle. Each is its own chunk, parsed and validated once.
 */

const loaders: Record<Language, () => Promise<{ default: unknown }>> = {
  uk: () => import('../../../../../data/curriculum/uk/academy.json'),
  en: () => import('../../../../../data/curriculum/en/academy.json'),
}

const courses = new Map<Language, Promise<AcademyCourse>>()

export function loadAcademyCourse(language: Language): Promise<AcademyCourse> {
  let course = courses.get(language)
  if (course === undefined) {
    course = loaders[language]().then((module) => parseAcademyCourse(module.default))
    courses.set(language, course)
  }
  return course
}

export type CourseState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly course: AcademyCourse }
  | { readonly status: 'error' }

export function useAcademyCourse(language: Language): CourseState {
  const [state, setState] = useState<CourseState>({ status: 'loading' })
  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    loadAcademyCourse(language).then(
      (course) => live && setState({ status: 'ready', course }),
      () => live && setState({ status: 'error' }),
    )
    return () => {
      live = false
    }
  }, [language])
  return state
}

/** Academy exercise ids carry their language: `academy.uk.bigrams.1`. */
export function languageOfExercise(id: string): Language | undefined {
  const language = id.split('.')[1]
  return language === 'uk' || language === 'en' ? language : undefined
}

/**
 * The engine and the attempt controller were written for Stage 1 Scales and read only the id, the
 * layout and (for the metronome) `targetSpm`. An Academy exercise is given that shape here; the
 * other fields are inert.
 */
export function scaleShapeOf(
  exercise: { readonly id: string; readonly targetSpm: number | null; readonly text: string },
  layoutId: Scale['layoutId'],
): Scale {
  return {
    id: exercise.id,
    layoutId,
    type: exercise.targetSpm === null ? 'run' : 'tempo',
    focus: { kind: 'key', value: ' ' },
    fingers: [],
    size: [...exercise.text].length,
    targetSpm: exercise.targetSpm,
    goal: '',
    requires: [],
  }
}

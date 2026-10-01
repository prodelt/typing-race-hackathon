import {
  CONFIDENCE_HALF_LIFE,
  CONFIDENCE_MIN_SAMPLES,
  REFERENCE_IKI_MS,
  RHYTHM_BREAK_MS,
} from '@typing-race/metrics'
import { m } from '../../paraglide/messages.js'
import { Block, Formula, P, Section } from './Formula.js'

/** Inter-keystroke interval, rhythm consistency and Confidence — research R4 and R5. */
export function Rhythm() {
  return (
    <Section id="rhythm" title={m.formulas_rhythm_title()}>
      <Block title={m.formulas_iki_title()}>
        <Formula>{'iki[i] = t[i] − t[i−1]   (ms)'}</Formula>
        <P>{m.formulas_iki_body()}</P>
      </Block>

      <Block title={m.formulas_rhythm_subtitle()}>
        <Formula>
          {[
            'cv                = stdev(iki) / mean(iki)',
            'stdev             = √( Σ(iki − mean)² / n )',
            'rhythmConsistency = 100 × max(0, 1 − cv)',
          ].join('\n')}
        </Formula>
        <P>{m.formulas_rhythm_body()}</P>
        <P>{m.formulas_rhythm_eligible({ ms: RHYTHM_BREAK_MS })}</P>
        <P>{m.formulas_rhythm_small()}</P>
      </Block>

      <Block title={m.formulas_conf_title()}>
        <Formula>
          {[
            'n              = wHits + wMisses',
            'accuracyFactor = wHits / n',
            'meanIki        = wSumIki / wHits',
            `speedFactor    = min(1, ${REFERENCE_IKI_MS} / meanIki)`,
            `confidence     = n < ${CONFIDENCE_MIN_SAMPLES} ? unmeasured : accuracyFactor × speedFactor`,
          ].join('\n')}
        </Formula>
        <P>{m.formulas_conf_body()}</P>
        <P>{m.formulas_conf_decay({ half: CONFIDENCE_HALF_LIFE })}</P>
        <P>{m.formulas_conf_timing()}</P>
        <P>{m.formulas_conf_unmeasured({ min: CONFIDENCE_MIN_SAMPLES })}</P>
        <div className="ref-callout">
          <h4 className="ref-callout__title">{m.formulas_conf_gates_head()}</h4>
          <P>{m.formulas_conf_gates_body()}</P>
        </div>
      </Block>
    </Section>
  )
}

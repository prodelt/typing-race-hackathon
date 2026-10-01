import { FirstRun } from './FirstRun.js'

export { FirstRun }

/** `/start`: Settings' "start over" — the first run again, with nothing deleted. */
export function FirstRunScreen() {
  return <FirstRun mode="again" />
}

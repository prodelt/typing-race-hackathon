/**
 * Lets plain Node (24+, native type stripping) run the pipeline's TypeScript, which imports the
 * workspace sources the way the bundler does: extensionless, or with a `.js` suffix that names a
 * `.ts` file. Only relative specifiers are touched; everything else resolves as usual.
 */
import { registerHooks } from 'node:module'

function candidates(specifier) {
  if (specifier.endsWith('.js')) return [`${specifier.slice(0, -3)}.ts`, specifier]
  if (/\.(?:[cm]?[jt]s|json)$/.test(specifier)) return [specifier]
  return [`${specifier}.ts`, `${specifier}/index.ts`, specifier]
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('.')) return nextResolve(specifier, context)
    let lastError
    for (const candidate of candidates(specifier)) {
      try {
        return nextResolve(candidate, context)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError
  },
})

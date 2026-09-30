# Side effects go through apps/web/src/seams

No code outside `apps/web/src/seams/` touches IndexedDB, the Cache API, `performance.now()`,
`Math.random()` or a DOM input event, so the engine and metrics are deterministic under test.
`tools/architecture.test.ts` enforces it and lists the exemptions.

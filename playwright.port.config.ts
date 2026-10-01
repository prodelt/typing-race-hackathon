import base from './playwright.config'

// Local only, not committed: another worktree's preview server holds the default port.
const PORT = 4391
export default {
  ...base,
  webServer: {
    ...base.webServer,
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
  },
  use: { ...base.use, baseURL: `http://127.0.0.1:${PORT}` },
}

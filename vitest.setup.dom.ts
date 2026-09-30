import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library's auto-cleanup only registers itself when it can see a global `afterEach`;
// Vitest has globals off here, so the projects that render components do it explicitly.
afterEach(cleanup)

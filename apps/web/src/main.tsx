import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root is missing from index.html')

// T059-T064 replace this placeholder with the router, the shell and the boot sequence.
createRoot(rootElement).render(<StrictMode />)

# 01 Frontend Framework Choice

Type: grilling
Status: open
Blocked by: none

## Question

Which frontend framework and state management architecture should power the client application:
1. **Option A (Vite + React 19 + TypeScript + Zustand + Tailwind CSS)**:
   - Rich ecosystem for Supabase Auth, Chart.js/Recharts/Canvas heatmaps, Lucide icons.
   - Zustand unbuffered state store with `requestAnimationFrame` for sub-16ms typing loop.
   - Zero-config static build on Vercel.
2. **Option B (Vite + Svelte 5 (Runes) + TypeScript + Tailwind CSS)**:
   - Surgical reactivity without Virtual DOM, extremely lightweight bundle.
   - Fewer ready-to-use component libraries for complex animated dashboards.
3. **Option C (Next.js 15 App Router + React 19)**:
   - Fullstack server-rendering capability.
   - SSR/Hydration overhead can interfere with input capture and client-side keystroke focus.

## Options for Human Decision
- Option A (Recommended)
- Option B
- Option C

# 02 Stitch Design System & Screens

Type: prototype
Status: resolved
Blocked by: none

## Question

How should the visual system, color palette, and screen hierarchy be structured to ensure:
1. Calming, soft-light aesthetics ("Serene Script" paper & ink concept) that eliminate eye fatigue.
2. Compliance with the hackathon rule for zero-peek test mode (hidden on-screen prompts during tests).
3. Clear visualization of touch-typing finger assignments for QWERTY and Ukrainian ЙЦУКЕН.
4. Actionable post-test analytics with error/transition heatmaps and immediate next recommendations.

## Resolution

- **Stitch Project**: `projects/16341605640151885435` ("Typing Race - Touch Typing & Speed Platform")
- **Design System Asset**: `assets/9ced6444521c468ca8a9268434cc1404` ("Serene Script")
- **Design Palette**:
  - Background (Paper Cream): `#FAF9F5` / `#F8FAF5`
  - Text (Soft Slate): `#2D312E` / `#191C19`
  - Primary / Progress (Sage Green): `#4A7C59` / `#316342`
  - Error / Alert (Gentle Terracotta): `#D95D39` / `#BA1A1A`
  - Upcoming Text / Muted: `#94A3B8` / `#717971`
- **Generated Screens**:
  1. `7db552de3e5a4f4eb606d6c2dd3b4f25` - **TypingRace - Words Mode (Stage 2)**: 28px serif typing text, live HUD (CPM/WPM/Accuracy/Timer), smooth pulsing caret, minimalist hands guide with zero-peek test mode toggle.
  2. `42d924cb31ab4af2bdc0f00fac728a00` - **TypingRace - Academy & Analytics Dashboard (Stage 3)**: Prominent actionable feedback banner ("Повтори перехід «ол» правим вказівним і середнім пальцями"), interactive key & transition delay heatmap, curriculum stage progression roadmap.

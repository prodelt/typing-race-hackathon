# 06 Dictionary Pipeline & Licensing Integrity

Type: task
Status: open
Blocked by: none

## Question

How should the raw dictionary sources in `tasks/Typing-Race-2026-Hackathon/dictionaries/` be processed and surfaced:

1. **Processing Pipeline**:
   - Extraction of `english-all.zip` and `ukrainian-all.zip` into `data/raw/`.
   - Node.js pipeline script `scripts/build-derived-dictionaries.mjs`:
     - Normalizes Unicode (NFC, standardizes Ukrainian apostrophes).
     - Filters profanity and proper nouns.
     - Computes word character sets, bigrams, and frequency weights.
     - Outputs deterministic JSON in `data/derived/` with verifiable SHA-256 checksums matching the manifest.
2. **License Page**:
   - Dedicated `/licenses` view displaying exact origin, author, license type (MIT, GPL, CC), and attribution for Hunspell, FrequencyWords, and Brown-UK.

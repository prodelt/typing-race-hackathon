# 03 Dictionary Processing Pipeline & Derived N-Grams

Type: task
Status: open
Blocked by: none

## Question

How should the raw dictionary archives (`english-all.zip`, `ukrainian-all.zip` and raw text sources in `tasks/Typing-Race-2026-Hackathon/dictionaries/`) be transformed into:
1. Immutable derived JSON datasets in `data/derived/` with Unicode normalization, checksum validation, and frequency ranking.
2. Pedagogical Stage 2 word banks strictly filtered by unlocked keys.
3. Pedagogical Stage 3 Academy frequency n-grams (bigrams, trigrams, morphemes, suffixes).
4. Reproducible Node.js build scripts that guarantee deterministic output (Hackathon rule 8: "Повторний запуск обробки на тих самих даних дає той самий результат").

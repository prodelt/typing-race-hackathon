# 12 Grilling: Dictionary pipeline & exercise generation

Type: grilling
Status: resolved
Blocked by: 08, 10

## Question

How do raw word lists become exercises that serve the pedagogical model?

Decide:
- which source snapshots are vendored into `dictionaries/`;
- the derived data layout (`data/derived/`, `data/curriculum/`);
- normalization and filter rules;
- the word record schema (TZ §5.3);
- difficulty scoring: same-finger transitions, row changes;
- n-gram tables;
- Stage 1 scales: authored or generated;
- Stage 2 word selection restricted to unlocked characters, with adaptation to the learner's errors and slow transitions;
- Academy module generation;
- pseudo-word labeling;
- where generation runs (build time vs client runtime);
- determinism and checksum verification (TZ §8.3, §8.6–8.8).

Inputs: `archive/2026-09-03-map/03-dictionary-processing-pipeline.md` and `archive/2026-09-03-map/06-dictionary-pipeline-and-licensing.md`.

Inputs from research 08:
- Licences: vendor all four sources; MIT for code plus per-file data licences in `data/LICENSES.md`; use hunspell-uk as a **build-time filter only**, never emitting its word material; FrequencyWords derived tables follow the stricter CC-BY-SA-4.0 claim.
- Normalization: NFC only (NFKC only as a mojibake detector); store apostrophe U+0027, display U+2019, fold all variants on both sides; never case-fold; never touch і/ї/є/ґ.
- Filtering: a strict alphabet filter is not enough (Russian survives; `что` is the 5th-heaviest trigram). Hunspell membership is the real filter: uk 50 000 → 27 184, en → 36 900. Proper nouns need a double hunspell query (2 530 flagged), since both lists are all-lowercase. Profanity: LDNOOBW V2 (CC0, uk 205 terms).
- n-grams: take the literal TZ §3.3 reading (once per word); per-occurrence differs by 0.4% and the top 30 are identical.
- Open: source of apostrophe drill words; removing residual Russian (`мне`, `его`).

## Answer

## Decisions — grilling round 1 (2026-09-18)

- **Vendored snapshots (`dictionaries/`):** only what the pipeline reads — `uk_50k`, `en_50k`, hunspell-uk, hunspell-en, dwyl, LDNOOBW V2 (uk, en) — with our own `manifest.yml` and `CHECKSUMS.sha256`. The `*_full` lists are recorded in the manifest as deliberately excluded: measured, they add **zero** words with frequency ≥ 50 for the 8 home-row ЙЦУКЕН keys (both lists give the same 39), at +25 MB. Organizer REVIEW_REQUIRED material is not committed (ticket 18).
- **Sentences, paragraphs, race texts:** an **authored corpus** — AI-drafted, human-reviewed, flagged `authored`, Hunspell-validated at build time; roughly 300 sentences and 60 paragraphs per language, modern orthography, deliberately covering apostrophe, `ґ`, hyphen, quotes and numbers. No public-domain classics, no Tatoeba.
- **Filters:**
  - residual Russian: an authored `denylist-uk`, built by manually reviewing the top 3 000 filtered words; a test asserts marker words are absent from the bank;
  - proper nouns (double Hunspell query): moved to a separate **capitalisation bank**, flagged `proper`, capitalised by us (`Київ`, `Олена`) for Shift drills; Hunspell only answers the case question, its word material is never emitted;
  - profanity: dropped via LDNOOBW V2 for both languages, no exceptions.
- **Unlocked set is always a prefix of the unlock order.** The diagnostic only moves the boundary forward. Each word carries a precomputed `unlockIndex` (the highest unlock-order position among its characters); Stage 2 filtering is `unlockIndex ≤ n`, and client data is chunked by prefix.
- **Word record:** TZ §5.3 plus `rank`, `trigrams`, `unlockIndex`, `difficulty.handAlternations`, `difficulty.tier` (1–5), `flags` ∈ {`proper`, `apostrophe`, `hyphen`, `authored`, `pseudo`}. JSON Lines, one word per line. **Language fixes layout**: `uk` ⇔ ЙЦУКЕН, `en` ⇔ QWERTY, so difficulty metrics are single-valued per word.
- **Difficulty:** transparent tier rules — `tier` from rank band × length; `sameFingerTransitions` and `rowChanges` only order words within a tier. Rules published on the Formulas page. No weighted composite score.
- **Stage 1 scales:** an authored **scale catalogue** (§3.1 type, row/fingers, size, tempo); content generated at build time by pure functions over the per-layout finger map, tested so every character belongs to its declared finger.
- **Morphemes:** an authored list (~60 uk, ~40 en); weights and example words computed from the filtered bank.
- **Determinism (§8.6–8.8):** a pure Node pipeline in the `dictionary-pipeline` package — stable sort, canonical JSON, no timestamps, Node pinned (ICU/NFC version). `data/derived/` is **committed** with `derived-manifest.json` (input sha256, algorithm version, before/after counts per filter as §5.2 lists, output sha256). CI runs the pipeline twice and diffs both runs against the committed output. Hashed client chunks are Vite build output, not committed.

## Decisions — grilling round 2 (2026-09-18)

- **Stage 2 assembly runs on the client** as a pure function `buildExercise(bankChunk, n, confidenceMap, seed) → items` with a seeded PRNG (e.g. mulberry32, never `Math.random`). The seed is stored on the attempt, so any exercise can be reproduced for replay, bug reports and server-side validation.
- **Selection and fallback:** the focus element must appear in every item; at least K = 8 distinct items. Widen in order: (1) current tier, frequency-weighted → (2) neighbouring tiers → (3) capitalisation bank and authored words → (4) an explicitly labelled mechanics exercise of pseudo-words built from the focus bigram and unlocked letters → (5) if the focus cannot be typed with unlocked keys at all, the next-weakest element becomes the focus. Never a silent focus change.
- **Pseudo-words:** flagged `pseudo` in data, exercise type `mechanics`, and a visible "Механіка — не слова" badge naming the trained bigram. Never mixed with real words in one exercise. A mechanics exercise **does not count** toward a key unlock (that needs real words); Stage 1 scale test attempts do count.
- **Academy modules have fixed content**, generated at build time from an authored module catalogue into `data/curriculum/`, ordered per TZ §3.3 (pairs → syllables/morphemes → words → phrases → sentences → text → tempo). Adaptation comes from the session warm-up injecting weak elements, never from mutating a module — the three-attempt rule needs comparable attempts.
- **Phrases** are cut from the authored sentence corpus and manually reviewed; no cross-word frequency is claimed.
- **Exercise sizes** are catalogue parameters: scale 60–90 chars; Stage 2 20–25 words (~150 chars); Academy n-gram exercise ~150 chars; sentence/paragraph up to ~400 chars; tempo series 30–60 s. Exact numbers may be tuned in `speckit-clarify`.

## Round 3 and resolution (2026-09-18)

- **n-gram tables:** in-word bigrams and trigrams over the **filtered** bank, weight = sum of frequencies of words containing it (once per word). Each row: n-gram, weight, rank, fingers, transition class (`same-finger` / `alternation` / `roll-in` / `roll-out` / `same-hand-other`), `rowChanges`. Academy selections (same-finger, rolls, alternation, doubled letters) are queries over these tables, not separate tables. Published: top 500 bigrams, top 1 000 trigrams.
- **Layout:** `dictionaries/` (immutable snapshots + manifest + checksums); `data/authored/{uk,en}/` (denylist, apostrophe words, morphemes, sentences, paragraphs); `data/catalogue/` (scale catalogue, Academy module catalogue, exercise sizes, `layouts/` with the per-layout finger map and unlock order); `data/derived/{uk,en}/` (`words.jsonl`, `capitalised.jsonl`, `bigrams.json`, `trigrams.json`, `morphemes.json`, `phrases.json`, `derived-manifest.json`); `data/curriculum/{uk,en}/` (generated scales and Academy modules); `data/LICENSES.md`.
- Measured for this ticket: `uk_50k` has 471 hyphenated words, 117 with `ґ`, 786 with `ї`, 1 493 with `є` — only apostrophe words must be authored.

Resolved 2026-09-18. Glossary: Unlock Order, Word Bank, Difficulty Tier, Scale Catalogue added to `CONTEXT.md`.

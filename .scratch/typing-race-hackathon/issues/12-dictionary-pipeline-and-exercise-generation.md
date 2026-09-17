# 12 Grilling: Dictionary pipeline & exercise generation

Type: grilling
Status: open
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

# 08 Research — Dictionaries: licensing, normalization, filtering, n-grams, deterministic builds

Branch: `research/08-dictionaries`
Date: 2026-09-17
Ticket: `.scratch/typing-race-hackathon/issues/08-dictionaries-licensing-research.md`
Snapshot under study: `tasks/Typing-Race-2026-Hackathon/dictionaries/` (organizer snapshot dated 2026-08-30, gitignored in this repo)

All numbers in this file were measured locally on that snapshot with the read-only scripts in
[§10 Appendix](#10-appendix-scripts). Raw outputs are reproduced in [§7](#7-local-measurements).

---

## 1. Summary

**Licensing is not the hard part.** Every dataset we planned to use is vendor-able in a public
repo with a one-line attribution. The only real constraint is `hunspell-uk` (brown-uk/dict_uk),
whose upstream carries three different licence labels; we sidestep it entirely by using it as a
**build-time filter only** and never emitting its word material.

**The hard parts are data quality and determinism, and the measurements surprised us:**

1. **The Ukrainian frequency lists contain no apostrophes at all.** Zero occurrences of U+0027,
   U+2019 or U+02BC across all 340 325 entries of `uk_50k` + `uk_full`. The upstream tokeniser
   **deleted** it: `п'ять` appears as `пять 388`, `ім'я` as `імя 7`, `м'ясо` as `мясо 66`.
   So apostrophe drills (TZ §3.2, §3.3) cannot come from FrequencyWords. They must come from
   `hunspell-uk` (5 123 stems with an apostrophe) or a hand-written list.
2. **An alphabet filter is not enough for Ukrainian.** It removes 10.60% of `uk_50k`, but Russian
   written with letters Ukrainian also uses survives it completely — `что` is still the
   5th-heaviest Ukrainian trigram after alphabet filtering. A Hunspell membership filter is what
   actually cleans the list: 50 000 → 44 700 (alphabet) → 27 184 (real Ukrainian words), 54.4%.
3. **Capitalisation heuristics for proper nouns are dead on arrival.** Both `uk_50k` and `en_50k`
   are 100% lowercase — 0 entries begin with a capital. The workable substitute is a
   double Hunspell query (as-typed vs title-cased): 2 530 `uk_50k` entries match *only* a
   capitalised stem (`чарлі`, `джон`, `гаррі`, `майкл`, `сара`).
4. **The TZ §3.3 "count once per word" question barely matters.** Counting repeats changes total
   bigram weight by 0.39% (uk) / 0.37% (en) and leaves the top-30 set identical. Take the literal
   TZ reading (once per word) and add a separate `doubleLetter` feature.
5. **ЙЦУКЕН is ~3× more same-finger-heavy than QWERTY**: 18.58% of Ukrainian bigram weight is a
   same-finger transition vs 5.80% for English. That is a genuine pedagogical fact and should
   drive the Academy drill list (`то ро но го ть ка ог ак он ме`).
6. **NFC, never NFKC in the compare path.** All files are already NFC (0 non-NFC entries). NFKC
   would change 9 `uk_50k` / 5 `en_50k` / 318 `uk_full` entries — and would turn `ﬁrst` into a
   two-keystroke `first`, which breaks keystroke accounting. Use NFKC only as a *mojibake
   detector* at build time.
7. **Apostrophe, keyboard reality:** Windows "Ukrainian (Enhanced)" and the Linux xkb `ua` default
   both type **U+0027**; macOS "Ukrainian"/"Ukrainian – QWERTY" type **U+02BC**; published
   Ukrainian text uses **U+2019**. Hunspell `dict_uk` settles it operationally by folding
   everything to U+0027 (`ICONV ʼ '`, `ICONV ’ '`). Our rule: **display U+2019, compare on a key
   where every apostrophe variant folds to U+0027.** Nobody's keyboard is ever "wrong".
8. **Determinism is cheap if three rules hold**: integer-only n-gram arithmetic, code-unit sort
   (never `localeCompare` — `uk` and `en` collations disagree on `і` vs `ї` in our own test), and
   explicit LF + sorted JSON keys. `words_alpha.txt` is the only CRLF file in the snapshot; a
   naive `split('\n')` leaves `\r` on every English word.

Every file we touched matches its SHA-256 in `dictionaries/CHECKSUMS.sha256`, and every declared
record count in `manifest.yml` is exact.

---

## 2. License verdicts

Short, practical verdicts. No deep legal analysis — this is an internal hackathon with a public
GitHub repo.

| Dataset (snapshot path) | Licence as vendored | Vendor-able? | Attribution line for the "Sources and licenses" page |
|---|---|---|---|
| **FrequencyWords en/uk** `*/wordlists/frequencywords-2018/` (`en_50k`, `en_full`, `uk_50k`, `uk_full`) | `LICENSE` file = **MIT**, © 2016 Hermit Dave. Upstream README says *"MIT License for code. CC-by-sa-4.0 for content."* | **Yes.** Keep the MIT file beside the data. Treat **derived frequency tables as CC BY-SA 4.0** (the stricter of the two statements about the *content*). | "Word-frequency lists: **FrequencyWords** by Hermit Dave (rev `525f9b5`), built from the **OpenSubtitles2018** corpus via OPUS. Code MIT; list content CC BY-SA 4.0." |
| **dwyl/english-words** `english/wordlists/dwyl-english-words/words_alpha.txt` | **Unlicense** (public-domain dedication) | **Yes, no strings.** The safest English "real word" filter. | "English word list: **dwyl/english-words** (rev `20f5cc9`), released into the public domain under the Unlicense." |
| **hunspell-en** `english/wordlists/hunspell-en/` (SCOWL via wooorm/dictionaries) | `LICENSE` = SCOWL; `PACKAGE-LICENSE-MIT` = MIT © Titus Wormer. Manifest: "MIT AND BSD-compatible". | **Yes**, but the SCOWL grant extends to *"the output created from the scripts"* — so a list derived from it must carry the notice too. | "English spelling dictionary: **SCOWL** © 2000-2018 Kevin Atkinson, packaged by **wooorm/dictionaries** (rev `8cfea40`, MIT). Permission to use, copy, modify, distribute and sell these word lists, the associated scripts, the output created from the scripts, and its documentation is granted provided this notice appears in all copies." |
| **hunspell-uk** `ukrainian/wordlists/hunspell-uk/` (brown-uk/dict_uk via wooorm/dictionaries) | Vendored `LICENSE` = **GPL-3.0**. But dict_uk's own README says data are **CC BY-NC-SA 4.0** and software GPL-3.0; `distr/hunspell/README.md` says **MPL 1.1**. Three labels. | **Yes to vendoring the snapshot as-is** (it ships with its GPL-3.0 file). **Use it only as a build-time filter.** Do not put dict_uk word material into an MIT/CC-BY-SA output bundle. | "Ukrainian spelling dictionary: **VESUM / brown-uk `dict_uk`** (Rysin A., Starko V., *Large Electronic Dictionary of Ukrainian*), packaged by **wooorm/dictionaries** (rev `8cfea40`). Distributed here under GPL-3.0, as packaged. Used as a build-time word filter only." |
| **Profanity, uk + en** — *not in the snapshot, proposed* | **LDNOOBW V2**, `uk.txt` (205 terms) and `en.txt`, **CC0-1.0** | **Yes**, CC0 is the cleanest option and it is the only one of the three with Ukrainian. | "Profanity blocklists: **LDNOOBWV2/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words_V2**, CC0-1.0." |
| *(alternative profanity)* censor-text/profanity-list | **Unlicense**, includes Ukrainian | Yes | — |
| *(alternative profanity)* original Shutterstock LDNOOBW | **CC BY 4.0** | Yes, **but has no `uk` file** — English only | — |
| **Organizer REVIEW_REQUIRED material** | `NOT_DECLARED` / `NOT_VERIFIED` | **No. Not used, not committed.** | — |

### GPL data as a filter vs shipping lists derived from it

- **As a filter (what we do):** the build asks `hunspell-uk` *"is this FrequencyWords word a real
  Ukrainian word?"* and keeps or drops it. The words in the output all came from FrequencyWords.
  No dict_uk word material is copied. This is the same relationship a spell-checker has with a
  document, and it keeps `data/derived/uk-words.json` under the FrequencyWords terms only.
- **Shipping a list derived from it (what we avoid):** expanding the `.dic` + `.aff` into forms, or
  copying stems out of `index.dic` (e.g. to get apostrophe drill words) produces a file that *is*
  dict_uk material. If we ever need that — see [§8 open question 5](#8-open-questions) — it goes in
  its own directory with its own `LICENSE` (GPL-3.0, plus a note about the upstream NC claim) and
  is never merged into the MIT/CC-BY-SA bundle.

### One-line project LICENSE suggestion

> **`LICENSE` = MIT, covering `src/`, `tests/`, `scripts/` only; a `data/LICENSES.md` records a
> per-file licence for `dictionaries/` and `data/derived/` — CC BY-SA 4.0 for anything carrying
> FrequencyWords counts, Unlicense for dwyl-derived, the SCOWL notice for hunspell-en-derived, and
> no dict_uk word material ships at all.**

That split is exactly what TZ §5.4 asks for ("a GPL dictionary must not be silently mixed with
data under an incompatible licence"), and it keeps the code MIT so the repo reads as a normal
open-source project.

### REVIEW_REQUIRED organizer material — format and size only

`typing-race-2026-{en,uk}` is a JSON + TypeScript snapshot of the current project's language banks
(`course.json` + `eng.ts`/`ukr.ts`, 56 KB en / 100 KB uk, 83 en + 63 uk Academy exercises).
`tt-exercises-{en,uk}` is one `all-exercises.json` per language (2.2 MB / 1 066 exercises en;
3.5 MB / 713 exercises uk). `radio-dictations-uk` is 16 Markdown files, 2010–2025, 70 KB total.
All are `NOT_DECLARED`/`NOT_VERIFIED` in `manifest.yml`; we do not read, derive from, or commit them.

---

## 3. Normalization rules proposal

### 3.1 NFC vs NFKC

**Rule: NFC everywhere. NFKC never in the compare path; NFKC only as a build-time detector.**

Measured (§7.3): 0 of 50 000 `uk_50k` entries, 0 of 50 000 `en_50k` and 0 of 290 325 `uk_full`
are outside NFC — the snapshot is already normalised. NFKC would change 9 / 5 / 318 entries
respectively, and every one of those changes is either destructive or a symptom:

- `ﬁrst → first`, `ﬂoor → floor` (5 English entries): NFKC *fixes* the ligature, but a
  fix that turns **one** character into **two** is fatal in a typing trainer — the expected-character
  stream, the caret index, the per-character error map and the SPM denominator all shift.
- `ѕиµе → ѕиμе`, `µе → μе` (Ukrainian): MICRO SIGN → GREEK SMALL LETTER MU. These entries are
  CP1251 mojibake, not words. NFKC "normalises" garbage into different garbage.

So: `word.normalize('NFC')` on ingest, on every displayed exercise string, and on every
`beforeinput` payload. And at build time, **drop any entry where `NFKC(w) !== w`** — it is a
cheap, high-precision mojibake detector that catches exactly the 9 + 318 broken Ukrainian entries.

Also worth pinning: `uk_full` contains 25 occurrences of U+0301 COMBINING ACUTE ACCENT (stress
marks). `uk_50k` and `hunspell-uk/index.dic` contain none, and the `.aff` declares `IGNORE ́`
(U+0301). Strip U+0301 on ingest for the *lookup* key, and reject the entry from drill pools —
a learner cannot type a stress mark on a standard layout.

### 3.2 The Ukrainian apostrophe

Three codepoints are in live use. What each platform actually types (primary sources in §9):

| Layout | Key | Produces |
|---|---|---|
| Windows **"Ukrainian (Enhanced)"** (`KBDUR1`, KLID `00020422`) | `OEM_3` (left of `1`) | **U+0027** unshifted, U+20B4 ₴ shifted |
| Windows **"Ukrainian"** (`KBDUR`, KLID `00000422`) | `OEM_3` | `ё` / `Ё` — **no apostrophe key at all** |
| Linux **xkeyboard-config `ua`**, default `unicode` variant | `<TLDE>` | `[ apostrophe, U02BC, U0301, asciitilde ]` → **U+0027** at level 1, **U+02BC** at level 2 |
| macOS **"Ukrainian"** / **"Ukrainian – QWERTY"** | backslash key / quote key | **U+02BC** |
| macOS **"Ukrainian – Legacy"** | backtick key | **U+0027** |
| MS Word autocorrect and most published Ukrainian text | — | **U+2019** |

**Authoritative recommendation.** Unicode assigns U+02BC `General_Category=Lm` — a *letter* — while
U+0027 and U+2019 are punctuation; UTR #8 and the Unicode FAQ therefore prefer **U+02BC where the
apostrophe is part of the word** (which is exactly the Ukrainian case) and U+2019 for general
punctuation. The Ukrainian orthography prints **U+2019**. The two most-used Ukrainian layouts emit
**U+0027**. There is no single winner, which is why `dict_uk` settles it *operationally*: its
`index.aff` declares

```
WORDCHARS -ʼ'`
ICONV ʼ '
ICONV ’ '
```

— i.e. U+02BC and U+2019 are folded to **U+0027** before every lookup, and all 5 123 apostrophe-
bearing stems in `index.dic` are stored with U+0027.

**Our rule — three separate concerns, decided separately:**

1. **Stored/canonical form (data files):** **U+0027**. It is what `dict_uk` stores, what Windows
   Enhanced and Linux type, and it is ASCII, so it survives every pipeline, diff and checksum
   unambiguously.
2. **Displayed form (exercise text on screen):** **U+2019**. It is what Ukrainian print uses, it
   has universal font coverage (U+02BC renders as a raised comma and is missing or badly kerned in
   many fonts), and it is what a learner will see in real text. A `strictApostrophe: 'ascii'`
   config flag may switch the display to U+0027 for people who want literal key fidelity.
3. **Comparison key (what the learner typed vs what is displayed):** fold **both sides** through
   the same function before comparing:

   ```
   APOSTROPHE_FOLD = { U+0027, U+2019, U+02BC, U+2018, U+02B9, U+0060, U+00B4, U+2032 } → U+0027
   ```

   So the displayed U+2019 folds to U+0027; a Windows/Linux learner's U+0027 folds to U+0027;
   a macOS learner's U+02BC folds to U+0027; a learner who hit the backtick key folds to U+0027.
   Everyone matches. Nobody's keyboard is "wrong", and we never have to teach a codepoint.

**What is compared against what**, given the app reads `beforeinput`/composition:

- Take `event.data` (a **string**, not a char — IME and dead keys can deliver 0 or >1 characters),
  run `.normalize('NFC')`, then `APOSTROPHE_FOLD`, then split into code points.
- Compare code point by code point against the expected character with **the same** NFC +
  apostrophe fold applied. Nothing else is folded.
- **Never** case-fold in the compare path — `Shift` is a taught skill (TZ §3.2).
- **Never** fold `і ї є ґ` to anything (TZ §4.2, §8.5). `hunspell-uk` declares `MAP гґ`, which tells
  a spell-checker that `г`/`ґ` are near-equivalent for *suggestions*; our build must ignore `MAP`
  entirely, and the compare path must treat them as different characters.
- `inputType: 'insertCompositionText'` with empty or identical `data`, and a dead-key press that
  produces no character, must be **ignored** rather than scored as an error (TZ §4.2: "an accidental
  Alt/Option, IME or dead key must not break the session").
- `inputType: 'deleteContentBackward'` decrements the caret but **never** decrements the error
  count (TZ §8.2 and the project's own error-counting rule).

### 3.3 ґ / Ґ

Measured (§7.C): only **117 of 50 000** `uk_50k` entries (0.23%) contain `ґ`, and inspection shows
almost all of them are mojibake (`пґп 837`, `пґя 254`, `ґзѕеаз 28`) or transliterated names
(`ґрегорі`, `хаґрід`, `ядвіґа`, `морґан`). `hunspell-uk` has 825 stems with `ґ`.

→ **`ґ` drills cannot be frequency-derived.** Build a small curated list
(`ґанок ґрунт ґудзик аґрус ґава ґедзь ґречний ґрати ґанджа ґелґотати …`), mark it as a hand-written
curriculum asset, and gate it behind the `ґ` key unlock. Same conclusion, smaller effect, for `є`
(2.99% of entries) and `ї` (1.57%); `і` is fine at 18.99%.

Three separate non-substitution guards, all testable (TZ §8.5):

1. the normalisation function must be the identity on `і ї є ґ І Ї Є Ґ`;
2. the alphabet whitelist must contain them explicitly (not `[а-я]`, which excludes `ґєії` and
   includes `ы э ъ ё`);
3. the `MAP`/`REP`/`TRY` directives of any Hunspell file must never be read by our build.

### 3.4 Case

Both frequency lists are **100% lowercase** — measured 0 initial-capital entries in `uk_50k` and 0 in
`en_50k`. So:

- store `word` in the source's own (lowercase) form; do not re-case dictionary data;
- produce capitalised drill items with an explicit `transform: "capitalize"` recorded on the
  exercise, so the exercise is reproducible and the `Shift` skill is deliberate rather than an
  artefact of the data;
- lowercase with `String.prototype.toLowerCase()` **and no locale argument** —
  `toLocaleLowerCase('tr')` maps `I → ı` and would corrupt an English build on a Turkish machine;
- the compare path is case-**sensitive**.

### 3.5 Hyphen

Measured: 471 `uk_50k` entries (0.94%) and 2 150 `en_50k` entries (4.30%) contain U+002D.

- Fold U+2010, U+2011, U+2012, U+2013, U+2014, U+2212 to U+002D **as a detector**, then **drop** any
  entry that needed the fold — in a subtitle corpus those are artefacts, not spellings.
- Treat `-` as a taught key in its own right: hyphenated entries are excluded from Stage-2 word
  pools until `-` is unlocked, and form a dedicated Stage-3 drill afterwards.
- Never split a word on the hyphen for comparison purposes. (`hunspell-uk` declares `BREAK -`,
  which we use only inside the build-time membership check.)
- Note that `-` is **absent from the TZ §2.1/§2.2 finger tables** — see
  [§8 open question 4](#8-open-questions).

---

## 4. Filtering proposal

### 4.1 What is actually in an OpenSubtitles-derived list

`uk_50k`, hard-reject reasons (a word can trip several; percentages of 50 000):

| Reason | Count | % | Examples |
|---|---:|---:|---|
| Russian-only letter (`ы э ъ ё`) | 3 206 | 6.41% | `ты это мы вы бы чтобы` |
| Latin letters | 1 931 | 3.86% | `i you the to s a` |
| No Ukrainian letter at all | 1 290 | 2.58% | `i you the to` |
| Other character | 123 | 0.25% | `так.` `ні.` `dr.` `p.j.` `јчй` |
| Digits | 103 | 0.21% | `b1 i0 fs52 ch8981d7` |
| Single character | 52 | 0.10% | `я в у і и з` |
| **Total rejected** | **5 300** | **10.60%** | → 44 700 survive |

Non-Ukrainian, non-Latin characters seen, with counts: `.` 71, `ѕ` U+0455 39, `ј` U+0458 13,
`ў` U+045E 11, `µ` U+00B5 10, and single occurrences of `ú á ѓ њ í é`. The `ѕ ј ў` cluster is
Macedonian/Belarusian look-alikes from broken transcodes — the NFKC detector and the alphabet
whitelist catch them together.

`en_50k`, hard-reject reasons:

| Reason | Count | % | Examples |
|---|---:|---:|---|
| Other character (almost all a trailing `.`) | 948 | 1.90% | `mr. dr. mrs. ms. st.` |
| Digits | 313 | 0.63% | `2nd 1st 20th 80s` |
| Single character | 27 | 0.05% | `i a l s o t` |
| Non-Latin | 3 | 0.01% | `é` `уou` (Cyrillic `у` homoglyph!) |
| **Total rejected** | **974** | **1.95%** | → 49 026 survive |

English also carries 301 apostrophe entries (`'s 't 'm 're 'll 've 'cause 'clock`) — clitic
fragments, not words. They are kept out of Stage-2 pools by a `length ≥ 2 AND starts with a letter`
rule and are perfect Stage-3 apostrophe drill material once the `'` key is unlocked.

### 4.2 The filter that actually matters: real-word membership

**An alphabet filter does not remove Russian.** `что`, `да`, `как`, `меня`, `нет`, `тебя`, `она`,
`если` all pass a strict Ukrainian-alphabet check because they use only shared letters. Measured
consequence: after alphabet filtering alone, `что` is the **5th-heaviest Ukrainian trigram**
(54 552). Hunspell membership is what removes it.

Recommended pipeline order, cheap → expensive, each stage logging before/after counts as TZ §5.2
requires:

| # | Stage | uk_50k survivors | en_50k survivors |
|---:|---|---:|---:|
| 0 | raw | 50 000 | 50 000 |
| 1 | NFC, trim, drop empty | 50 000 | 50 000 |
| 2 | drop if `NFKC(w) !== w` (mojibake detector) | — | — |
| 3 | strict alphabet whitelist + length ≥ 2 | **44 700** (89.4%) | **46 691** (93.4%) |
| 4 | real-word membership | **27 184** (54.4%) | **36 900** (73.8%) |
| 5 | drop hyphenated (Stage-2 pool only) | **27 057** (54.1%) | — |
| 6 | proper-noun flag, profanity blocklist, dedupe | see §4.3–4.5 | |

The Ukrainian survivors by length: 2:115, 3:593, 4:1 789, 5:3 526, 6:4 433, 7:4 811, 8:4 238,
9:3 285, 10:2 212, 11:1 189, 12:540, 13:224, 14:74, 15:13, 16:15. That is a healthy Stage-2 curve —
about 5 900 words of length ≤ 5 to build the early "words from unlocked keys" exercises from.

**Which real-word filter per language:**

- **Ukrainian → `hunspell-uk`.** Nothing else in the snapshot can do it. Build-time only (§2).
- **English → `dwyl/english-words` (`words_alpha.txt`, Unlicense).** A plain `Set` lookup, zero
  attribution burden, and it already rejects the junk we care about: the top rejects are
  `hmm mmm hadn fuckin ryan kinda ohh nah outta goin dna doin ahh mustn nothin erm los marcus
  frankie ali lucas hannah chffffff sophie somethin ve comin gettin oi talkin` — interjections,
  clipped spellings, given names and one literal keyboard-mash. `hunspell-en` is the stricter
  alternative but drags the SCOWL notice into every derived file; use `dwyl` unless we need affix
  awareness.

### 4.3 Proper nouns

**Capitalisation heuristics do not work on this data** — both lists are 100% lowercase, so there is
no capital to key on. What does work: query Hunspell **twice**, once as typed and once title-cased,
and classify:

| Bucket | uk_50k count | Meaning |
|---|---:|---|
| matches a **lowercase** stem | 24 961 | ordinary word — keep |
| matches **only a capitalised** stem | **2 530** | proper-noun cue — flag/drop |
| matches both | 2 241 | ambiguous — keep, allowlist-reviewable |
| no match at all | 20 268 | Russian, mojibake, typos — dropped in stage 4 |

Capitalised-only examples: `чарлі джон гаррі майкл джордж сара майк джеймс пол джейк емі кейт
алекс макс боб чжун`. 17.3% of `hunspell-uk`'s 324 257 stems start with a capital, so the signal is
well-populated. Precision is imperfect — `меня`, `только`, `много`, `нужна` leak in because their
Russian spellings collide with capitalised Ukrainian stems — so treat "capitalised-only" as a
**flag** that (a) excludes the word from Stage-2/3 pools by default and (b) is overridable by a
small hand-kept allowlist, not as a silent delete.

For English, `dwyl` already does the job: `ryan marcus frankie hannah sophie lucas ali` all land in
the *rejected* bucket without any extra rule.

### 4.4 Profanity

- **Use LDNOOBW V2 (`CC0-1.0`)**: `uk.txt` (205 terms) and `en.txt`. CC0 means no attribution
  obligation at all, and it is the only one of the candidates that has Ukrainian.
  Alternative: `censor-text/profanity-list` (Unlicense, Ukrainian included). The original
  Shutterstock LDNOOBW is CC BY 4.0 but **has no `uk` file**.
- **Already vendored, free:** `hunspell-en/index.aff` declares `NOSUGGEST !`, and 27 `index.dic`
  stems carry it — a small, curated English taboo list we already have on disk under the SCOWL
  notice. `hunspell-uk` declares **no** `NOSUGGEST`, so Ukrainian needs the external list.
- **Matching rule:** fold to the comparison key (NFC + apostrophe fold + lowercase), then match
  Ukrainian by **stem prefix** rather than exact equality — a 205-entry uninflected list will not
  otherwise catch inflected forms. Accept the false positives (a handful of innocent words sharing
  a prefix); for a typing trainer, over-filtering costs nothing.
- **Where it applies:** TZ §4.4 requires AI-generated exercises to pass the *same* filters. The
  blocklist therefore belongs in the shared `data/filters` module, not in the build script.

### 4.5 Hunspell as a "real word" filter — how, concretely

Full affix expansion of `dict_uk` would produce millions of forms and would itself be a derived
GPL artefact. Instead do **reverse-affix lookup**, which is what Hunspell does internally:

1. Parse `index.aff`: `ICONV` pairs (64 for uk — the two apostrophe folds plus 62 Latin letters
   mapped to a sentinel so any Latin character makes a word unmatchable), `IGNORE ́`,
   and the `SFX` rules (**88 flags, 5 621 `SFX` lines = 88 rule-group headers + 5 533 rules, 0
   `PFX`** for Ukrainian; 59 `SFX` + 14 `PFX` lines for English). No `FLAG` directive →
   single-character flags.
2. Parse `index.dic`: `word/FLAGS` per line, header line is a count, strip morphological fields,
   honour `\/` escapes. 324 257 distinct stems from 336 673 lines (12 416 lines are duplicate
   surface forms with different flag sets).
3. Index rules by their `add` string. For a candidate word, for each suffix length `0..maxAdd`,
   look up rules whose `add` equals that suffix, reconstruct `stem = word[0..n-len] + strip`, test
   the rule's condition regex against the **end of the stem**, and check the stem carries the flag.
4. Also try the lowercased form, and the `BREAK -` hyphen split.

Measured throughput: **1.1 s for 50 000 words**. Sanity probes all behave:
`навчання=true клавіатура=true клавіатури=true працювати=true ґудзик=true п’ять=true п'ять=true
їжак=true моїй=true` and `зубар=false asdf=false ыъэё=false`.

Residual known gap: `мне`, `его`, `но` survive the filter (Russian forms that collide with
Ukrainian stems). See [§8 open question 6](#8-open-questions).

---

## 5. n-gram and difficulty notes

### 5.1 Weighting (TZ §3.3)

TZ §3.3: *"вага комбінації дорівнює сумі частот слів, у яких вона зустрічається"* — the weight of a
combination is the **sum of the frequencies of the words in which it occurs**. The literal reading
is *once per word*.

Measured both ways on the alphabet-filtered lists:

| | uk_50k | en_50k |
|---|---:|---:|
| distinct bigram types | 995 | 688 |
| total weight, once per word | 14 666 393 | 2 040 596 675 |
| total weight, every occurrence | 14 723 199 | 2 048 080 254 |
| ratio | **1.0039** | **1.0037** |
| top-30 membership | **identical** | **identical** |
| rank changes inside the top 30 | 4 swaps (`те`/`ен`, `ть`/`мо`, `ли`/`ко`, `ак`/`до`) | 2 swaps (`er`/`re`, `st`/`en`) |

**Decision: count each bigram/trigram once per word.** Reasons: (a) it is the literal TZ wording, so
a judge reading §3.3 sees exactly what they expect; (b) the weight then means *"how much of real
reading will contain this combination"* rather than *"how many keystrokes"*; (c) it stops
double-letter bigrams (`нн`, `ll`) from self-inflating. The difference is 0.4%, so nothing is lost.

Because doubles no longer get a free boost, TZ §3.3's *"подвоєння літер"* requirement gets its own
explicit feature: `doubleLetterRuns` on the word, and a dedicated `doubles` Academy module built
from `нн ль лл тт сс` (uk) and `ll ss tt ee oo` (en).

**Cross-word transitions are not derivable** and TZ §3.3 says so explicitly ("для частотності
переходів між словами потрібен окремий ліцензований корпус; її не можна вигадувати зі звичайного
списку слів"). We build intra-word n-grams only and say so on the Sources page.

### 5.2 How much the real-word filter moves the table

Top-30 uk bigrams, alphabet filter only vs `+` Hunspell:

- entered the top 30: `ві що ні об ав`
- left the top 30: `ть ко ка ни ак`

Trigrams move much more: with alphabet filtering alone the uk top-12 contains `что` (54 552) at
rank 5; after the real-word filter the uk top-20 is
`ого так про мен ати зна ити ост ому мож ебе при від вон роб ере пер все сто пра`.
That is a clean Ukrainian morpheme list, and it is what the Academy curriculum should be built from.

Final clean tables (weights in §7.J):

- **uk top-30 bigrams:** `не на ти ро та по то пр го ра ст ва но ві що за ви ні во ог те мо ли об ов до ен ав ал ер`
- **en top-30 bigrams:** `th he ou in er an yo re ha at on it ng to me is hi nd or st ve en ea ll ar no es al se le`
- **uk word-ending candidates (morphemes, TZ §3.3):** 3-char `ого ати ити ься ить сто ння ися ний ому ала али бре ьки іть`; 2-char `ти го ся ть но ли ні на ий ла му те ки не сь`
- **en word-ending candidates:** 3-char `ing ght ere uld ter her out ion lly ink ted ent use ver nce`; 2-char `ng at er re ed ve ll st en me es se ly ke is`

`yo` and `ou` in the English top-5 are a subtitle-corpus artefact (dialogue is dense in *you*) —
worth one sentence on the Sources page, not worth correcting.

### 5.3 Same-finger transitions and row changes (TZ §5.3)

Using the TZ §2.1 (QWERTY) and §2.2 (ЙЦУКЕН) finger tables, with rows numbered
1 = number, 2 = top (`qwertyuiop` / `йцукенгшщзхї`), 3 = home (`asdfghjkl;` / `фівапролджє`),
4 = bottom (`zxcvbnm,./` / `ячсмитьбю.`), over the whole weighted bigram mass:

| | same-finger (different key) | same-hand | row change | not covered by the TZ table |
|---|---:|---:|---:|---:|
| **uk / ЙЦУКЕН** | **18.58%** | 45.02% | 63.01% | 0.32% |
| **en / QWERTY** | **5.80%** | 48.37% | 64.24% | 0.13% |

**ЙЦУКЕН is roughly three times more same-finger-heavy than QWERTY.** The cause is visible in the
finger table: the right index owns `н г р о т ь` and the left index owns `к е а п м и` — six keys
each, and Ukrainian's highest-frequency letters (`о н т р а и е м`) are concentrated there.

Heaviest same-finger bigrams — these *are* the Academy "складні переходи одним пальцем" drill list:

- **uk:** `то ро но го ть ка ог ак он ме ма ор от ам ем`
- **en:** `ed lo de ce un my ol tr ec ki rt ju fr ik ny`

Annotated top-30 (SF = same finger, SH = same hand, ALT = hand alternation, R = row distance) is in
§7.E. Note `не[ALT R0]`, `ро[SF SH R0]`, `те[ALT R2]` — the feature set cleanly separates "easy
alternation" from "hard same-finger row jump", which is exactly what the adaptive drill picker in
TZ §4.4 needs.

**The TZ §5.3 example does not reproduce.** For `навчання` the schema shows
`sameFingerTransitions: 1, rowChanges: 3`. Measured with the TZ's own finger/row tables:

```
fingers  н:RI а:LI в:LM ч:LR а:LI н:RI н:RI я:LP
rows     н:2  а:3  в:3  ч:4  а:3  н:2  н:2  я:4
sameFingerTransitions (adjacent pairs, same-key repeats included) = 1   ✓ matches TZ
rowChanges            (adjacent pairs with a different row)       = 5   ✗ TZ says 3
distinct rows touched                                             = 3   = TZ's number
bigrams  на ав вч ча ан нн ня                                          ✓ matches TZ exactly
```

So `sameFingerTransitions` counts adjacent pairs on the same finger **including same-key repeats**
(`нн`), and `rowChanges` in the TZ example appears to be *distinct rows touched*, not transitions.
Proposal: define `rowChanges` as **adjacent pairs whose rows differ** (5 for `навчання`), because
that is the quantity that predicts difficulty, and record the deviation — TZ §5.3 explicitly allows
a different format "if all this data can be reproduced and verified". See
[§8 open question 3](#8-open-questions).

### 5.4 Characters the TZ finger tables do not cover

0.32% of Ukrainian and 0.13% of English bigram weight involves a character with **no finger
assignment** in TZ §2.1/§2.2, even though TZ §8.4 requires exactly one finger per supported key:

- the **hyphen** `-` (heaviest uk pairs `о- -т -н е- з-`; heaviest en pairs `e- -h t- -i d-`);
- the **apostrophe** (not in the ЙЦУКЕН table at all; present as `'` under right pinky for QWERTY);
- **`ґ`** (absent from the ЙЦУКЕН table; on Windows Enhanced it is not on a base-block letter key).

Proposed assignments, to be ratified in an ADR: `-` (OEM_MINUS, number row) → **right pinky**;
ЙЦУКЕН apostrophe (OEM_3, far left of the number row) → **left pinky**; QWERTY apostrophe (OEM_7)
→ **right pinky** (already in the TZ table); `Ґ` → **left pinky** on the layouts that place it on
OEM_102, with a per-layout override table rather than a single global answer.

---

## 6. Determinism rules

TZ §8.6–8.8 require: correct encoding, checksums matching the manifest, and byte-identical reruns.
Concretely:

### 6.1 Reading

- Decode with a **fatal** UTF-8 decoder (`new TextDecoder('utf-8', { fatal: true })`), never
  `Buffer.toString()`, so a bad byte fails the build instead of producing U+FFFD. Measured: all
  nine files in the snapshot decode cleanly, none has a BOM.
- Split lines on `/\r?\n/`. **`words_alpha.txt` is the only CRLF file in the snapshot** (370 105
  CRLF terminators); every other file is LF. A naive `split('\n')` leaves a trailing `\r` on all
  370 105 English words, which then silently fails every membership lookup.
- `hunspell-uk/index.dic` has **no trailing newline**; do not assume one.
- Never `readFileSync(..., 'utf8')` on the `.dic`/`.aff` and then re-serialise — we read them, we
  never write them.

### 6.2 Verifying the raw material (TZ §8.7)

- Before any build step, verify every input against `dictionaries/CHECKSUMS.sha256` (1 891 entries,
  covering every file in the snapshot including READMEs). Measured: all nine files we use match.
- Mirror the organizer's `scripts/verify-data.sh` as `npm run verify:data`, and make
  `npm run build:data` depend on it. On Windows use Node's `crypto` rather than `sha256sum`, which
  is not guaranteed present.
- Record the *input* SHA-256s inside each derived file's sidecar, so a derived file can be traced
  to exact bytes without re-reading the snapshot (TZ §5.2).

### 6.3 Sorting and comparison

- **Never `localeCompare` or `Intl.Collator` in the build.** Measured on the same array,
  `localeCompare('uk')` orders `... єдність ізольований їжак ...` while `localeCompare('en')` orders
  `... єдність їжак ізольований ...`, and the ICU data behind both varies by Node build, OS and
  `--with-intl` flags. Use the default code-unit `Array#sort()` or an explicit code-point
  comparator.
- Ukrainian alphabetical order is a **presentation** concern. If a screen needs it, compute it at
  render time from an explicit collation table checked into the repo, not from ICU.
- Sort with an explicit total order and a tie-break:
  `by (-frequency, then word code points)`. V8's sort is stable, but "stable" only preserves *input*
  order, and input order changes when the upstream snapshot changes.
- Note `'ґ' > 'я'` is `true` by code unit (U+0490 > U+044F) — expected and fine for a build key,
  wrong for a UI list.

### 6.4 Arithmetic

- **Integers only** for n-gram weights. Measured: reordering the entire 50 000-row input leaves the
  sorted output byte-identical with integer counts. With floats it would not:
  `0.1 + 0.2 + 0.3 !== 0.3 + 0.2 + 0.1`.
- If a normalised weight (0..1) is needed, compute it *after* the integer sum, with a single
  documented rounding rule (e.g. `Math.round(w * 1e6) / 1e6`), and store the integer alongside it.

### 6.5 Writing

- `JSON.stringify` preserves **insertion order**, not sorted order. Serialise through an explicit
  key-sorting replacer, fixed 2-space indent, LF line endings, one trailing newline. Add
  `*.json text eol=lf` to `.gitattributes` so Windows checkouts do not rewrite them.
- Ban `Date.now()`, `Math.random()`, `process.env`, `os.*` and unsorted `Set`/`Map` iteration from
  the build output. If a build timestamp is wanted, put it in a *separate* non-checksummed file.
- Each derived file gets a sidecar recording, per TZ §5.2: source dataset ids + their SHA-256, the
  algorithm version, the Unicode normalisation form, the case/apostrophe/hyphen rules, the allowed
  character set, the de-duplication rule, the proper-noun and profanity filters applied, and the
  record count **before and after each stage**, plus the output's own SHA-256.
- The TZ §8.8 test is literally: run `npm run build:data` twice into two directories, hash both
  trees, assert equality. Add it to CI.

---

## 7. Local measurements

Environment: Node v24.19.0, Windows 11, read-only scripts run from `$TEMP` against
`tasks/Typing-Race-2026-Hackathon/dictionaries/`. Nothing in the snapshot was modified.

### 7.1 Encoding and integrity

```
uk50k   bytes=    887259 utf8=valid bom=false lf=50000   crlf=0      endsWithNewline=true  wholeFile=already-NFC sha256=MATCHES manifest checksum
ukFull  bytes=   5560013 utf8=valid bom=false lf=290325  crlf=0      endsWithNewline=true  wholeFile=already-NFC sha256=MATCHES manifest checksum
en50k   bytes=    622749 utf8=valid bom=false lf=50000   crlf=0      endsWithNewline=true  wholeFile=already-NFC sha256=MATCHES manifest checksum
enFull  bytes=  19977552 utf8=valid bom=false lf=1656996 crlf=0      endsWithNewline=true  wholeFile=NOT-NFC     sha256=MATCHES manifest checksum
dwyl    bytes=   4234910 utf8=valid bom=false lf=370105  crlf=370105 endsWithNewline=true  wholeFile=already-NFC sha256=MATCHES manifest checksum
ukDic   bytes=   8493094 utf8=valid bom=false lf=336673  crlf=0      endsWithNewline=false wholeFile=already-NFC sha256=MATCHES manifest checksum
ukAff   bytes=    203292 utf8=valid bom=false lf=5695    crlf=0      endsWithNewline=true  wholeFile=already-NFC sha256=MATCHES manifest checksum
enDic   bytes=    551762 utf8=valid bom=false lf=49569   crlf=0      endsWithNewline=true  wholeFile=already-NFC sha256=MATCHES manifest checksum
enAff   bytes=      3086 utf8=valid bom=false lf=205     crlf=0      endsWithNewline=true  wholeFile=already-NFC sha256=MATCHES manifest checksum
```

`enFull` is the one file whose whole-text NFC check trips, driven by a handful of decomposed
entries deep in the long tail; per-entry NFC is clean for the lists we actually use.

### 7.2 Record counts vs `manifest.yml` — all exact

```
uk_50k             parsed=    50000 manifest=    50000 OK malformed=0
uk_full            parsed=   290325 manifest=   290325 OK malformed=0
en_50k             parsed=    50000 manifest=    50000 OK malformed=0
en_full            parsed=  1656996 manifest=  1656996 OK malformed=0
words_alpha        parsed=   370105 manifest=   370105 OK
hunspell-uk .dic   parsed=   336673 manifest=   336673 OK header=336673
hunspell-en .dic   parsed=    49568 manifest=    49568 OK header=49568
case-insensitive duplicate surface forms: uk_50k=0 en_50k=0
```

### 7.3 Unicode normalisation forms

```
uk_50k  entries-not-already-NFC=0 entries-where-NFKC!=NFC=9
   NFKC example: "ѕиµе -> ѕиμе"   "µе -> μе"   "ечµр -> ечμр"   "ієµµ -> ієμμ"
en_50k  entries-not-already-NFC=0 entries-where-NFKC!=NFC=5
   NFKC example: "ﬂoor -> floor"  "ﬁrst -> first"  "ﬁnd -> find"  "ﬂy -> fly"
                 "ûóãóúéìòµóãí -> ûóãóúéìòμóãí"
uk_full entries-not-already-NFC=0 entries-where-NFKC!=NFC=318
combining acute U+0301 occurrences: uk_50k=0 uk_full=25 hunspell-uk.dic=0
```

### 7.4 Apostrophe variants — occurrences per file

```
file     U+0027  U+2019  U+02BC  U+0060  U+00B4  U+2018  U+02B9  U+2032
uk50k         0       0       0       0       0       0       0       0
ukFull        0       0       0     103       0       0       0       0
en50k       304       0       0      38       0       0       0       0
ukDic     10234       0       0    4333       0       0       0       0     (` is a flag char, not an apostrophe)
ukAff       429       1       2      34       0       0       0       0
enDic       412       0       0       0       0       0       0       0
enAff         3       1       0       0       0       0       0       0
```

**Ukrainian entries containing an apostrophe of any kind: `uk_50k` = 0, `uk_full` = 0.**
Words that should have one appear with it deleted:

```
пять 388        (п'ять)
девять 80       (дев'ять)
мясо 66         (м'ясо)
імя 7           (ім'я)
```

`uk_full` does keep 103 backtick-as-apostrophe spellings (`п`ять 5`, `опам`ятайся 5`, `сім`ї 3`) —
a different artefact, and evidence that the 50k list was built with a stricter tokeniser.

`hunspell-uk/index.dic` has **5 123 stems with U+0027** (`аб'юдикація`, `авіаз'єднання`,
`автоінтерв'ю`, `Авер'ян`) — the only usable apostrophe source in the snapshot.

English apostrophe entries in `en_50k` (top by frequency):
`'s(14 291 013) 't(9 628 970) 'm(4 386 306) 're(4 059 719) 'll(2 913 428) 've(1 991 871)
'd(1 109 205) 'cause(112 193) 'clock(22 311) 'mon(17 576)`.

### 7.5 Strict alphabet filter

See the tables in [§4.1](#41-what-is-actually-in-an-opensubtitles-derived-list). Raw output:

```
uk_50k total=50000 rejected-by-hard-rules=5300 (10.60%) surviving=44700
  REJECT russian-only-letter     3206  6.41%  e.g. ты это мы вы бы чтобы
  REJECT latin                   1931  3.86%  e.g. i you the to s a
  REJECT no-ukrainian-letter     1290  2.58%  e.g. i you the to s a
  flag   two-char                 517  1.03%  e.g. не що на це ти ты
  flag   hyphen                   471  0.94%  e.g. что-то из-за кто-то кое-что
  REJECT other-char               123  0.25%  e.g. јчй так. ні. dr. p.j. добре.
  REJECT digit                    103  0.21%  e.g. b1 i0 fs52 a2 ch8981d7 f4
  REJECT single-char               52  0.10%  e.g. я в у і и з
  non-Ukrainian, non-Latin, non-digit characters: "."=71 "ѕ"/U+0455=39 "ј"/U+0458=13
    "ў"/U+045E=11 "µ"/U+00B5=10 "ú"=1 "á"=1 "ѓ"=1 "њ"=1 "í"=1 "é"=1

en_50k total=50000 rejected-by-hard-rules=974 (1.95%) surviving=49026
  flag   hyphen                  2150  4.30%  e.g. mm-hmm i-i uh-huh good-bye no-one
  REJECT other-char               948  1.90%  e.g. mr. dr. mrs. ms. i. st.
  flag   two-char                 544  1.09%  e.g. to 's it 't of is
  REJECT digit                    313  0.63%  e.g. 2nd 1st 3rd 20th 4th 80s
  flag   apostrophe               301  0.60%  e.g. 's 't 'm 're 'll 've
  REJECT single-char               27  0.05%  e.g. i a l s o t
  REJECT no-latin-letter            2  0.00%  e.g. é ûóãóúéìòµóãí
  REJECT cyrillic                   1  0.00%  e.g. уou   <- Cyrillic 'у' homoglyph
```

### 7.6 Top 30 bigrams by the TZ §3.3 weighting

`uk_50k`, alphabet-filtered, distinct-per-word; the right column is the rank when repeats are
counted:

```
  1 на 269137 (1)    11 пр 144877 (11)   21 ер 120219 (21)
  2 не 268862 (2)    12 го 143849 (12)   22 ва 119904 (22)
  3 то 214979 (3)    13 те 138243 (14)   23 за 119798 (23)
  4 ти 193936 (4)    14 ен 138124 (13)   24 ни 119084 (24)
  5 по 193822 (5)    15 ть 132115 (16)   25 ог 118568 (25)
  6 ро 172775 (6)    16 мо 130773 (15)   26 ов 115732 (26)
  7 ст 160128 (7)    17 во 128625 (17)   27 ал 113213 (27)
  8 та 158913 (8)    18 ли 123961 (19)   28 ви 112366 (28)
  9 но 149308 (9)    19 ко 122584 (18)   29 ак 107963 (30)
 10 ра 147902 (10)   20 ка 120291 (20)   30 до 106847 (29)
distinct bigram types 995; total weight distinct=14666393 repeats=14723199 (ratio 1.0039)
```

`en_50k`:

```
  1 th 70202469 (1)   11 on 29696777 (11)  21 or 20151478 (21)
  2 he 60543917 (2)   12 it 26067233 (12)  22 st 20040837 (23)
  3 ou 53374991 (3)   13 ng 25596600 (13)  23 en 19836284 (22)
  4 in 44934972 (4)   14 to 25237932 (14)  24 ar 19254298 (24)
  5 er 38057055 (6)   15 me 22630509 (15)  25 ea 19022362 (25)
  6 re 37918516 (5)   16 ll 22072335 (16)  26 no 18682143 (26)
  7 an 37579515 (7)   17 is 21852787 (17)  27 es 16866584 (27)
  8 yo 34946011 (8)   18 ve 21675362 (18)  28 al 16846825 (28)
  9 ha 33053893 (9)   19 hi 21299980 (19)  29 se 16163369 (29)
 10 at 30279918 (10)  20 nd 20216268 (20)  30 le 16110371 (30)
distinct bigram types 688; total weight distinct=2040596675 repeats=2048080254 (ratio 1.0037)
```

**After the real-word filter** (the numbers the curriculum should actually use):

```
uk: не=224967 на=214019 ти=176897 ро=132484 та=126964 по=126866 то=115280 пр=113324
    го=109433 ра=105584 ст=100374 ва=97889 но=96395 ві=95826 що=95259 за=93924
    ви=91394 ні=91354 во=88045 ог=87891 те=87823 мо=86688 ли=85475 об=85443
    ов=83577 до=82675 ен=81331 ав=79213 ал=78986 ер=77862
en: th=69925211 he=60250609 ou=53161310 in=44086660 er=37521097 an=36845801 yo=34836230
    re=33536228 ha=32603802 at=30046645 on=29124471 it=25862637 ng=25337043 to=24986010
    me=22432284 is=21646510 hi=20995049 nd=19951095 or=19869950 st=19756036 ve=19542948
    en=19447199 ea=18875523 ll=18808578 ar=18729909 no=18486230 es=16671506 al=16488129
    se=15856916 le=15742127
```

### 7.7 Hunspell membership

```
hunspell-uk: dic stems=324257  SFX flags=88  PFX flags=0  ICONV pairs=64  IGNORE="́"
engine probes: навчання=true клавіатура=true клавіатури=true працювати=true ґудзик=true
               п’ять=true п'ять=true їжак=true моїй=true  |  зубар=false asdf=false ыъэё=false
uk_50k accepted (base + reverse-SFX + hyphen split): 27274/50000 = 54.55%   (elapsed 1.1 s)
of the 44700 alphabet-clean entries, hunspell accepts 27256 = 60.98%
alphabet-clean but NOT accepted, most frequent first:
  что(49617) да(15449) как(15440) меня(14222) нет(14185) тебя(10749) она(10584) если(8227)
  они(6748) хорошо(6199) есть(6042) здесь(5747) когда(5501) из(5433) только(5174) может(4930)
  почему(4425) вот(4294) могу(4270) нужно(4137) кто(4023) будет(3999) сейчас(3686) их(3670)
  еще(3632) спасибо(3626) или(3557) где(3515) очень(3421) чем(3357) …
```

Every one of the top rejects is Russian. That is the filter earning its keep.

The three Hunspell-accept counts quoted in this file — 27 274, 27 256 and 27 184 — differ by ~90
words because each script pairs the membership test with a slightly different alphabet pre-filter
(apostrophe-bearing entries allowed or not, minimum length 1 or 2). Use 27 184 / 54.4% as the
pipeline figure; the spread is the measurement noise of the pre-filter, not of the membership test.

### 7.8 Pipeline yield

```
uk_50k
  stage 0 raw entries                     : 50000
  stage 1 strict Ukrainian alphabet, len>1: 44700  (89.4%)
  stage 2 + lowercase hunspell-uk match   : 27184  (54.4%)
  stage 3 + drop hyphenated               : 27057  (54.1%)
  surviving words by length: 2:115 3:593 4:1789 5:3526 6:4433 7:4811 8:4238 9:3285
                             10:2212 11:1189 12:540 13:224 14:74 15:13 16:15

en_50k
  stage 0 raw entries                                  : 50000
  stage 1 /^[a-z]{2,}$/                                : 46691  (93.4%)
  stage 2 + present in dwyl words_alpha (Unlicense)    : 36900  (73.8%)
  alphabetic but NOT in dwyl (first 30): hmm mmm hadn fuckin ryan kinda ohh nah outta goin
    dna doin ahh mustn nothin erm los marcus frankie ali lucas hannah chffffff sophie
    somethin ve comin gettin oi talkin
```

### 7.9 Proper-noun signal, taboo flags, protected letters

```
uk_50k is 100% lowercase, so an "initial capital" heuristic finds 0 proper nouns.
matching against hunspell-uk with and without an initial capital:
  lowercase stem only (common word)       = 24961
  capitalised stem only (proper-noun cue) =  2530
  both                                    =  2241
  no hunspell match at all                = 20268
  capitalised-only examples: чарлі джон гаррі майкл боб чжун алекс макс джордж сара майк
                             джеймс пол джейк емі кейт  (plus leaks: меня только много нужна)
hunspell-uk stems starting with a capital letter: 56096 / 324257 (17.3%)

hunspell-en: NOSUGGEST flag "!" -> 27 entries carry it (a ready-made English taboo list)
hunspell-uk index.aff declares NOSUGGEST? false -> external uk profanity list required

  ґ U+0491: uk_50k entries=117  (0.23%)   hunspell-uk stems=825
  є U+0454: uk_50k entries=1493 (2.99%)   hunspell-uk stems=7531
  ї U+0457: uk_50k entries=786  (1.57%)   hunspell-uk stems=4938
  і U+0456: uk_50k entries=9497 (18.99%)  hunspell-uk stems=139191
  every uk_50k entry containing ґ: пґп(837) дуґале(265) пґя(254) пґ(198) ґарні(44) лоґане(37)
    пїпґп(34) піпґп(32) ґрегорі(32) хаґрід(30) пґпґп(29) ґзѕеаз(28) дауґале(27) ядвіґа(26)
    морґан(25) ґреам(24) пєпґп(24) ґ(24) ґратами(23) маґдо(22) …
```

### 7.10 Finger and row features

```
uk (ЙЦУКЕН)  total bigram weight=14666393  same-finger=18.58%  same-hand=45.02%
             row-change=63.01%  unmapped-by-TZ-table=0.32%
  на[ALT R1]  не[ALT R0]  то[SF SH R1]  ти[ALT R0]  по[ALT R0]  ро[SF SH R0]
  ст[ALT R0]  та[ALT R1]  но[SF SH R1]  ра[ALT R0]  пр[ALT R0]  го[SF SH R1]
  те[ALT R2]  ен[ALT R0]  ть[SF SH R0]  мо[ALT R1]  во[ALT R0]  ли[ALT R1]
  ко[ALT R1]  ка[SF SH R1]  ер[ALT R1]  ва[SH R0]   за[ALT R1]  ни[ALT R2]
  ог[SF SH R1] ов[ALT R0]  ал[ALT R0]  ви[SH R1]   ак[SF SH R1] до[SH R0]
  heaviest same-finger: то=214979 ро=172775 но=149308 го=143849 ть=132115 ка=120291
                        ог=118568 ак=107963 он=105647 ме=96046 ма=95109 ор=94018
                        от=86615 ам=70564 ем=62913
  heaviest unmapped: "о-"=8031 "-т"=7942 "-н"=4433 "е-"=2762 "з-"=1586 "пґ"=1483

en (QWERTY)  total bigram weight=2040596675  same-finger=5.80%  same-hand=48.37%
             row-change=64.24%  unmapped-by-TZ-table=0.13%
  th[ALT R1]  he[ALT R1]  ou[SH R0]   in[SH R2]   er[SH R0]   re[SH R0]
  an[ALT R1]  yo[SH R0]   ha[ALT R0]  at[SH R1]   on[SH R2]   it[ALT R0]
  ng[ALT R1]  to[ALT R0]  me[ALT R2]  ll[SH R0]   is[ALT R1]  ve[SH R2]
  hi[SH R1]   nd[ALT R1]  or[ALT R0]  st[SH R1]   en[ALT R2]  ar[SH R1]
  ea[SH R1]   no[SH R2]   es[SH R1]   al[ALT R0]  se[SH R1]   le[ALT R1]
  heaviest same-finger: ed=14621365 lo=9407234 de=9050762 ce=7428200 un=6699307 my=5628748
                        ol=5505966 tr=5263443 ec=5210518 ki=5117915 rt=4825691 ju=3961307
```

### 7.11 Determinism checks

```
two runs over the same input produce identical sorted output: true
input reordered -> same sorted output: true   (integer counts; floats would NOT be)
float order sensitivity: 0.1+0.2+0.3 === 0.3+0.2+0.1 -> false

default Array#sort (UTF-16 code units): Аа аа газета ель п'ять п’ять яблуко єдність ізольований їжак ґанок
localeCompare('uk')                   : аа Аа газета ґанок ель єдність ізольований їжак п'ять п’ять яблуко
localeCompare('en')                   : аа Аа газета ґанок ель єдність їжак ізольований п'ять п’ять яблуко
'ґ'(U+0490) > 'я'(U+044F) by code unit = true
```

Note the `uk` / `en` disagreement on `ізольований` vs `їжак` — the same data, two orders, from the
same Node process. That is why the build must not use ICU collation.

---

## 8. Open questions

1. **FrequencyWords: MIT or CC BY-SA 4.0 for the *content*?** The vendored `LICENSE` file is MIT;
   the upstream README says "MIT License for code. CC-by-sa-4.0 for content." *Proposal:* cite both
   on the Sources page and comply with the stricter one (CC BY-SA 4.0) for anything carrying the
   frequency numbers. Needs a yes/no from whoever signs off the repo.
2. **dict_uk: which licence is authoritative?** GPL-3.0 (wooorm's `dictionaries/uk/license`, the one
   we vendor) vs CC BY-NC-SA 4.0 (dict_uk README, data) vs MPL 1.1 (dict_uk
   `distr/hunspell/README.md`). The NC variant would bar commercial use. Irrelevant while we use it
   as a build-time filter only; must be resolved before any non-internal release.
3. **`rowChanges` definition.** TZ §5.3's `навчання` example gives 3; adjacent-pair counting gives 5
   (3 is the count of *distinct rows touched*). Which does the judge expect? *Proposal:* use
   adjacent-pair counting, document the deviation, and expose both fields.
4. **`ґ`, `-` and `'` have no finger assignment** in TZ §2.1/§2.2, but TZ §8.4 demands exactly one
   per supported key. Needs an ADR, and `Ґ`'s physical key differs across Windows Enhanced
   (`OEM_102`/AltGr), Linux `ua` and the macOS variants, so the answer is a per-layout table.
5. **Where do apostrophe drill words come from?** The frequency lists have none (0 in 340 325
   entries). Options: (a) extract the 5 123 apostrophe stems from `hunspell-uk` and ship that one
   file under GPL-3.0 in its own directory; (b) hand-write ~80 words for the curriculum and ship
   them under our own licence. *Leaning (b)* — it is smaller, it avoids the licence question
   entirely, and 80 curated words is more pedagogically useful than 5 123 raw stems.
6. **Residual Russian after the Hunspell filter.** `мне`, `его`, `но` survive because their spellings
   collide with Ukrainian stems. Options: a hand-kept stoplist (~50 entries covers the visible
   cases), or pull FrequencyWords `ru_50k` and subtract words far more frequent in Russian than
   Ukrainian. `ru_50k` is **not** in the snapshot, so adding it means adding a dataset to the
   manifest.
7. **Which apostrophe do we display?** §3.2 recommends U+2019 for display / U+0027 for storage. A
   reasonable counter-argument is "display exactly what the key produces" (U+0027). Cheap to make a
   setting; needs a default.
8. **LDNOOBW V2 `uk.txt` is 205 uninflected terms.** Prefix matching will over- and under-catch.
   Acceptable for a trainer, but worth one review pass by a Ukrainian speaker before launch.

---

## 9. Sources

**Snapshot files read directly** (all under
`tasks/Typing-Race-2026-Hackathon/`, SHA-256-verified against `dictionaries/CHECKSUMS.sha256`):

- `docs/TECHNICAL_SPECIFICATION.md` §2.1, §2.2, §3.3, §4.2, §4.3, §5.1–5.4, §8
- `docs/DATA_POLICY.md`, `docs/SOURCES.md`, `docs/DATA_INVENTORY.md`
- `dictionaries/manifest.yml` (schema_version 2, snapshot_date 2026-08-30),
  `dictionaries/CHECKSUMS.sha256` (1 891 entries), `scripts/verify-data.sh`
- `dictionaries/english/wordlists/frequencywords-2018/{LICENSE,en_50k.txt,en_full.txt}`
- `dictionaries/ukrainian/wordlists/frequencywords-2018/{LICENSE,uk_50k.txt,uk_full.txt}`
- `dictionaries/english/wordlists/dwyl-english-words/{LICENSE,words_alpha.txt}`
- `dictionaries/english/wordlists/hunspell-en/{LICENSE,PACKAGE-LICENSE-MIT,README.original.md,index.aff,index.dic}`
- `dictionaries/ukrainian/wordlists/hunspell-uk/{LICENSE,PACKAGE-LICENSE-MIT,README.original.md,index.aff,index.dic}`

**Upstream primary sources**

- FrequencyWords — <https://github.com/hermitdave/FrequencyWords> (README: *"MIT License for code.
  CC-by-sa-4.0 for content."*; corpus: OpenSubtitles2018 via OPUS,
  <http://opus.nlpl.eu/OpenSubtitles2018.php>)
- dwyl/english-words — <https://github.com/dwyl/english-words> (Unlicense)
- SCOWL — <http://wordlist.aspell.net/>; licence text reproduced verbatim in the vendored
  `hunspell-en/LICENSE` (© 2000-2018 Kevin Atkinson; grant covers "these word lists, the associated
  scripts, the output created from the scripts, and its documentation")
- wooorm/dictionaries — <https://github.com/wooorm/dictionaries>;
  `dictionaries/uk/license` = GPL-3.0, `dictionaries/en/license` = "(MIT AND BSD)"
- brown-uk/dict_uk (VESUM) — <https://github.com/brown-uk/dict_uk> (README: dictionary data
  CC BY-NC-SA 4.0, software GPL 3.0, "derivative projects have different licenses");
  `distr/hunspell/README.md`: *"Поширюється за умов ліцензії MPL (Mozilla Public License) 1.1"*.
  Citation form: Rysin A., Starko V., *Large Electronic Dictionary of Ukrainian (VESUM)*,
  <https://vesum.nlp.net.ua/>

**Keyboard layouts**

- Windows "Ukrainian (Enhanced)" (`KBDUR1`, KLID `00020422`) — <https://kbdlayout.info/KBDUR1/> and
  its KLC download; `OEM_3` → `0027` / `20b4`. Microsoft Learn mirror:
  <https://learn.microsoft.com/en-us/globalization/keyboards/kbdur1>
- Windows "Ukrainian" (`KBDUR`, KLID `00000422`) — <https://kbdlayout.info/kbdur/>; `OEM_3` →
  `0451`/`0401` (`ё`/`Ё`), i.e. **no apostrophe key**
- Linux `xkeyboard-config` `symbols/ua`, default `unicode` variant —
  `key <TLDE> {[ apostrophe, U02BC, U0301, asciitilde ]}`, read via
  <https://sources.debian.org/src/xkeyboard-config/latest/symbols/ua/>
- macOS Ukrainian layouts — "Ukrainian" and "Ukrainian – QWERTY" produce U+02BC, "Ukrainian –
  Legacy" produces U+0027:
  <https://orsolabs.dev/mochi-type/guides/mac-ukrainian-keyboard-apostrophe-and-shcha/>
  *(secondary source; the U+02BC claim is consistent with the xkb `ua` level-2 assignment but was
  not verified against an Apple `.keylayout` file)*
- Michael Kaplan, *"What's wrong with the Ukrainian keyboard layout, anyway?"* (2007) — background
  on the missing apostrophe and `Ґ` in the pre-Vista layout:
  <http://archives.miloush.net/michkap/archive/2007/02/13/1670097.html>

**Unicode**

- U+02BC MODIFIER LETTER APOSTROPHE has `General_Category=Lm` (a letter); U+0027 and U+2019 are
  punctuation. UTR #8 preferred U+02BC for modifier/letter use and U+2019 for general punctuation;
  since Unicode 3.0 U+2019 is the preferred *punctuation* apostrophe.
  <https://www.compart.com/en/unicode/U+02BC>, <https://en.wikipedia.org/wiki/Modifier_letter_apostrophe>
- Operationally authoritative for us: `hunspell-uk/index.aff` — `WORDCHARS -ʼ'\``, `ICONV ʼ '`,
  `ICONV ’ '`, `IGNORE ́`, `MAP гґ` (read from the snapshot)

**Profanity lists**

- LDNOOBW V2 — <https://github.com/LDNOOBWV2/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words_V2>
  (CC0-1.0; `uk.txt` = 205 terms, UTF-8, lowercase, one per line)
- censor-text/profanity-list — <https://github.com/censor-text/profanity-list> (Unlicense, Ukrainian
  included)
- Original Shutterstock LDNOOBW —
  <https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words> (CC BY 4.0,
  **no Ukrainian file**)

---

## 10. Appendix: scripts

Four read-only Node scripts, run from
`%TEMP%\claude\…\scratchpad\` against the snapshot path. They open no network connection, write
nothing, and never touch `dictionaries/`.

```
node measure.mjs  <dictionariesRoot>   # encoding, counts, NFC/NFKC, apostrophes, alphabet filter,
                                       # bigrams both weightings, hunspell membership, sort demo
node measure2.mjs <dictionariesRoot>   # proper-noun signal, NOSUGGEST, protected letters,
                                       # finger/row features, determinism replay
node measure3.mjs <dictionariesRoot>   # end-to-end pipeline yield, filtered n-grams, endings
node check53.mjs                       # reproduces the TZ 5.3 «навчання» example
```

### 10.1 `check53.mjs`

```js
const F = { LP: 'йфя', LR: 'ціч', LM: 'увс', LI: 'кеапми', RI: 'нгроть', RM: 'шлб', RR: 'щдю', RP: 'зхїжє.' };
const R = { 2: 'йцукенгшщзхї', 3: 'фівапролджє', 4: 'ячсмитьбю.' };
const fm = new Map(), rm = new Map();
for (const [k, v] of Object.entries(F)) for (const c of v) fm.set(c, k);
for (const [k, v] of Object.entries(R)) for (const c of v) rm.set(c, +k);
const w = 'навчання';
const cs = [...w];
let sf = 0, sfNoRepeat = 0, rc = 0;
const rowsUsed = new Set();
for (const c of cs) rowsUsed.add(rm.get(c));
for (let i = 0; i + 1 < cs.length; i++) {
  const a = cs[i], b = cs[i + 1];
  if (fm.get(a) === fm.get(b)) { sf++; if (a !== b) sfNoRepeat++; }
  if (rm.get(a) !== rm.get(b)) rc++;
}
console.log('fingers', cs.map((c) => c + ':' + fm.get(c)).join(' '));
console.log('rows   ', cs.map((c) => c + ':' + rm.get(c)).join(' '));
console.log('sameFingerTransitions incl. same-key repeats =', sf, '| excl. repeats =', sfNoRepeat, '| TZ says 1');
console.log('rowChanges (adjacent pairs, different row) =', rc, '| TZ says 3');
console.log('distinct rows touched =', rowsUsed.size, '| TZ says 3');
console.log('bigrams', cs.slice(0, -1).map((c, i) => c + cs[i + 1]).join(' '), '| TZ lists: на ав вч ча ан нн ня');
```

### 10.2 The reverse-affix Hunspell lookup (core of `measure.mjs`)

This is the piece worth lifting into the real build. It is ~60 lines, needs no dependency, and
answers "is this a real Ukrainian word?" for 50 000 words in 1.1 s — without expanding (and
therefore without copying) the GPL dictionary.

```js
function parseAff(text) {
  const iconv = []; let ignore = ''; const sfx = new Map();
  for (const l of text.split('\n').map((s) => s.replace(/\r$/, ''))) {
    if (l.startsWith('ICONV ')) { const p = l.split(/\s+/); if (p.length === 3) iconv.push([p[1], p[2]]); }
    else if (l.startsWith('IGNORE ')) ignore = l.slice(7).trim();
    else if (l.startsWith('SFX ')) {
      const p = l.split(/\s+/);
      if (p[2] === 'Y' || p[2] === 'N') continue;               // rule-group header
      const flag = p[1];
      const strip = p[2] === '0' ? '' : p[2];
      const add = p[3].split('/')[0] === '0' ? '' : p[3].split('/')[0];
      const cond = p[4] ?? '.';
      if (!sfx.has(flag)) sfx.set(flag, []);
      sfx.get(flag).push({ strip, add, cond });
    }
  }
  return { iconv, ignore, sfx };
}

// Hunspell conditions are a mini-regex: literals, '.', and [...] classes. Anchor at the end.
function condToRegex(cond) {
  let re = '';
  for (let i = 0; i < cond.length; i++) {
    const c = cond[i];
    if (c === '[') { const j = cond.indexOf(']', i); re += cond.slice(i, j + 1); i = j; }
    else if (c === '.') re += '[\\s\\S]';
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(re + '$');
}

function parseDic(text) {
  const map = new Map();                       // stem -> Set(flag chars)
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {     // line 0 is the declared count
    let l = lines[i].replace(/\r$/, '');
    if (!l) continue;
    const tab = l.indexOf('\t'); if (tab >= 0) l = l.slice(0, tab);   // morphological fields
    l = l.trim(); if (!l) continue;
    let slash = -1;
    for (let k = 0; k < l.length; k++) if (l[k] === '/' && l[k - 1] !== '\\') { slash = k; break; }
    const word = (slash >= 0 ? l.slice(0, slash) : l).replace(/\\\//g, '/');
    const flags = slash >= 0 ? l.slice(slash + 1) : '';
    if (!map.has(word)) map.set(word, new Set());
    for (const f of flags) map.get(word).add(f);
  }
  return map;
}

// index SFX rules by the string they ADD, so a candidate word needs only |word| probes
const byAdd = new Map();
for (const [flag, rules] of aff.sfx) for (const r of rules) {
  if (!byAdd.has(r.add)) byAdd.set(r.add, []);
  byAdd.get(r.add).push({ flag, strip: r.strip, re: condToRegex(r.cond) });
}
const maxAdd = Math.max(...[...byAdd.keys()].map((k) => k.length));

function iconv(w) {                            // ' ' sentinel = "can never match"
  let s = w;
  for (const [from, to] of aff.iconv) s = s.split(from).join(to === '0' ? ' ' : to);
  if (aff.ignore) for (const ch of aff.ignore) s = s.split(ch).join('');
  return s;
}

function lookupSfx(w) {                        // reverse-apply every candidate suffix rule
  const n = w.length;
  for (let len = 0; len <= Math.min(maxAdd, n); len++) {
    const rules = byAdd.get(len === 0 ? '' : w.slice(n - len));
    if (!rules) continue;
    const base = w.slice(0, n - len);
    for (const r of rules) {
      const stem = base + r.strip;
      if (!stem || !r.re.test(stem)) continue;
      const flags = dic.get(stem);
      if (flags && flags.has(r.flag)) return true;
    }
  }
  return false;
}

export function hunspellHas(word) {
  const w = iconv(word.normalize('NFC'));
  if (w.includes(' ')) return false;      // contained a Latin letter -> not Ukrainian
  if (dic.has(w) || lookupSfx(w)) return true;
  const lower = w.toLowerCase();
  if (lower !== w && (dic.has(lower) || lookupSfx(lower))) return true;
  if (w.includes('-')) {                       // aff declares BREAK -
    const parts = w.split('-').filter(Boolean);
    if (parts.length > 1 && parts.every((p) => dic.has(p) || lookupSfx(p))) return true;
  }
  return false;
}
```

`measure.mjs`, `measure2.mjs` and `measure3.mjs` in full are ~200, ~180 and ~130 lines
respectively; the parts that carry the findings — the classifier, the n-gram weighting and the
finger/row feature extractor — are reproduced below.

### 10.3 Classifier and n-gram weighting

```js
const UK_LOWER = 'абвгґдежзийклмнопрстуфхцчшщьюяєії';
const UK_SET   = new Set((UK_LOWER + UK_LOWER.toUpperCase()).split(''));
const RU_ONLY  = new Set('ыэъёЫЭЪЁ'.split(''));
const APOS_ANY = new Set(["'", '’', 'ʼ']);

function classifyUk(w) {
  const reasons = [];
  if ([...w].some((c) => /[0-9]/.test(c)))    reasons.push('digit');
  if ([...w].some((c) => /[a-zA-Z]/.test(c))) reasons.push('latin');
  if ([...w].some((c) => RU_ONLY.has(c)))     reasons.push('russian-only-letter');
  const other = [...w].filter((c) => !UK_SET.has(c) && !RU_ONLY.has(c) && !APOS_ANY.has(c)
                                     && c !== '-' && !/[0-9a-zA-Z]/.test(c));
  if (other.length)                                       reasons.push('other-char');
  if ([...w].filter((c) => UK_SET.has(c)).length === 0)    reasons.push('no-ukrainian-letter');
  if ([...w].length === 1)                                reasons.push('single-char');
  if (w.includes('-'))                                    reasons.push('hyphen');
  if ([...w].some((c) => APOS_ANY.has(c)))                reasons.push('apostrophe');
  if (/^[А-ЯЄІЇҐ]/.test(w))                               reasons.push('initial-capital');
  return { reasons, other };
}

// TZ 3.3: weight(ngram) = sum of the frequencies of the words it occurs in.
// distinctPerWord=true implements the literal reading (once per word).
function ngramWeights(rows, n, { distinctPerWord, accept }) {
  const w = new Map();
  for (const [word, freq] of rows) {
    if (!accept(word)) continue;
    const chars = [...word.toLowerCase().normalize('NFC')];
    if (chars.length < n) continue;
    const seen = distinctPerWord ? new Set() : null;
    for (let i = 0; i + n <= chars.length; i++) {
      const g = chars.slice(i, i + n).join('');
      if (seen) { if (seen.has(g)) continue; seen.add(g); }
      w.set(g, (w.get(g) || 0) + freq);        // integers only -> order-independent
    }
  }
  return w;
}
```

### 10.4 Finger and row features

```js
const QWERTY = { LP: 'qaz', LR: 'wsx', LM: 'edc', LI: 'rfvtgb',
                 RI: 'yhnujm', RM: 'ik,', RR: 'ol.', RP: "p[];'/`" };          // TZ 2.1
const JCUKEN = { LP: 'йфя', LR: 'ціч', LM: 'увс', LI: 'кеапми',
                 RI: 'нгроть', RM: 'шлб', RR: 'щдю', RP: 'зхїжє.' };           // TZ 2.2
const ROWS_QWERTY = { 2: 'qwertyuiop[]', 3: "asdfghjkl;'", 4: 'zxcvbnm,./' };
const ROWS_JCUKEN = { 2: 'йцукенгшщзхї', 3: 'фівапролджє', 4: 'ячсмитьбю.' };

function bigramFeatures(g, M) {
  const [a, b] = [...g];
  const fa = M.f.get(a), fb = M.f.get(b);
  const ra = M.r.get(a), rb = M.r.get(b);
  if (!fa || !fb) return { unmapped: true };   // '-', apostrophe, ґ — see §5.4
  return {
    unmapped: false,
    sameKey: a === b,
    sameFinger: fa === fb && a !== b,
    sameHand: fa[0] === fb[0],
    rowChange: Math.abs(ra - rb),
  };
}
```

### 10.5 Determinism replay

```js
function serialise(map) {                      // code-unit sort, never localeCompare
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => k + '\t' + v).join('\n');
}
const r1 = serialise(ngramWeights(uk50, 2, { distinctPerWord: true, accept }));
const shuffled = [...uk50];
for (let i = shuffled.length - 1; i > 0; i--) { const j = (i * 7919) % (i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
const r3 = serialise(ngramWeights(shuffled, 2, { distinctPerWord: true, accept }));
console.log('reordered input -> identical output:', r1 === r3);              // true
console.log('0.1+0.2+0.3 === 0.3+0.2+0.1:', 0.1 + 0.2 + 0.3 === 0.3 + 0.2 + 0.1); // false
```

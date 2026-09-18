# 08 Research: Dictionary licensing and text normalization

Type: research
Status: resolved
Blocked by: none

## Question

What can we legally publish in a public repo, both source snapshots and derived data, and how should text be normalized and filtered?

**Licenses**
- FrequencyWords: MIT, plus any upstream terms from OpenSubtitles.
- dwyl: Unlicense.
- hunspell-en: SCOWL and related licenses.
- hunspell-uk: GPL-3.0; also verify brown-uk `dict_uk` licensing.
- Consequences of using GPL data as a filter vs shipping lists derived from it.
- Which project LICENSE to choose: MIT, GPL-3.0, or split code/data.
- REVIEW_REQUIRED organizer materials: status only; they are not to be committed.

**Normalization and filtering**
- Unicode NFC.
- Ukrainian apostrophe variants U+0027 / U+2019 / U+02BC and the authoritative recommendation.
- Handling of ґ, є, ї, і; never substitute them.
- Case and hyphen rules.
- Profanity lists for uk and en, with their licenses.
- Proper-noun filtering.
- n-gram weighting per TZ §3.3.
- Deterministic builds and checksums.

**Inputs:** `tasks/Typing-Race-2026-Hackathon/dictionaries/` (`manifest.yml`, `CHECKSUMS.sha256`) and `docs/DATA_POLICY.md`.

## Deliverable

`docs/research/08-dictionaries.md` on `main` (folded from its research branch in `2dcaba0`).

## Answer

Resolved 2026-09-17 by a research subagent. Findings: `docs/research/08-dictionaries.md` on `main` (folded from its research branch in `2dcaba0`) (10 sections), including local measurements and the scripts used.

**Licenses — all four are vendor-able**
- FrequencyWords: MIT licence file, but the upstream README claims CC-BY-SA-4.0 for the *content*, so derived tables comply with the stricter of the two.
- dwyl: Unlicense, no obligations.
- hunspell-en / SCOWL: the grant explicitly covers "the output created from the scripts", so derived files carry the notice.
- hunspell-uk: three conflicting upstream labels (GPL-3.0 as vendored, CC-BY-NC-SA-4.0 in the dict_uk README, MPL-1.1 in its hunspell distribution). **Sidestep it: use hunspell-uk as a build-time filter only and never emit its word material.**
- Profanity: LDNOOBW **V2** (CC0), `uk.txt` has 205 terms. The original Shutterstock list has no Ukrainian.
- **Proposed project LICENSE:** MIT for `src`, tests and scripts; per-file data licences recorded in `data/LICENSES.md`.

**Normalization**
- NFC only. NFKC is used solely as a build-time mojibake detector — applying it would turn `ﬁrst` into `first`, i.e. one keystroke into two.
- Apostrophe: Windows "Ukrainian (Enhanced)" and the Linux xkb `ua` default type U+0027; macOS types U+02BC; print uses U+2019; `dict_uk`'s aff folds everything to U+0027. **Rule: store U+0027, display U+2019, fold all variants on both sides of the comparison.**
- Never case-fold; never touch і/ї/є/ґ; ignore the `MAP гґ` directive.

**Measurements (the important ones)**
- All checksums and manifest counts verify exactly.
- **The Ukrainian lists contain zero apostrophes** — the upstream tokeniser deleted them (`п'ять` → `пять 388`). So apostrophe drills **cannot** be derived from frequency data, even though TZ §3.2 requires them.
- A strict alphabet filter drops only 10.6% and **leaves Russian intact**: `что` is the 5th-heaviest trigram. Hunspell membership is the real filter: 50 000 → 44 700 → **27 184 (54.4%)**. English: → 36 900 (73.8%) via dwyl. Residual Russian (`мне`, `его`) still survives.
- Both 50k lists are 100% lowercase, so capitalisation heuristics find **zero** proper nouns; a double hunspell query flags 2 530.
- TZ §3.3 once-per-word vs per-occurrence weighting differs by only 0.4% and the top 30 are identical, so take the literal reading.
- **ЙЦУКЕН has 18.58% same-finger transitions vs QWERTY's 5.80%** — transition training matters far more for Ukrainian.

**Contradictions found in the TZ**
- §5.3's example `rowChanges: 3` for «навчання» doesn't reproduce: adjacent pairs give 5, while 3 is the count of distinct rows touched. We must define and document our own metric.
- `ґ`, `-` and `'` have **no finger assignment** in §2.1/§2.2, yet §8.4 demands exactly one finger per supported key. We must assign them ourselves.

**Open questions** (for tickets 10 and 12)
- Where apostrophe drill words come from, since frequency data has none.
- How to remove residual Russian.
- Finger assignment for `ґ`, `-`, `'`.
- Which `rowChanges` definition we adopt.

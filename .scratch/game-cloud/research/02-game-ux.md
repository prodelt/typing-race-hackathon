# Research 02: what makes a browser app feel like an online game

Ticket: `.scratch/game-cloud/issues/02-game-ux-research.md`. Status: done (2026-10-01).

Method: primary sources first (the products' own pages, help centres, blogs and repos; recognised
designers' talks). Where a statement is my own reading of a product rather than something a source
says, it is marked *(observation)*. Some product wikis (Nitro Type and TypeRacer fandom pages)
returned HTTP 402/403 to the fetcher; claims from them rely on search-result excerpts and are marked
accordingly.

**Framing.** Hodent splits game UX into *usability* and *engage-ability*, and engage-ability into
motivation, emotion and game flow; usability affects all three because it controls friction and the
sense of being in control ([Hodent, The Gamer's Brain](https://thegamersbrain.com/);
[GDC17 talk notes](https://celiahodent.com/gamers-brain-part-3-ux-engagement-immersion-retention-gdc17-talk/)).
Steve Swink defines game feel as "real-time control of virtual objects in a simulated space, with
interactions emphasized by polish" ([Game Feel, ch. 1](http://mycours.es/gamedesign2014/files/2014/10/Game-Feel-Steve-Swink-chapter-1.pdf)).
The rest of this document is the structural reading of those two ideas: a game is a *place you are
in* with a *thing you do*, not a document you read.

## 1. App shell vs scrolling page

What the references do:

- **Game clients are shells, not pages.** The League client is a locally deployed web app whose
  features are plugins that register themselves with shared systems such as Navigation at runtime;
  the frame stays, the content swaps ([Riot: Under the hood of the League Client's Hextech UI](https://www.riotgames.com/en/news/under-hood-league-client%E2%80%99s-hextech-ui)).
  Steam's Big Picture mode is a full-screen interface built around a home screen of recently played
  games and an always-available quick access menu/overlay
  ([Windows Central](https://www.windowscentral.com/gaming/pc-gaming/valve-is-finally-replacing-big-picture-mode-on-desktops-with-the-steam-deck-ui);
  [XDA](https://www.xda-developers.com/valve-overhauls-steam-big-picture-mode/)).
- **Game-UI practice treats menus as one system.** Menu navigation is described as "the system that
  moves players through a game's screens – main, pause, settings, inventory, progression – as a
  coherent flow rather than a set of pages" ([Nasty Rodent: Game Menu Navigation](https://nastyrodent.com/game-menu-navigation/)).
- **Nitro Type lands you in a place.** After login the user is redirected to the Garage, where the
  equipped car, title and trail are shown and races are started
  ([Nitro Wiki: Garage, via search excerpt](https://nitro.fandom.com/wiki/Garage)).
- **Typing tools that feel like instruments fit in one viewport.** Monkeytype describes itself as
  minimalistic with a focus mode, real-time WPM/accuracy and a smooth caret
  ([Monkeytype repo](https://github.com/monkeytypegame/monkeytype)). *(observation)* The test page is
  a single fixed viewport; results replace the test in place rather than scrolling below it.
- **Websites scroll; lichess is the counter-example that proves the point.** The lichess home has a
  top nav, three quick-play actions, tournaments and then blog/news below the fold
  ([lichess.org](https://lichess.org/)) — it is a *site* around a game, and its in-game screen is
  where it switches to a fixed board layout (see section 4).

Takeaways:

1. A fixed-viewport shell (100dvh, no document scroll) is the single biggest structural signal.
   Scrolling is allowed *inside* panels (a leaderboard list, a lesson catalogue), never the frame.
2. Navigation swaps the *stage*; the frame (HUD bar, nav rail) does not re-render or jump.
3. Every meta screen should be composable into a 16:9-ish desktop canvas without needing the user to
   scroll to find the primary action.

## 2. Persistent navigation, HUD and status chips

Taxonomy. Fagerholt and Lorentzon's 2009 thesis classifies game UI on two axes, fiction and geometry,
giving four types: **non-diegetic** (overlay for the player only — most HUDs), **diegetic** (exists
in the world), **spatial** (in world space but not fiction — waypoints) and **meta** (fiction-adjacent
effects on the screen plane, such as red edges on damage)
([Beyond the HUD, ResearchGate](https://www.researchgate.net/publication/277202228_Beyond_the_HUD_-_User_Interfaces_for_Increased_Player_Immersion_in_FPS_Games);
[summary](https://nastyrodent.com/diegetic-and-non-diegetic-ui/)). Most games mix all four
([same](https://nastyrodent.com/diegetic-and-non-diegetic-ui/)).

Applied to a typing trainer *(observation)*:

| Type | Typing-Race example |
|---|---|
| Non-diegetic | Top status bar: level, XP bar, streak, rating chip; in-run WPM/accuracy readout |
| Diegetic | The race track itself: your car/marker position *is* your progress |
| Spatial | Highlight on the on-screen keyboard key to press next; finger-zone colour |
| Meta | Brief screen-edge tint or line shake on an error; glow on a streak milestone |

What the references show:

- **Status lives in a persistent bar.** Riot's client uses a top bar and banners layered with
  translucency; the "Play" button sits top-left in the same bar
  ([Riot tech blog](https://www.riotgames.com/en/news/under-hood-league-client%E2%80%99s-hextech-ui);
  [League client analysis](https://medium.com/@1537148253135/the-ui-of-league-of-legends-client-d6d8b947365a)).
  Duolingo keeps streak, gems and hearts as chips at the top of the path screen
  *(observation; the mechanics are documented in [Duolingo blog: streak](https://blog.duolingo.com/how-duolingo-streak-builds-habit))*.
- **Currency and XP are earned by the core loop.** Nitro Cash is earned by racing, season rewards and
  team rewards and is spent on cars, trails, stickers and titles; logged-in racers receive cash and
  XP per race ([Nitro Wiki: Cash](https://nitro.fandom.com/wiki/Cash);
  [Racing rewards](https://nitro.fandom.com/wiki/Racing_rewards), via search excerpts).
- **Rating is the competitive chip.** Chess sites show the rating next to the player name in game
  and on the profile; chess.com and lichess both let you *hide* it while playing
  ([chess.com focus mode](https://support.chess.com/en/articles/8588088-what-is-focus-mode-how-do-i-turn-it-on);
  [lichess zen mode](https://lichess.org/page/zen)).

Takeaways:

1. One persistent HUD bar on all meta screens: avatar/profile, level + XP progress, streak, and (when
   races exist) rating. Each chip is clickable and leads to its explanation screen.
2. Chips must be *live*: when a run ends, the XP bar fills and the level ticks in the HUD itself,
   so the frame proves the run mattered.
3. Do not add a currency unless something meaningful can be bought with it; a currency with no sink
   is decoration (cf. Hodent: rewards must be meaningful — section 7).

## 3. Lobby/home as hub; the "Play" primary action and quick match

- **One dominant primary action.** TypeRacer's front page is built around a big green "Enter a
  Typing Race" button that matches you with random opponents
  ([TeachMe help: How to play TypeRacer](https://teachmehelp.zendesk.com/hc/en-us/articles/5877690491543-How-to-play-TypeRacer)).
  The League client's "Play" button is the most conspicuous control in the frame
  ([League client analysis](https://medium.com/@1537148253135/the-ui-of-league-of-legends-client-d6d8b947365a)).
- **Quick match = presets, not forms.** Lichess's quick pairing is a grid of preset time controls
  (1+0 … 30+20); clicking one puts you straight into the pool. Presets exist so that pools stay
  large and waits short; anything custom goes to the lobby
  ([lichess forum: quick pairing vs lobby](https://lichess.org/forum/general-chess-discussion/quick-pairing-vs-lobby);
  [on auto-pairing pools](https://lichess.org/forum/lichess-feedback/on-auto-pairing-pools)).
- **Home as "continue where you left off".** Duolingo's home *is* the learning path: a linear
  sequence of levels with practice and stories embedded, introduced because learners were "not sure
  whether they're using Duolingo the 'correct' or 'best' way" and wanted "a clear path to follow"
  ([Duolingo blog: new home screen](https://blog.duolingo.com/new-duolingo-home-screen-design)).
  Steam's new Big Picture home leads with recently played games
  ([Windows Central](https://www.windowscentral.com/gaming/pc-gaming/valve-is-finally-replacing-big-picture-mode-on-desktops-with-the-steam-deck-ui)).
- **The hub shows your stuff.** Nitro Type's Garage is the post-login landing: your car, title,
  trail, mystery boxes and the race button ([Nitro Wiki: Garage, search excerpt](https://nitro.fandom.com/wiki/Garage)).
- **Practice starts on the first keystroke.** TypeRacer removed the countdown from single-player
  practice so the race starts as soon as you type the first letter, "a more instant action
  experience" ([TypeRacer blog](https://blog.typeracer.com/2024/03/06/new-feature-introducing-enhanced-practice-mode/)).
  Multiplayer keeps a 3-2-1 countdown once two or more players are on the track
  ([TeachMe help](https://teachmehelp.zendesk.com/hc/en-us/articles/5877690491543-How-to-play-TypeRacer)).

Takeaways:

1. Home is a hub with exactly one hero action: **Continue** (next step on the learning path), with
   **Race** as the clear secondary. Everything else (Academy, review, groups, leaderboards) is a
   tile or a nav item, never a competing hero.
2. Quick race = one click/keypress into a preset (language × length), not a configuration form.
3. Solo runs start on first keystroke; multiplayer uses a countdown because it synchronises people.

## 4. Meta screens vs the in-game screen

Games separate the *front end* (menus, hub, profile, shop) from the *in-game* screen, which strips
everything that is not needed to play.

- **chess.com focus mode** hides "the chat window, rating, menu bars" and shows "only the board,
  clocks, and the draw and resign buttons"
  ([chess.com help](https://support.chess.com/en/articles/8588088-what-is-focus-mode-how-do-i-turn-it-on)).
- **lichess zen mode** (toggle with `z`) hides opponent rating, chat and scoreboard; "only the board
  and clock remain" ([lichess Facebook announcement](https://m.facebook.com/lichessdotorg/photos/new-feature-zen-mode-hides-your-opponents-rating-chat-and-scoreboard-only-the-bo/337570746685888/);
  [lichess zen page](https://lichess.org/page/zen)).
- **Monkeytype** offers a focus mode and puts errors, WPM and accuracy directly in place in the text
  ([Monkeytype repo](https://github.com/monkeytypegame/monkeytype)).
- **Hodent**: working memory is tightly limited; onboarding should keep simultaneous new things to
  about three ([GDC16 onboarding notes](https://celiahodent.com/gamers-brain-ux-onboarding/)).
  The same logic applies to an in-run screen: the typing line plus at most a couple of glanceable
  numbers.

Takeaways:

1. Two layout modes. **Meta** = shell with HUD bar + nav. **Run** = the HUD and nav collapse; the
   stage holds the text line, the track (in races) and an optional keyboard; a single `Esc` exits.
2. The entry into a run and the exit to results are *transitions between modes*, not page loads
   (section 5).
3. The results screen is the bridge back to meta: it shows the run's numbers, then the rewards
   landing in the HUD, then one primary next action (Next / Rematch / Retry).
## 5. Transitions and motion

- **A shared motion vocabulary is part of the brand.** Riot ships CSS animations "with preset
  timings and easing functions to give animations that Hextech feel, client-wide", and uses
  state-machine-driven video for key states such as match "accept"
  ([Riot tech blog](https://www.riotgames.com/en/news/under-hood-league-client%E2%80%99s-hextech-ui)).
- **Durations.** NN/g: most UI animation should sit in 100–500 ms; simple feedback ~100 ms; larger
  moves such as a modal 200–300 ms; 400 ms is already slow; "at 500ms, animations start to feel like
  a real drag". Exits can be slightly shorter than entrances; ease-out for entering, ease-in for
  leaving; the more often an animation is seen, the shorter and subtler it must be
  ([NN/g: Animation duration](https://www.nngroup.com/articles/animation-duration/)).
- **Respect reduced motion.** WCAG 2.3.3 asks that interaction-triggered motion can be disabled
  unless essential; the W3C technique is the `prefers-reduced-motion` media query; colour and
  opacity changes are not "motion" under the criterion
  ([Deque on 2.3.3](https://dequeuniversity.com/resources/wcag2.1/2.3.3-animations-from-interactions);
  [Silktide](https://silktide.com/accessibility-guide/the-wcag-standard/2-3/seizures-and-physical-reactions/2-3-3-animation-from-interactions/)).
- **Video transitions are a client luxury.** Riot can use HTML5 video because the client is
  installed locally ([Riot tech blog](https://www.riotgames.com/en/news/under-hood-league-client%E2%80%99s-hextech-ui));
  a browser app under a JS budget should get the same effect from CSS transforms/opacity and the
  View Transitions API *(observation)*.

Takeaways:

1. Define 3–4 motion tokens (e.g. `instant 100ms`, `ui 200ms`, `stage 320ms`, `celebrate 600ms+`
   only for rare moments) and use them everywhere.
2. Meta → run: the frame recedes (HUD slides up/fades) and the stage scales in; run → results:
   numbers count up, then rewards fly into the HUD chips. These are the two transitions that sell
   "game"; spend the motion budget there, keep nav switches fast (≤200 ms).
3. Under `prefers-reduced-motion`, replace movement with opacity/colour, never remove feedback.

## 6. Feedback, sound, juice and their limits

- **Juice.** Jonasson and Purho's GDC Europe 2012 talk took a grey Breakout clone and added
  particles, tweening, screen shake and sound effect by effect until it felt alive
  ([GDC Vault: Juice It or Lose It](https://www.gdcvault.com/play/1016487/juice-it-or-lose)).
  The counterpoint talk warns indies to resist juicing for its own sake
  ([Game Developer: resist the urge to juice it](https://www.gamedeveloper.com/design/video-indies-resist-the-urge-to-juice-it-or-lose-it-)).
- **Feedback must be perceptible and immediate.** Hodent lists clear feedback and signs among the
  usability pillars ([GDC16 onboarding notes](https://celiahodent.com/gamers-brain-ux-onboarding/));
  Swink's "real-time control" requires input to elicit a reaction as fast as possible
  ([Swink ch. 1](http://mycours.es/gamedesign2014/files/2014/10/Game-Feel-Steve-Swink-chapter-1.pdf)).
- **Celebration is measured, not guessed.** Duolingo added streak-extension and milestone
  animations to "make the act of extending your streak feel as satisfying as possible"; this raised
  7-day return of new learners by 1.7 % ([Duolingo blog: streak](https://blog.duolingo.com/how-duolingo-streak-builds-habit)).
  Duolingo's characters react to correct answers with small animations
  ([Apple: Behind the Design – Duolingo](https://developer.apple.com/news/?id=jhkvppla)).
- **Sound is a system with channels.** The League client routes audio through Web Audio with
  separate channels (UI SFX, notifications, music, voice-over), ducks music under VO and respects
  per-channel volume ([Riot tech blog](https://www.riotgames.com/en/news/under-hood-league-client%E2%80%99s-hextech-ui)).
  Monkeytype makes typing sounds a user setting ([Monkeytype repo](https://github.com/monkeytypegame/monkeytype)).
- **Instruments stay calm in-run.** Monkeytype, chess.com focus mode and lichess zen mode all *remove*
  things during play (sections 1, 4). Hodent's working-memory limit applies
  ([GDC16 notes](https://celiahodent.com/gamers-brain-ux-onboarding/)).

Limits for a typing line *(observation, derived from the above)*:

- Never move, scale or shake the text being read. Error feedback = colour on the glyph (and an
  optional short tick sound); a line shake is allowed only on the *finished* word or as a meta edge
  tint, never on the caret line mid-word.
- Per-keystroke effects must be ≤100 ms, colour/opacity only, and cost no layout.
- Big juice (particles, count-ups, level-up burst, rank change) belongs to **boundaries**: race
  start, finish line, results, level-up, streak extension.
- Sound: off by default or on at low volume with a visible mute in the HUD; separate "keys" and
  "UI/celebration" toggles; never autoplay music.

## 7. Progression display and its pitfalls for learning apps

What works:

- **A visible path.** Duolingo's linear path interleaves lessons across skills and builds review
  into forward motion, based on spaced repetition
  ([Duolingo blog: home screen](https://blog.duolingo.com/new-duolingo-home-screen-design)).
- **Unlock by mastery.** keybr starts with the most frequent letters and adds new ones "once you
  reach the target speed with the current ones", and generates lessons that target the weakest keys
  ([keybr repo](https://github.com/aradzie/keybr.com)).
- **Show the lock before the key.** Hodent: "Show the lock, the purpose, the goal, before giving the
  key, the rewards"; goals and rewards "must be meaningful to the player"; difficulty should rise
  in a sawtooth so players notice their growth
  ([GDC17 notes](https://celiahodent.com/gamers-brain-part-3-ux-engagement-immersion-retention-gdc17-talk/)).
- **Streaks with a safety net.** Learners with a 7-day streak are 3.6× more likely to finish their
  course; but a broken streak "can... feel quite demotivating", so Duolingo added Streak Freeze
  ([Duolingo blog: streak](https://blog.duolingo.com/how-duolingo-streak-builds-habit)).
- **Fair, small, resetting leaderboards.** Duolingo leagues are weekly boards of ~30 matched
  learners with promotion/demotion across 10 tiers
  ([Duolingo help: leaderboards](https://www.duolingo.com/help/2/leaderboards-and-league);
  [Duolingo blog: leagues](https://blog.duolingo.com/duolingo-leagues-leaderboards/)).
- **Ratings for races.** Chess sites show an Elo-style rating per time control; lichess even lets
  players hide ratings in play to reduce anxiety ([lichess zen](https://lichess.org/page/zen)).

Pitfalls:

- **Overjustification.** Extrinsic rewards can undermine intrinsic motivation when they thwart
  competence, autonomy or relatedness ([Hodent GDC17](https://celiahodent.com/gamers-brain-part-3-ux-engagement-immersion-retention-gdc17-talk/);
  [NN/g: autonomy, relatedness, competence](https://www.nngroup.com/articles/autonomy-relatedness-competence/)).
- **Badges + leaderboards in education can backfire.** Hanus & Fox's semester-long study found
  gamified-course students' intrinsic motivation, satisfaction and exam scores fell versus control
  ([Computers & Education 80, 2015](https://www.researchgate.net/publication/265644737_Assessing_the_effects_of_gamification_in_the_classroom_A_longitudinal_study_on_intrinsic_motivation_social_comparison_satisfaction_effort_and_academic_performance)).
- **Global leaderboards demotivate the middle.** Comparisons across wildly different players create
  resentment except at the top ([Growth Engineering](https://www.growthengineering.co.uk/dark-side-of-gamification/));
  NN/g notes too-hard challenges lead to learned helplessness, too-easy to boredom
  ([NN/g video: gamification in UX](https://www.nngroup.com/videos/gamification-user-experience/)).
- **Linear paths cost autonomy.** Duolingo's switch from tree to path drew strong backlash
  ([NBC News](https://www.nbcnews.com/tech/tech-news/duolingos-update-redesign-luis-von-ahn-interview-rcna44655)).
- **XP for volume rewards grinding, not accuracy** *(observation)*. For touch typing the reward must
  track the learning target (accuracy at target speed, mastery of the stage's keys), not keystrokes.

Takeaways: XP and level from *mastery events* (key unlocked, stage criterion met, accuracy target
held); streak with a freeze; rating only in races; leaderboards scoped to groups or a weekly
small bracket, not one global table as the default view; a path map with free practice/review
always open beside it (autonomy).

## 8. Onboarding

- **Play first, sign up later.** Duolingo lets users finish a full lesson before creating an
  account; sign-up is optional and nudged as progress becomes worth saving; leaderboards stay
  gated ([Appcues GoodUX: Duolingo onboarding](https://goodux.appcues.com/blog/duolingo-user-onboarding);
  [Appcues: gradual engagement](https://www.appcues.com/blog/gradual-engagement-mobile-app-first-screen)).
- **First hour matters.** About 20 % of players drop in the first hour; teach by doing; max ~3 new
  things at once ([Hodent GDC16](https://celiahodent.com/gamers-brain-ux-onboarding/)).
- **Pull help, don't push tutorials.** NN/g: tutorials do not reliably build competence; deliver
  help when the user hits the situation ([NN/g: ARC](https://www.nngroup.com/articles/autonomy-relatedness-competence/)).
- **Instant start.** TypeRacer practice starts on the first keystroke
  ([TypeRacer blog](https://blog.typeracer.com/2024/03/06/new-feature-introducing-enhanced-practice-mode/)).

Takeaways: first visit → pick language/layout → a 30-second placement run on the home row,
immediately → result + "this is your path" reveal on the map → sign-in offered to save progress and
unlock races/groups. Contextual hints (finger position, `Esc` to exit) appear the first time the
situation arises, not as a carousel.

## 9. Desktop keyboard-first navigation

- **Monkeytype**: `Tab`/`Esc` quick-restart and a command line on `Esc` or `Ctrl/Cmd+Shift+P` to
  reach every function without the mouse ([Monkeytype repo/site via search](https://github.com/monkeytypegame/monkeytype);
  [discussion #3549](https://github.com/monkeytypegame/monkeytype/discussions/3549)).
- **lichess**: single-letter shortcuts in game — `z` zen, `f` flip, arrows/`hjkl` for moves
  ([lichess forum: keyboard shortcuts](https://lichess.org/forum/general-chess-discussion/keyboard-shortcuts)).
- **TypeRacer**: practice via `Ctrl+Alt+O` ([TypeRacer wiki, search excerpt](https://typeracer.fandom.com/wiki/Keyboard_Shortcuts)).
- **Steam Big Picture** hides the cursor in gamepad navigation and has invested in focus handling
  and fast key repeat ([Steam client update notes](https://store.steampowered.com/oldnews/189167);
  [GamingOnLinux](https://www.gamingonlinux.com/2022/11/valve-has-improved-the-new-big-picture-mode-for-desktop-quite-a-bit-in-a-new-beta/))
  — focus is a first-class visual state, not the browser default outline *(observation)*.

Takeaways: the user's hands are already on the keyboard — the whole loop must work without the
mouse. `Enter` = primary action on every meta screen (Continue / Race / Next), `Esc` = back / exit
run, `Tab` = restart in a solo run, digits or arrows select tiles, a visible styled focus ring,
and shortcut hints printed on the buttons themselves (`Enter ↵`). Typing keys must never trigger
navigation while a run is active.
## 10. Principles for Typing-Race

1. **Shell, not page.** Fixed 100dvh frame, no document scroll; panels scroll internally. (§1)
2. **Persistent HUD bar** on every meta screen: profile, level + XP bar, streak, race rating, sound
   mute. Chips are live and clickable. (§2)
3. **Home is a hub with one hero action** — `Continue` the path — and `Race` as the strong
   secondary. No competing heroes, no marketing copy above it. (§3)
4. **Two modes: meta and run.** In a run the HUD/nav collapse; only the text line, the track (races)
   and optional keyboard remain. `Esc` exits. (§4)
5. **Zero-friction start.** Solo runs start on the first keystroke; races use a synchronised 3-2-1;
   quick race is a preset, not a form. (§3)
6. **Rewards land in the frame.** Results count up, then XP flies into the HUD bar and the level
   ticks there; the frame proves the run mattered. (§2, §5)
7. **Motion tokens, spent at boundaries.** 100/200/320 ms tokens; big motion only on enter-run,
   finish, results, level-up, streak; nav ≤200 ms; reduced-motion swaps movement for opacity. (§5)
8. **The typing line is sacred.** It never moves, shakes or scales; per-key feedback is colour only,
   ≤100 ms. (§6)
9. **Sound as a channelled system,** quiet by default, separate key-click and UI/celebration
   toggles, mute in the HUD. (§6)
10. **Reward mastery, not volume.** XP and unlocks come from accuracy-at-target and stage criteria
    (keybr-style unlocks), never raw keystrokes. Show the lock before the key. (§7)
11. **Path with an open door.** A visible stage map for direction, plus weak-spot review and free
    practice always reachable (autonomy). (§7)
12. **Forgiving streaks, scoped competition.** Streak with a freeze; rating only in races;
    leaderboards default to your group / small weekly bracket. (§7)
13. **Play before sign-in.** First visit goes straight into a placement run; sign-in is offered to
    save progress and unlock races/groups. Contextual help, no tutorial carousel. (§8)
14. **Keyboard-complete.** `Enter` primary, `Esc` back, `Tab` restart, digits/arrows for tiles,
    styled focus, shortcut hints on buttons. (§9)
15. **One motion/visual vocabulary client-wide** (Riot's "Hextech feel"): the b-red tokens become
    game tokens — the same easing, surfaces and accent everywhere, including results and races. (§5)

## 11. Patterns that fit

| Pattern | Use in Typing-Race | Reference |
|---|---|---|
| Fixed client shell with plugin-like screens | App frame + swappable stage | League client ([Riot](https://www.riotgames.com/en/news/under-hood-league-client%E2%80%99s-hextech-ui)) |
| Top status bar with currency/XP chips | Level, XP, streak, rating | Duolingo, League client |
| Landing in your "place" after login | Home hub showing your path position and avatar/car | Nitro Type Garage ([wiki](https://nitro.fandom.com/wiki/Garage)) |
| Single giant play CTA | `Continue` / `Race` | TypeRacer ([help](https://teachmehelp.zendesk.com/hc/en-us/articles/5877690491543-How-to-play-TypeRacer)) |
| Preset quick-pairing grid | Quick race tiles: UA/EN × short/medium | lichess ([forum](https://lichess.org/forum/general-chess-discussion/quick-pairing-vs-lobby)) |
| Instant-start solo | Practice/lesson begins on first key | TypeRacer ([blog](https://blog.typeracer.com/2024/03/06/new-feature-introducing-enhanced-practice-mode/)) |
| Focus / zen in-game mode | Run mode hides HUD/nav | chess.com, lichess, Monkeytype |
| Quick restart + command palette | `Tab` restart, `Ctrl+K`/`Esc` palette | Monkeytype ([repo](https://github.com/monkeytypegame/monkeytype)) |
| Diegetic progress (car on a track) | Race track = progress bar | Nitro Type, TypeRacer |
| Linear path map with review built in | Stage 1–3 map with review nodes | Duolingo ([blog](https://blog.duolingo.com/new-duolingo-home-screen-design)) |
| Mastery-gated unlocks of letters | Stage/lesson unlock criteria | keybr ([repo](https://github.com/aradzie/keybr.com)) |
| Streak + freeze, milestone animation | Daily streak chip, celebration at 7/30 | Duolingo ([blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit)) |
| Weekly small leagues | Group / weekly bracket boards | Duolingo leagues ([help](https://www.duolingo.com/help/2/leaderboards-and-league)) |
| Per-mode rating, hideable | Race rating chip, hidden in run | lichess/chess.com |
| Results as reward screen | Count-up, rewards into HUD, `Enter` = next | Nitro Type racing rewards ([wiki](https://nitro.fandom.com/wiki/Racing_rewards)) |
| Channelled UI audio | Keys / UI / celebration channels | League client ([Riot](https://www.riotgames.com/en/news/under-hood-league-client%E2%80%99s-hextech-ui)) |

## 12. Anti-patterns that make it look like a website

- A long scrolling document with a footer; the primary action below the fold.
- A marketing hero ("Learn to type fast!") on the logged-in home instead of the user's own state.
- Top nav of text links with an underline hover, identical to a blog; no persistent status.
- Pages that reload/flash between screens; content that jumps when navigating; the frame
  re-rendering.
- Forms to start playing (dropdowns for language, length, mode) instead of preset tiles.
- Results as a static table of numbers with a "Back" link — no count-up, no reward landing, no
  `Enter` → next.
- Progress shown only as percentages and lists; no map, no level, no visible unlock.
- Stats/XP that change nothing in the frame (rewards you never see again).
- Global all-time leaderboard as the default competitive view.
- Default browser focus outline, mouse-only controls, or keys that do nothing outside the text box.
- Animation everywhere at the same weight (or none at all); generic 300 ms fades on every element.
- Sound absent entirely — or autoplaying.
- Juice on the typing line itself (shaking text, bouncing caret) — the "game" made unreadable.
- Badges/coins bolted on with nothing to spend them on (overjustification without meaning).
- A tutorial carousel or sign-up wall before the first keystroke.

## Sources

Products and official material
- Riot Games, Under the hood of the League Client's Hextech UI — https://www.riotgames.com/en/news/under-hood-league-client%E2%80%99s-hextech-ui
- Duolingo blog, new home screen design — https://blog.duolingo.com/new-duolingo-home-screen-design
- Duolingo blog, how the streak builds habit — https://blog.duolingo.com/how-duolingo-streak-builds-habit
- Duolingo blog, leagues — https://blog.duolingo.com/duolingo-leagues-leaderboards/
- Duolingo help, leaderboards and leagues — https://www.duolingo.com/help/2/leaderboards-and-league
- Apple Developer, Behind the Design: Duolingo — https://developer.apple.com/news/?id=jhkvppla
- TypeRacer blog, enhanced practice mode — https://blog.typeracer.com/2024/03/06/new-feature-introducing-enhanced-practice-mode/
- TeachMe (TypeRacer) help, how to play — https://teachmehelp.zendesk.com/hc/en-us/articles/5877690491543-How-to-play-TypeRacer
- chess.com help, focus mode — https://support.chess.com/en/articles/8588088-what-is-focus-mode-how-do-i-turn-it-on
- lichess home — https://lichess.org/ ; zen mode — https://lichess.org/page/zen ; zen announcement — https://m.facebook.com/lichessdotorg/photos/new-feature-zen-mode-hides-your-opponents-rating-chat-and-scoreboard-only-the-bo/337570746685888/
- lichess forum, quick pairing vs lobby — https://lichess.org/forum/general-chess-discussion/quick-pairing-vs-lobby ; auto-pairing pools — https://lichess.org/forum/lichess-feedback/on-auto-pairing-pools ; shortcuts — https://lichess.org/forum/general-chess-discussion/keyboard-shortcuts
- Monkeytype repo — https://github.com/monkeytypegame/monkeytype ; discussion #3549 — https://github.com/monkeytypegame/monkeytype/discussions/3549
- keybr repo — https://github.com/aradzie/keybr.com
- Nitro Wiki (search excerpts; fetch blocked) — https://nitro.fandom.com/wiki/Garage , https://nitro.fandom.com/wiki/Cash , https://nitro.fandom.com/wiki/Racing_rewards
- TypeRacer wiki (search excerpt) — https://typeracer.fandom.com/wiki/Keyboard_Shortcuts
- Steam client update notes — https://store.steampowered.com/oldnews/189167 ; coverage — https://www.windowscentral.com/gaming/pc-gaming/valve-is-finally-replacing-big-picture-mode-on-desktops-with-the-steam-deck-ui , https://www.xda-developers.com/valve-overhauls-steam-big-picture-mode/ , https://www.gamingonlinux.com/2022/11/valve-has-improved-the-new-big-picture-mode-for-desktop-quite-a-bit-in-a-new-beta/
- League client UI analysis — https://medium.com/@1537148253135/the-ui-of-league-of-legends-client-d6d8b947365a

Designers, research and guidelines
- Celia Hodent, The Gamer's Brain — https://thegamersbrain.com/ ; GDC16 onboarding — https://celiahodent.com/gamers-brain-ux-onboarding/ ; GDC17 engagement — https://celiahodent.com/gamers-brain-part-3-ux-engagement-immersion-retention-gdc17-talk/
- Steve Swink, Game Feel ch. 1 — http://mycours.es/gamedesign2014/files/2014/10/Game-Feel-Steve-Swink-chapter-1.pdf
- Jonasson & Purho, Juice It or Lose It (GDC Europe 2012) — https://www.gdcvault.com/play/1016487/juice-it-or-lose ; counterpoint — https://www.gamedeveloper.com/design/video-indies-resist-the-urge-to-juice-it-or-lose-it-
- Fagerholt & Lorentzon, Beyond the HUD (2009) — https://www.researchgate.net/publication/277202228_Beyond_the_HUD_-_User_Interfaces_for_Increased_Player_Immersion_in_FPS_Games ; summary — https://nastyrodent.com/diegetic-and-non-diegetic-ui/
- Nasty Rodent, game menu navigation — https://nastyrodent.com/game-menu-navigation/
- NN/g, animation duration — https://www.nngroup.com/articles/animation-duration/ ; autonomy/relatedness/competence — https://www.nngroup.com/articles/autonomy-relatedness-competence/ ; gamification video — https://www.nngroup.com/videos/gamification-user-experience/
- Hanus & Fox (2015), Computers & Education 80 — https://www.researchgate.net/publication/265644737_Assessing_the_effects_of_gamification_in_the_classroom_A_longitudinal_study_on_intrinsic_motivation_social_comparison_satisfaction_effort_and_academic_performance
- Growth Engineering, dark side of gamification — https://www.growthengineering.co.uk/dark-side-of-gamification/
- NBC News, Duolingo redesign backlash — https://www.nbcnews.com/tech/tech-news/duolingos-update-redesign-luis-von-ahn-interview-rcna44655
- Appcues, Duolingo onboarding — https://goodux.appcues.com/blog/duolingo-user-onboarding ; gradual engagement — https://www.appcues.com/blog/gradual-engagement-mobile-app-first-screen
- WCAG 2.3.3 — https://dequeuniversity.com/resources/wcag2.1/2.3.3-animations-from-interactions ; https://silktide.com/accessibility-guide/the-wcag-standard/2-3/seizures-and-physical-reactions/2-3-3-animation-from-interactions/
- Game UI Database (reference library for screen flows) — https://www.gamedeveloper.com/design/game-ui-database-relaunches-with-new-features-video-support-and-over-55-000-screenshots

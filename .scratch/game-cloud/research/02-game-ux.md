# Research 02: what makes a browser app feel like an online game

Ticket: `.scratch/game-cloud/issues/02-game-ux-research.md`. Status: in progress.

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
TODO
## 6. Feedback, sound, juice and their limits
TODO
## 7. Progression display and its pitfalls for learning apps
TODO
## 8. Onboarding
TODO
## 9. Desktop keyboard-first navigation
TODO
## 10. Principles for Typing-Race
TODO
## 11. Patterns that fit
TODO
## 12. Anti-patterns that make it look like a website
TODO
## Sources
TODO

# Hold'em Drill: context for Claude Code

A mobile-first practice app for **live No-Limit Hold'em cash games, heads-up to 9-handed** (100bb stacks, blinds 1/2). The owner mostly plays 3-4 handed and heads-up, so that is the default table-size range. It generates endless poker spots with code, grades answers, and explains each answer so the player learns the reasoning, not just the result. The owner plays casual home games with friends who limp, call a lot, and bet big after the flop. His main leak was paying off big bets with one pair.

## Files
- `index.html`: the entire app (HTML, CSS and JS in one file, no build step, no dependencies).
- `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png`: installable PWA with offline support. **Every release: bump the version in both places, `CACHE` in `sw.js` (`holdem-drill-X.Y.Z`) and `BUILD` in `index.html` (`v:"X.Y.Z"`), and set `BUILD.at` to the release time in UTC (`"2026-11-11T09:55Z"`).** Versioning (owner's rule): a small fix bumps Z (2.0.0 → 2.0.1), a new feature bumps Y, a big change bumps X. The interface redesign counts as part of 2.x (a build was briefly labelled 3.0.0; it is 2.1). Do not go to 3.0 without the owner saying so. Settings shows "v2.0.0 · built 11 Nov 2026, 16:55" in the phone’s time zone, so you can tell when a deploy has loaded. The tests check the two versions match.
- `icon.svg`: the one source for the logo. The header logo inlines it, and every PNG icon is rendered from it (maskable and apple-touch versions without the rounded corners). Change the logo there, then re-render the PNGs.
- `tests/verify.mjs`: strategy and integrity checks. **Run `node tests/verify.mjs` after every change. It must print "All checks passed".**
- Hosted on GitHub Pages from `main`, at the repo root.

## Code map (inside `index.html`, in order)
1. **Cards and evaluator**: `RANKS`, `SUITS`, `dealFrom`, `parse(str, perm)` (uses `T` for ten), `eval5`, `best(cards)` (best 5 of n), `cmp`, `hname`.
2. **Ranges**: `CH` holds charts `{at, s:{topRank:minKicker}, o:{...}}`. Pairs are always in. **One chart per seat**: a seat's range depends on who is left to act, not on the table size, so `CH.BTN` (and every other seat) is used at every table size. `inCh(chart, hand)`, `why(chart, hand)` (explains the edge), `isEdge` (hand next to the boundary), `randHand(used, filter)`, `randNear(chart)` (half the time deals an edge hand), `randPlay(chart)` (half the time an edge hand, otherwise leans toward hands in or next to the range; used where most hands fold).
3. **Table sizes and seats**: `FMTS` is `"2"`..`"9"`. `RING` is `UTG, UTG1, MP, LJ, HJ, CO, BTN, SB, BB`; `seatsFor(f)` drops seats from the front (6-handed starts at LJ, 4-handed at CO, heads-up is `BTN, BB`). `openKey`, `bbKey(raiser)`, `pushKey` map a seat to its chart. `scene(f, you, acts)` writes the action before the hero ("Cutoff and button fold.") and returns the folded seats and seat labels.
4. **Topics**: `T(name, formats, gen)` registers a generator. `formats` is a list of table sizes or `null` for seat-independent topics. `gen(f)` returns a spot object or `null` (the caller retries).
5. **Spot object**: `{f, you, out, sub, act, board, hand, opp, label, q, o:[{t, ok}], e, rkey, rhl, fixed, tag}`. `out` = folded seats, `sub` = seat labels ("Raise", "Limp", "Call", "3-bet", "All-in"). Several options may be `ok:true` when both are genuinely fine. `fixed:true` keeps option order. `rkey` (an `RSPEC` key) shows the range chart after the answer. There is no range hint before answering (removed on purpose; the Learn view is where you study charts). `rhl` is the hand to highlight. A spot without `f` and `you` shows `tag` instead of the seat strip. Spots must stay plain JSON: missed spots are saved and shown again.
6. **Explanations**: `E(why, principle, commonMistake)`. Every explanation must teach: why this spot, the general principle, and the trap. `handNote(h, play)` describes the hand, worded for a play or for a fold.
7. **Range helpers**: `RSPEC` (who plays each chart, the verb, and which hands re-raise via `prem`), `isPrem(kind, h)`, `rangeGrid(key, highlight)`, `rangeText(key)`, `chartPct`. Percentages in the text come from `chartPct`, never typed by hand.
8. **Skills and reviews**: `skillOf(g)` names what a spot tests (`topic|sk`, else `topic|rkey`). Every generator sets `sk` unless `rkey` already says it (for example `Flop c-bets|nothing|dry`, `River vs big bets|top|solid`). `variant(topic, f, skill)` deals a new spot of the same skill. When adding a generator, give it an `sk`; the tests check that every skill can be dealt again.
9. **UI and state** (after `/* ===== State`): localStorage key `endlessHoldemDrill.v2`. `render()` draws the header, the current page into `#page`, and the bottom navigation; `setView(v)` switches page. Table size is a range `st.lo`..`st.hi`, changed only in Settings, which opens a sheet with a two-handle slider (either handle can be either end). The header shows the range as plain text, not a control. Theme (`st.theme`: dark, light, or auto) sets `data-theme` on `<html>`, and a MutationObserver re-applies it if the host changes it.
10. **Navigation**: a bottom bar with four pages. **Practice** (the spot), **Learn** (Lessons, Ranges and Raising), **Progress** (accuracy ring, review counts, accuracy by topic weakest first, recent mistakes) and **Settings** (table size, smart mode, topics, appearance, sound, reset). Tapping a topic in Progress drills only that topic.
   - **Practice page**: `tableHTML(g)` draws an oval table with seats in action order clockwise, you at the bottom, the dealer button, each seat's action, and the pot and board in the middle (the pot is read from "Pot is N" in `g.act`). Spots without seats show You against Opponent. Your cards sit under your seat. `explHTML` shows the verdict, the answer, then Why; The principle, Common mistake and the range chart are collapsible, open after a miss and closed after a right answer.
11. **Learn**: three sections.
   - **Lessons** (the default): `LESSONS` is a 16-lesson course in five `UNITS`. A lesson is a few short pages (`h`, `p`, optional `rows` table or a function returning one, `chart`, `tip`) and a `quiz` of real spots from one topic (`n` spots, `pass` mark, optional `test(g)` filter, `need3`). `lessonSpot(L, f)` deals a quiz spot. In the UI, `les` is the open lesson; `startQuiz` sets `focus={q,i,ok,n}`, `advance()` goes to the next spot or `finishQuiz()`, which saves `st.les[id]={best,pass,page}`. Quiz answers count in stats and feed the review ladder. Lesson numbers repeat the strategy rules below: tables that can read a chart do (`pctRow`, `guideRows`). **When a strategy rule changes, check the lesson text too.**
   - **Ranges**: `learnGroups(f)` lists every chart for one table size (opening, big blind defense, facing a raise, short stack), shown as cards with `learnNote(k)`, the grid and the edges. "Drill this chart" sets `focus={k,f}` and `next()` deals only that chart via `drillSpot` until Stop. When adding a chart, add it to `learnGroups`.
   - **Raising**: `RAISE_GUIDE` cards (opening raise, over limpers, 3-bet, facing a 3-bet, flop bets, river raise, check-raise, short stack): a table of sizes and hands, why, and a drill button for the matching topic (`focus={t}`). Its numbers repeat the rules below; the tests check the sizes against the generators. **When a strategy number changes, change it here too.**
   - The drill bar shows what is being drilled, a Chart/Back button (returns to where the drill started, drill kept) and Stop.
12. **Smart mode** (how the app helps you remember):
   - **Review ladder** (`st.rev`, keyed by skill, `LADDER`): a miss puts the skill in box 0 and the exact spot returns 3-4 spots later. Each right answer moves it up: box 1 after ~10 spots and box 2 after ~25 spots (both with new cards), then 1, 3 and 7 days. Right at the last box = mastered (`st.mastered`). A miss at any box sends it back to box 0. This is successive relearning (Rawson & Dunlosky): retrieve until right, then relearn at growing gaps.
   - Each queued skill stores the version that saved it (`ver`). A box-0 spot saved by an older version is dealt fresh instead of replayed, so old wording never comes back. `variant` falls back to a fresh copy of the same question when a skill has only one spot.
   - Reviews show up as "second try" (box 0) or "review" and are never served twice in a row unless 4+ are due, so new spots stay mixed in (interleaving). The feedback says when the skill comes back.
   - Topic mix: `weighted()` uses `st.ew`, a recent error rate per topic (each answer counts 20%), not lifetime accuracy.
   - Random mode turns all of this off.

The Learn page is not a topic: it shows charts and the raising guide, and drilling uses the existing topics.

Topics: Preflop opens, Big blind defense, Facing a raise, Facing limps, Facing 3-bets, Flop c-bets, River vs big bets, Pot odds, Draws & equity, Preflop ranges, All-in decisions, Adaptation.

## Strategy source of truth (do not drift from this)
**Opening ranges (raise first in), one per seat, the same at every table size:**
- UTG ~12%, UTG+1 ~13%, MP ~16%, lojack ~19%, hijack ~26%, cutoff ~35%, button ~50%. Each must be a subset of the next. All pairs are opened from every seat (home-game players pay off sets).
- The button is the same spot at every table size, with only the blinds left. There is one `CH.BTN`.
- Small blind, folded to: ~43%, raise-or-fold, never limp, raise to 3x (6). Offsuit hands need high cards (K7o+, Q9o+, J9o+). Weak offsuit connectors (65o, 54o) fold.
- Heads-up button: ~83%. Sizes are 2.5x (5) except the SB, which uses 3x (6).

**Big blind defense** (the earlier the raiser, the tighter; the charts nest):
- vs a button 2.5x raise: ~57% (all suited, all pairs, A2o+, K5o+, Q8o+, J8o+, T8o+, 98o, 87o). Re-raise JJ+, AK, AQ.
- vs a small-blind 3x raise: the same hands as against the button (tighter range and a worse price, but you have position).
- vs a cutoff raise: ~48%. Re-raise JJ+, AK, AQ.
- vs a hijack or lojack raise: ~36%. vs UTG, UTG+1 or MP: ~25%. Against both, re-raise only QQ+, AK.
- Heads-up: ~66%. Re-raise 99+, AQ+.

**Facing a raise outside the big blind** (one raiser, everyone between folds):
- Re-raise (to 15 in position, 18 from the small blind): JJ+, AK, AQ against a cutoff or button raise. QQ+, AK against a raise from the hijack or earlier.
- In position, call: all other pairs (set mining), suited broadway, any suited ace, suited connectors 54s-T9s, AQo. Against a cutoff raise also AJo and KQo.
- Small blind, call: pairs, suited broadway (ATs+, KTs+, QTs+, JTs), AQo. Against a cutoff or button raise also AJo and KQo. No speculative suited hands out of position.
- Fold the rest. Offsuit hands like A9o, KTo and QJo always fold to a raise: they make dominated top pairs.

**Limps:**
- Strong iso hands: 77+, AT+, any suited ace, KQ, KJ, suited broadway. Raise to 8-10 over one limper, 12-14 over two.
- On the button over one limper also isolate with two broadway cards. In any seat with position on the limper, limp behind with speculative hands (22-66, suited connectors and one-gappers). Fold the rest.
- Offsuit broadway hands that aren't strong (KTo, QJo, QTo, JTo) are too close to grade anywhere except the button over one limper or the big blind, so the generator skips those spots.
- Small blind vs a limp: raise strong hands. With speculative hands, fold or complete are both accepted.
- Big blind: check everything that isn't strong. Never fold when checking is free.

**Facing a 3-bet** (amateur 3-bet range is roughly QQ+, AK, AQ, JJ):
- 4-bet or call: QQ+, AK.
- Call: TT-JJ, AQ, AJs, KQs.
- Small pairs and suited connectors: call only if the cost is ≤ 1/10 of the stack.
- Fold the rest.

**Flop c-bet** (you raised, a typical BB called, pot 11):
- Board texture: **wet** = monotone, or connected (three cards within a 4-rank span), or two-tone with two cards within 3 ranks. A two-tone disconnected board is "fairly dry".
- Strong hands: big bet on wet boards, either size on dry boards.
- Top pair or overpair: small on dry, big on wet.
- Second pair, or a pocket pair between the top two cards: small on dry, check on wet.
- A pair below two board cards (for example 77 on K-J-6) and bottom pair: **always check**.
- Air: small c-bet on dry boards, check on wet boards.
- **Against two callers** (SB and BB, pot 15): no bluffs and no thin bets. Strong hands and top pair bet as above. Second pair, weaker pairs and air check on every board.

**River vs big bets:**
- Solid player betting big on three streets: fold top pair. Call top two pair.
- With a set: raise, **except** call when a straight is possible against a solid player.
- A proven bluffer, or a small bet: call top pair.
- Raise size (`riverRaise`): about 2.5x their bet, rounded to 5; all-in when that is 80% or more of what is left (200 minus half the pot). Every raise option shows its size.

**Pot odds:** need = call ÷ (pot + bet + call). A bluff breaks even when they fold bet ÷ (pot + bet) of the time. Pots in the quiz divide evenly, so answers match the memorized prices (1/3 pot: call needs 20%, bluff needs 25%). Draw equity uses outs ×4 on the flop **only when the opponent is all-in**, and ×2 on the turn.

**Short-stack all-in** (6-12bb, shove or fold): early seats (UTG, UTG+1, MP) ~11%, hijack or lojack ~15%, cutoff ~21%, button ~38%, small blind or heads-up ~58%. The charts must nest.

**Calling a 100bb preflop shove:** compare equity against the shover's range with the price (~49%). Equities are precomputed in `EQ` (a live simulation was too slow on a phone and could flip close answers); the tests re-check the table by simulation. Spots within 4 points of the price are skipped. Tight player (QQ+, AK): call AA-KK only. Typical player (TT+, AQ+): QQ+ and AK. Maniac: lighter.

**Postflop all-in:** low SPR (about 1 or less): top pair calls. Deep SPR vs a solid player: two pair or better.

**Adaptation:** if they fold too much, bluff more. If they bluff too much, call more. If they call too much, value bet more and bluff less. Thin value: bet top pair on the river when worse hands call (a calling station), check it back when only better hands call.

## Past mistakes (regression list, keep these fixed)
- The button was once 65% (3-handed) and 59% (4-handed) despite being the same spot. The cutoff was 46%.
- BB3 once defended K2o but folded JTo.
- 77 on K-J-6 was once a small bet. It must check.
- River "two pair" must be top two pair. A set with a straight possible vs a solid player is a call.
- The A♥5♥ flush-draw template once had a turn card that added a wheel gutshot. Outs are now verified by brute force in the tests.
- Short-stack shoves once used one range from every seat, up to 20bb.
- Charts were once named per table size (`BTN3`, `BTN4`, `SB3`, `SB4`), which let the same seat drift apart. There is now one chart per seat.
- The 4-handed "big blind vs button" spot once described itself as 3-handed.
- Pot-odds answers once disagreed with the memorized prices because the bet was rounded (a bet of 7 into 20 gave 21%, not 20%).
- The flop all-in draw spot once offered "Raise all-in" against a player who was already all-in.
- Explanations once praised a hand while telling you to fold it ("A strong ace makes top pair..." on a fold). `handNote` now takes `play`.
- Adaptation once said "the blinds" when only the big blind was left, and called TT-JJ/AQ "a fold against a normal 3-bet".
- Reviews once replayed a spot saved before the table-size context was added, so “what share does the cutoff open” showed with no table size.
- River explanations once said “a straight is possible” without naming it, and a wheel (52 on A-4-3) looked like a mistake. `strNames` now names every straight.
- Seat text once said "about 36%" for the cutoff while the chart was 35%. Text now reads the chart.

## Conventions
- **Text:** plain, direct English, no fluff. Typographic apostrophes and quotes (’ “ ”) in visible text, straight quotes in code.
- **Ten:** card faces show **10**. Everywhere else (labels like KTo, charts, explanations) uses **T**.
- **Seats:** named by distance from the button (lojack, hijack, cutoff), so a seat means the same thing at every table size. The table must fit 9 seats on a 360px screen with no seat overlapping another or the board.
- **Fonts:** the system font stack only (`--sans`). No web fonts: the owner found Fraunces and Instrument Sans made it look like a generic AI-built app. `--serif` is kept as the name of the display face but points at the same stack.
- **Design:** mobile first. Palette: felt green (`--felt`), cream cards, gold accents (`--gold`). Every color is a CSS variable with light and dark values. The question and answers must fit on one phone screen without scrolling.
- **Sound:** synthesized with Web Audio in `sfx(kind)` (no audio files): `deal` on a new spot with cards, and `fold`, `check`, `call`, `raise`, `allin` or `tap` chosen from the answer text by `sfxFor`. `st.sound` (Settings switch) turns it off.
- **Accessibility:** keep tap targets at least 44px. Support keyboard input (1-3 to answer, Enter for next); there is no on-screen hint for it. Respect `prefers-reduced-motion`.
- **Answers:** when changing strategy, update the generator logic, the explanation text, this file, and the tests together.

## Owner preferences
- Direct, unvarnished advice. He pushes back on hedging.
- Wants to *understand* concepts, so explanations matter as much as answers.
- Prefers live poker over online. Studies Jonathan Little. GTO is a baseline, adjusted to exploit home-game players.

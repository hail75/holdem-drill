# Hold'em Drill: context for Claude Code

A mobile-first practice app for **live No-Limit Hold'em cash games, heads-up to 9-handed** (100bb stacks, blinds 1/2). The owner mostly plays 3-4 handed and heads-up, so that is the default table-size range. It generates endless poker spots with code, grades answers, and explains each answer so the player learns the reasoning, not just the result. The owner plays casual home games with friends who limp, call a lot, and bet big after the flop. His main leak was paying off big bets with one pair.

## Files
- `index.html`: the entire app (HTML, CSS and JS in one file, no build step, no dependencies).
- `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png`: installable PWA with offline support. **Bump the cache name in `sw.js` (`holdem-drill-vN`) on every release.**
- `icon.svg`: the one source for the logo. The header logo inlines it, and every PNG icon is rendered from it (maskable and apple-touch versions without the rounded corners). Change the logo there, then re-render the PNGs.
- `tests/verify.mjs`: strategy and integrity checks. **Run `node tests/verify.mjs` after every change. It must print "All checks passed".**
- Hosted on GitHub Pages from `main`, at the repo root.

## Code map (inside `index.html`, in order)
1. **Cards and evaluator**: `RANKS`, `SUITS`, `dealFrom`, `parse(str, perm)` (uses `T` for ten), `eval5`, `best(cards)` (best 5 of n), `cmp`, `hname`.
2. **Ranges**: `CH` holds charts `{at, s:{topRank:minKicker}, o:{...}}`. Pairs are always in. **One chart per seat**: a seat's range depends on who is left to act, not on the table size, so `CH.BTN` (and every other seat) is used at every table size. `inCh(chart, hand)`, `why(chart, hand)` (explains the edge), `isEdge` (hand next to the boundary), `randHand(used, filter)`, `randNear(chart)` (half the time deals an edge hand), `randPlay(chart)` (leans toward hands in or next to the range).
3. **Table sizes and seats**: `FMTS` is `"2"`..`"9"`. `RING` is `UTG, UTG1, MP, LJ, HJ, CO, BTN, SB, BB`; `seatsFor(f)` drops seats from the front (6-handed starts at LJ, 4-handed at CO, heads-up is `BTN, BB`). `openKey`, `bbKey(raiser)`, `pushKey` map a seat to its chart. `scene(f, you, acts)` writes the action before the hero ("Cutoff and button fold.") and returns the folded seats and seat labels.
4. **Topics**: `T(name, formats, gen)` registers a generator. `formats` is a list of table sizes or `null` for seat-independent topics. `gen(f)` returns a spot object or `null` (the caller retries).
5. **Spot object**: `{f, you, out, sub, act, board, hand, opp, label, q, o:[{t, ok}], e, rkey, rhl, noPeek, fixed, tag}`. `out` = folded seats, `sub` = seat labels ("Raise", "Limp", "Call", "3-bet", "All-in"). Several options may be `ok:true` when both are genuinely fine. `fixed:true` keeps option order. `rkey` (an `RSPEC` key) shows the range chart after the answer and enables the pre-answer peek unless `noPeek`. `rhl` is the hand to highlight. A spot without `f` and `you` shows `tag` instead of the seat strip. Spots must stay plain JSON: missed spots are saved and shown again.
6. **Explanations**: `E(why, principle, commonMistake)`. Every explanation must teach: why this spot, the general principle, and the trap. `handNote(h, play)` describes the hand, worded for a play or for a fold.
7. **Range helpers**: `RSPEC` (who plays each chart, the verb, and which hands re-raise via `prem`), `isPrem(kind, h)`, `rangeGrid(key, highlight)`, `rangeText(key)`, `chartPct`. Percentages in the text come from `chartPct`, never typed by hand.
8. **UI and state** (after `/* ===== State`): localStorage key `endlessHoldemDrill.v2`. Table size is a range `st.lo`..`st.hi` set by a two-handle slider (either handle can be either end). Smart mode weights topics by error rate (`weighted()`) and re-asks missed spots 4-6 questions later (`st.retry`, up to three more tries). Theme switch (`st.theme`: dark, light, or auto) sets `data-theme` on `<html>`, and a MutationObserver re-applies it if the host changes it.

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
- Seat text once said "about 36%" for the cutoff while the chart was 35%. Text now reads the chart.

## Conventions
- **Text:** plain, direct English, no fluff. Typographic apostrophes and quotes (’ “ ”) in visible text, straight quotes in code.
- **Ten:** card faces show **10**. Everywhere else (labels like KTo, charts, explanations) uses **T**.
- **Seats:** named by distance from the button (lojack, hijack, cutoff), so a seat means the same thing at every table size. The seat strip must fit 9 seats on a 360px screen.
- **Design:** mobile first. Palette: felt green (`--felt`), cream cards, gold accents (`--gold`). Every color is a CSS variable with light and dark values. The question and answers must fit on one phone screen without scrolling.
- **Accessibility:** keep tap targets at least 44px. Support keyboard input (1-3 to answer, Enter for next). Respect `prefers-reduced-motion`.
- **Answers:** when changing strategy, update the generator logic, the explanation text, this file, and the tests together.

## Owner preferences
- Direct, unvarnished advice. He pushes back on hedging.
- Wants to *understand* concepts, so explanations matter as much as answers.
- Prefers live poker over online. Studies Jonathan Little. GTO is a baseline, adjusted to exploit home-game players.

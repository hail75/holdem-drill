# Hold'em Drill: context for Claude Code

A mobile-first practice app for **3-4 handed and heads-up live No-Limit Hold'em cash games** (100bb stacks, blinds 1/2). It generates endless poker spots with code, grades answers, and explains each answer so the player learns the reasoning, not just the result. The owner plays casual home games with friends who limp, call a lot, and bet big after the flop. His main leak was paying off big bets with one pair.

## Files
- `index.html`: the entire app (HTML, CSS and JS in one file, no build step, no dependencies).
- `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png`: installable PWA with offline support. **Bump the cache name in `sw.js` (`holdem-drill-vN`) on every release.**
- `tests/verify.mjs`: strategy and integrity checks. **Run `node tests/verify.mjs` after every change. It must print "All checks passed".**
- Hosted on GitHub Pages from `main`, at the repo root.

## Code map (inside `index.html`, in order)
1. **Cards and evaluator**: `RANKS`, `SUITS`, `dealFrom`, `parse(str, perm)` (uses `T` for ten), `eval5`, `best(cards)` (best 5 of n), `cmp`, `hname`.
2. **Ranges**: `CH` holds charts `{where, s:{topRank:minKicker}, o:{...}}`. Pairs are always in. `inCh(chart, hand)`, `why(chart, hand)` (explains the edge), `randHand(used, filter)`.
3. **Topics**: `T(name, formats, gen)` registers a generator. `formats` is `["2","3","4"]` (heads-up, 3-handed, 4-handed) or `null` for seat-independent topics. `gen(f)` returns a spot object or `null` (the caller retries).
4. **Spot object**: `{f, you, out, act, board, hand, opp, label, q, o:[{t, ok}], e, grid, rtext, peekKey, fixed, tag}`. Several options may be `ok:true` when both are genuinely fine. `fixed:true` keeps option order. `peekKey` (an `RSPEC` key) enables the pre-answer range peek.
5. **Explanations**: `E(why, principle, commonMistake)`. Every explanation must teach: why this spot, the general principle, and the trap.
6. **Range helpers**: `RSPEC` (descriptions for charts), `rangeGrid(key, highlight)`, `rangeText(key)`, `chartPct`.
7. **UI and state** (after `/* ===== State`): localStorage key `endlessHoldemDrill.v2`. Smart mode weights topics by error rate (`weighted()`). Theme switch (`st.theme`: dark, light, or auto) sets `data-theme` on `<html>`, and a MutationObserver re-applies it if the host changes it.

Topics: Preflop opens, Big blind defense, Facing limps, Facing 3-bets, Flop c-bets, River vs big bets, Pot odds, Draws & equity, Preflop ranges, All-in decisions, Adaptation.

## Strategy source of truth (do not drift from this)
**Opening ranges (raise first in):**
- Button (3-handed **and** 4-handed are the same spot, with only the blinds left): ~50%. `BTN3` must equal `BTN4`.
- 4-handed cutoff: ~36%. It must be a subset of the button range.
- Small blind, folded to: ~43%, raise-or-fold, never limp, raise to 3x (6). Offsuit hands need high cards (K7o+, Q9o+, J9o+). Weak offsuit connectors (65o, 54o) fold.
- Heads-up button: ~83%. Sizes are 2.5x (5) except the SB, which uses 3x (6).

**Big blind defense:**
- vs a button 2.5x raise: ~57% (all suited, all pairs, A2o+, K5o+, Q8o+, J8o+, T8o+, 98o, 87o). Re-raise JJ+, AK, AQ.
- vs a cutoff raise: ~48%.
- Heads-up: ~66%. Re-raise 99+, AQ+.

**Limps:**
- Strong iso hands: 77+, AT+, any suited ace, KQ, KJ, suited broadway. Raise to 8-10 over one limper, 12-14 over two.
- On the button (in position) also isolate with two broadway cards. Limp behind with speculative hands (22-66, suited connectors and one-gappers). Fold the rest.
- Small blind vs a limp: raise strong hands. With speculative hands, fold or complete are both accepted.
- Big blind: check everything that isn't strong. Never fold when checking is free.

**Facing a 3-bet** (amateur 3-bet range is roughly QQ+, AK, AQ, JJ):
- 4-bet or call: QQ+, AK.
- Call: TT-JJ, AQ, AJs, KQs.
- Small pairs and suited connectors: call only if the cost is ≤ 1/10 of the stack.
- Fold the rest.

**Flop c-bet** (button vs a typical BB, pot 11):
- Board texture: **wet** = monotone, or connected (three cards within a 4-rank span), or two-tone with two cards within 3 ranks. A two-tone disconnected board is "fairly dry".
- Strong hands: big bet on wet boards, either size on dry boards.
- Top pair or overpair: small on dry, big on wet.
- Second pair, or a pocket pair between the top two cards: small on dry, check on wet.
- A pair below two board cards (for example 77 on K-J-6) and bottom pair: **always check**.
- Air: small c-bet on dry boards, check on wet boards.

**River vs big bets:**
- Solid player betting big on three streets: fold top pair. Call top two pair.
- With a set: raise, **except** call when a straight is possible against a solid player.
- A proven bluffer, or a small bet: call top pair.

**Pot odds:** need = call ÷ (pot + bet + call). Draw equity uses outs ×4 on the flop **only when the opponent is all-in**, and ×2 on the turn.

**Short-stack all-in** (6-12bb, shove or fold): cutoff ~21%, button ~38%, small blind or heads-up ~58%. The charts must nest.

**Calling a 100bb preflop shove:** compare simulated equity against the shover's range with the price (~49%). Tight player (QQ+, AK): call AA-KK only. Typical player (TT+, AQ+): QQ+ and AK. Maniac: lighter.

**Postflop all-in:** low SPR (about 1 or less): top pair calls. Deep SPR vs a solid player: two pair or better.

**Adaptation:** if they fold too much, bluff more. If they bluff too much, call more. If they call too much, value bet more and bluff less.

## Past mistakes (regression list, keep these fixed)
- The button was once 65% (3-handed) and 59% (4-handed) despite being the same spot. The cutoff was 46%.
- BB3 once defended K2o but folded JTo.
- 77 on K-J-6 was once a small bet. It must check.
- River "two pair" must be top two pair. A set with a straight possible vs a solid player is a call.
- The A♥5♥ flush-draw template once had a turn card that added a wheel gutshot. Outs are now verified by brute force in the tests.
- Short-stack shoves once used one range from every seat, up to 20bb.

## Conventions
- **Text:** plain, direct English, no fluff. Typographic apostrophes and quotes (’ “ ”) in visible text, straight quotes in code.
- **Ten:** card faces show **10**. Everywhere else (labels like KTo, charts, explanations) uses **T**.
- **Design:** mobile first. Palette: felt green (`--felt`), cream cards, gold accents (`--gold`). Every color is a CSS variable with light and dark values. The question and answers must fit on one phone screen without scrolling.
- **Accessibility:** keep tap targets at least 44px. Support keyboard input (1-3 to answer, Enter for next). Respect `prefers-reduced-motion`.
- **Answers:** when changing strategy, update the generator logic, the explanation text, this file, and the tests together.

## Owner preferences
- Direct, unvarnished advice. He pushes back on hedging.
- Wants to *understand* concepts, so explanations matter as much as answers.
- Prefers live poker over online. Studies Jonathan Little. GTO is a baseline, adjusted to exploit home-game players.

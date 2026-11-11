// Strategy + integrity checks for the drill. Run: node tests/verify.mjs
// No dependencies. Extracts the engine (everything before the State section) from index.html.
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const engine = script.slice(0, script.indexOf("/* ===================== State"));
const X = new Function(engine + "; return {G,CH,RSPEC,FMTS,inCh,hc,parse,flopInfo,best,DRAWS,SHOVE,EQ,equityVs,chartPct,seatsFor,openSeats,openKey,bbKey,pushKey,scene,isPrem,isEdge,rangeText,rangeGrid,strongVsLimp,specHand};")();
let fails = 0;
const seen = new Set();
const ok = (c, m) => { if (!c) { fails++; if (!seen.has(m)) { seen.add(m); console.log("FAIL:", m); } } };
const H = s => { const c = X.parse(s); return X.hc(c[0], c[1]); };
const hand = g => X.hc(g.hand[0], g.hand[1]);
const right = g => g.o.filter(o => o.ok).map(o => o.t);
const every = fn => { for (let a = 2; a <= 14; a++) for (let b = 2; b <= a; b++) for (const su of [true, false]) {
  if (a === b && su) continue; fn({ hi: a, lo: b, pair: a === b, suited: su && a !== b }); } };
const gen = (k, f, n, fn) => { let made = 0; for (let i = 0; i < n; i++) { const g = X.G[k].gen(f); if (g) { made++; fn(g); } } return made; };

// 1. Fuzz every generator at every table size (heads-up to 9-handed)
for (const k in X.G) for (const f of X.G[k].fmts || [null]) {
  const n = X.G[k].fmts ? 300 : 1500;
  const made = gen(k, f, n, g => {
    const txt = g.e + (g.act || "") + g.q + (g.rkey ? X.rangeText(g.rkey) + X.rangeGrid(g.rkey, g.rhl) : "") + g.o.map(o => o.t).join();
    ok(g.o.some(o => o.ok), `${k}: no correct option`);
    ok(g.o.length >= 2, `${k}: fewer than two options`);
    ok(!/undefined|NaN|\[object/.test(txt), `${k}: broken text`);
    ok(new Set(g.o.map(o => o.t)).size === g.o.length, `${k}: duplicate options`);
    const cards = [...(g.board || []), ...(g.hand || []), ...(g.opp || [])].map(c => c.v + "_" + c.s);
    ok(new Set(cards).size === cards.length, `${k}: duplicate cards`);
    ok(!g.rkey || X.RSPEC[g.rkey], `${k}: unknown range key ${g.rkey}`);
    if (g.f) {
      const seats = X.seatsFor(g.f);
      ok(g.f === f, `${k}: spot made for the wrong table size`);
      ok(seats.length === +g.f, `${k}: wrong number of seats`);
      ok(!g.you || seats.includes(g.you), `${k}: hero seat ${g.you} missing at ${g.f}-handed`);
      ok((g.out || []).every(s => seats.includes(s) && s !== g.you), `${k}: bad folded seats`);
      ok(Object.keys(g.sub || {}).every(s => seats.includes(s) && !(g.out || []).includes(s)), `${k}: bad seat labels`);
    }
  });
  ok(made >= n * .3, `${k} (${f}): generator fails too often`);
}

// 2. Range shape rules (see CLAUDE.md "Strategy source of truth")
const PCT = { UTG: 12, UTG1: 13, MP: 16, LJ: 19, HJ: 26, CO: 35, BTN: 50, SB: 43, BTNHU: 83, BBvBTN: 57, BBvCO: 48, BBvMID: 36, BBvEP: 25, BBHU: 66,
  PUSHHU: 58, PUSHBTN: 38, PUSHCO: 21, PUSHMID: 15, PUSHEP: 11 };
for (const k in PCT) ok(X.chartPct(X.CH[k]) === PCT[k], `${k} should be ${PCT[k]}%, is ${X.chartPct(X.CH[k])}%`);
const nest = (name, keys) => every(h => { for (let i = 0; i + 1 < keys.length; i++)
  ok(!X.inCh(X.CH[keys[i]], h) || X.inCh(X.CH[keys[i + 1]], h), `${name}: ${keys[i]} must be inside ${keys[i + 1]}`); });
nest("opens", ["UTG", "UTG1", "MP", "LJ", "HJ", "CO", "BTN"]);
nest("big blind", ["BBvEP", "BBvMID", "BBvCO", "BBvBTN"]);
nest("shoves", ["PUSHEP", "PUSHMID", "PUSHCO", "PUSHBTN", "PUSHHU"]);
nest("facing a raise", ["CCSBE", "CCE", "CCL"]);
nest("facing a raise in the small blind", ["CCSBE", "CCSBL", "CCL"]);
// One chart per seat: the button (and every other seat) plays the same range at every table size
for (const f of X.FMTS.slice(1)) for (const s of X.seatsFor(f).slice(0, -1)) ok(X.openKey(f, s) === s, "a seat must use the same chart at every table size");
ok(!X.inCh(X.CH.BBvBTN, H("K♠ 2♦")) && X.inCh(X.CH.BBvBTN, H("J♠ T♦")), "BB vs button folds K2o, defends JTo");
ok(!X.inCh(X.CH.SB, H("6♠ 5♦")) && X.inCh(X.CH.SB, H("K♠ 7♦")), "SB folds 65o, opens K7o");
ok(X.seatsFor("2").join() === "BTN,BB" && X.seatsFor("3").join() === "BTN,SB,BB" && X.seatsFor("6").join() === "LJ,HJ,CO,BTN,SB,BB" && X.seatsFor("9")[0] === "UTG", "seat names by table size");
ok(X.scene("4", "SB", {}).text === "Cutoff and button fold." && X.scene("3", "BTN", {}).text === "You are first to act." && X.scene("9", "SB", {}).text === "Everyone folds to you.", "fold narration");
ok(X.scene("9", "BB", { MP: "r" }).text === "UTG and UTG+1 fold. MP raises to 5. The next five players fold.", "raise narration");

// 3. Preflop decisions follow the charts at every table size
for (const f of X.FMTS) {
  gen("Preflop opens", f, 400, g => {
    const inR = X.inCh(X.CH[X.openKey(f, g.you)], hand(g)), r = right(g);
    ok(r.length === 1 && (inR ? /^Raise to/.test(r[0]) : r[0] === "Fold"), "open: answer must follow the seat chart (never limp)");
    ok(g.you !== "BB" && (g.you === "SB") === (r[0] === "Raise to 6" || (!inR && g.o.some(o => o.t === "Raise to 6"))), "open: SB raises to 6, others to 5");
  });
  gen("Big blind defense", f, 400, g => {
    const sp = X.RSPEC[g.rkey], h = hand(g), prem = X.isPrem(sp.prem, h), inR = X.inCh(X.CH[sp.ch], h), r = right(g).join();
    ok(prem ? /^Re-raise/.test(r) : inR ? /^Call/.test(r) : r === "Fold", "BB defense: answer must follow the chart");
  });
  if (f !== "2") gen("Facing a raise", f, 400, g => {
    const sp = X.RSPEC[g.rkey], h = hand(g), prem = X.isPrem(sp.prem, h), inR = X.inCh(X.CH[sp.ch], h), r = right(g).join();
    ok(g.you !== "BB" && Object.values(g.sub).join() === "Raise", "facing a raise: one raiser, hero not in the big blind");
    ok(prem ? /^Re-raise/.test(r) : inR ? /^Call/.test(r) : r === "Fold", "facing a raise: answer must follow the chart");
    if (!h.pair && !h.suited && !(h.hi === 14 && h.lo >= 11) && !(h.hi === 13 && h.lo === 12)) ok(r === "Fold", "facing a raise: weak offsuit hands (A9o, KTo, QJo) fold");
    if (!h.suited && ((h.hi === 14 && h.lo === 11) || (h.hi === 13 && h.lo === 12))) ok(r === (sp.prem === "late" ? "Call" + r.slice(4) : "Fold"), "facing a raise: AJo and KQo call a cutoff or button raise, fold to an earlier one");
    if (g.you === "SB" && h.suited && h.lo < 10) ok(r === "Fold", "facing a raise: SB folds speculative suited hands");
  });
  gen("Facing limps", f, 400, g => {
    const h = hand(g), r = right(g), st = X.strongVsLimp(h);
    if (g.you === "BB") ok(!r.includes("Fold") && (st ? /^Raise/.test(r[0]) : r[0] === "Check"), "limps: BB raises strong hands, checks the rest, never folds");
    else if (st) ok(r.length === 1 && /^Raise/.test(r[0]), "limps: strong hands raise");
    else if (g.you === "SB") ok(r.includes("Fold") && r.includes("Call 1 more") === X.specHand(h), "limps: SB folds or completes speculative hands");
    ok(/12-14/.test(g.o[0].t) === (Object.keys(g.sub).length === 2), "limps: raise to 12-14 over two limpers, 8-10 over one");
  });
}

// 4. Flop c-bet rules, heads-up and against two callers
for (const f of ["2", "3", "6", "9"]) gen("Flop c-bets", f, 1500, g => {
  const fi = X.flopInfo(g.hand, g.board);
  const c = g.o.filter(o => o.ok).map(o => o.t.includes("1/3") ? "S" : o.t.includes("3/4") ? "B" : "C").sort().join("");
  ok(!(g.mw && f === "2"), "no multiway pots heads-up");
  if (fi.cat === "strong") ok(fi.wet ? c === "B" : c === "BS", "strong: big on wet, either size on dry");
  if (fi.cat === "top") ok(c === (fi.wet ? "B" : "S"), "top pair: small on dry, big on wet");
  if (fi.cat === "medium" && !fi.mid2) ok(c === "C", "pair below two board cards must check");
  if (fi.cat === "medium" && fi.mid2) ok(c === (fi.wet || g.mw ? "C" : "S"), "second pair: small on dry heads-up, check on wet or multiway");
  if (fi.cat === "nothing") ok(c === (fi.wet || g.mw ? "C" : "S"), "air: small on dry heads-up, check on wet or multiway");
});

// 5. Draw templates: brute-force outs on flop and turn, all suit permutations
for (const d of X.DRAWS) for (const turn of [false, true]) for (const pm of [[0,1,2,3],[1,0,3,2],[2,3,0,1],[3,2,1,0]]) {
  const hole = X.parse(d.h, pm), board = X.parse(d.f, pm).concat(turn ? X.parse(d.t, pm) : []);
  const used = new Set(hole.concat(board).map(c => c.v + "_" + c.s)); let outs = 0;
  for (let v = 2; v <= 14; v++) for (let s = 0; s < 4; s++) {
    if (used.has(v + "_" + s)) continue; const sc = X.best(hole.concat(board, [{ v, s }]));
    if (d.o === 6 ? (sc[0] === 1 && sc[1] >= 13) : sc[0] >= 4) outs++;
  }
  ok(outs === d.o, `outs ${d.h} | ${d.f}${turn ? " " + d.t : ""}: expected ${d.o}, got ${outs}`);
}
gen("Draws & equity", null, 2000, g => ok(/all-in/.test(g.act) ? g.o.length === 2 : g.o.length === 3, "draws: nobody can raise an all-in"));

// 6. River rules
gen("River vs big bets", null, 4000, g => {
  const c = right(g).map(t => t.split(" ")[0]).join();
  if (g.kind === "top") ok(c === (g.vil === "solid" ? "Fold" : "Call"), "top pair: fold to a solid three-street bettor, call a bluffer or a small bet");
  if (g.kind === "two") ok(c === (g.vil === "solid" ? "Call" : "Call,Raise"), "top two pair: call a solid player, call or raise the others");
  if (g.kind === "set") ok(c === (g.sp && g.vil === "solid" ? "Call" : g.sp ? "Call,Raise" : "Raise"), "set: raise, but only call a solid player when a straight is possible");
});

// 7. Pot odds and bluff math use the exact formulas
gen("Pot odds", null, 3000, g => {
  const want = g.kind === "bluff" ? g.bet / (g.P + g.bet) : g.bet / (g.P + 2 * g.bet);
  ok(Number.isInteger(g.bet) && right(g).join() === Math.round(want * 100) + "%", `pot odds (${g.kind}): wrong price`);
});

// 8. All-in rules
for (const f of ["2", "4", "9"]) gen("All-in decisions", f, 600, g => {
  const r = right(g).join();
  if (g.rkey) ok(g.rkey === X.pushKey(f, g.you) && /^All-in/.test(r) === X.inCh(X.CH[g.rkey], hand(g)), "short stack: shove follows the seat chart");
  if (g.cat === "strong") ok(/^Call/.test(r), "postflop all-in: two pair or better always calls");
  if (g.cat === "top") ok(/^Call/.test(r) === (!g.deep || g.vil === "maniac"), "postflop all-in: top pair folds only deep against a solid player");
  if (g.cat === "medium") ok(/^Call/.test(r) === (!g.deep && g.vil === "maniac"), "postflop all-in: a weak pair calls only a maniac at low SPR");
});
// Calling a 100bb shove: the stored equity table must match a fresh simulation, and give the documented answers
const R = "23456789TJQKA";
for (const who in X.EQ) for (const lab in X.EQ[who]) {
  const hole = [{ v: R.indexOf(lab[0]) + 2, s: 0 }, { v: R.indexOf(lab[1]) + 2, s: lab[2] === "s" ? 0 : 1 }];
  const sim = X.equityVs(hole, X.SHOVE[who].combos, [], 2500);
  ok(Math.abs(sim - X.EQ[who][lab]) < 3.5, `equity table: ${lab} vs ${who} is ${X.EQ[who][lab]}, simulation says ${sim.toFixed(1)}`);
}
const E = X.EQ;
ok(E.tight.KK > 53 && E.tight.AA > 53 && E.tight.QQ < 45 && E.tight.AKs < 45 && E.tight.AKo < 45, "vs a tight shove: call KK+, fold QQ and AK");
ok(E.std.QQ > 53 && E.std.TT < 45 && E.std.AQs < 45, "vs a typical shove: call QQ+, fold TT and AQ");
for (const f of ["2", "5", "9"]) gen("All-in decisions", f, 400, g => {
  if (g.who) ok(/^Call/.test(right(g).join()) === (E[g.who][g.label] > 49), "calling a shove: answer must follow the equity table");
});

console.log(fails ? `${fails} failure(s)` : "All checks passed");
process.exit(fails ? 1 : 0);

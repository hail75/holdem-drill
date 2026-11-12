// Strategy + integrity checks for the drill. Run: node tests/verify.mjs
// No dependencies. Extracts the engine (everything before the State section) from index.html.
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const engine = script.slice(0, script.indexOf("/* ===================== State"));
const X = new Function(engine + "; return {G,CH,RSPEC,FMTS,inCh,hc,parse,flopInfo,best,DRAWS,SHOVE,EQ,equityVs,chartPct,strNames,skillOf,variant,learnGroups,learnAll,keySizes,learnNote,drillSpot,RAISE_GUIDE,LESSONS,UNITS,lessonSizes,lessonSpot,seatsFor,openSeats,openKey,bbKey,pushKey,scene,isPrem,isEdge,rangeText,rangeGrid,strongVsLimp,specHand};")();
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
  const rz = g.o.find(o => /^Raise/.test(o.t));
  ok(rz && /^Raise (to \d+|all-in \(\d+\))$/.test(rz.t), "river: the raise option must say how much");
  if (rz && rz.ok) ok(/times their bet|all-in for your last/.test(g.e), "river: a correct raise must explain its size");
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

// 9. Reviews: every skill can be asked again with new cards, quickly
for (const k in X.G) for (const f of X.G[k].fmts || [null]) {
  let found = 0, tries = 0;
  for (let i = 0; i < 25; i++) {
    const g = X.G[k].gen(f); if (!g) continue; g.topic = k; tries++;
    const t0 = Date.now(), v = X.variant(k, f, X.skillOf(g)), ms = Date.now() - t0;
    if (v) { found++; ok(X.skillOf(v) === X.skillOf(g), `${k}: variant has a different skill`); }
    ok(ms < 400, `${k} (${f}): finding a variant took ${ms} ms`);
  }
  ok(found >= tries * .95, `${k} (${f}): only ${found} of ${tries} skills could be asked again`);
}

// 11. Learn ranges: every chart listed for a table size exists there and can be drilled
for (const f of X.FMTS) for (const gr of X.learnGroups(f)) for (const k of gr.keys) {
  ok(X.RSPEC[k] && !/undefined|NaN/.test(X.learnNote(k) + X.rangeText(k)), `learn: ${k} at ${f}-handed has broken text`);
  const g = X.drillSpot(k, f);
  ok(g && g.rkey === k, `learn: cannot drill ${k} at ${f}-handed`);
  if (g && g.f) ok(g.f === f, `learn: drill for ${k} dealt the wrong table size`);
}
{ const listed = X.learnAll().flatMap(g => g.keys), used = new Set(X.FMTS.flatMap(f => X.learnGroups(f).flatMap(g => g.keys)));
  ok(listed.length === new Set(listed).size && listed.length === used.size && listed.every(k => used.has(k)), "learn: the cheat sheet lists every chart exactly once");
  for (const k of listed) { const fs = X.keySizes(k); ok(fs.length && X.drillSpot(k, fs[0]), `learn: ${k} can be drilled at ${fs[0]}`); } }
ok(X.learnGroups("4")[0].keys.join() === "CO,BTN,SB" && X.learnGroups("2")[0].keys.join() === "BTNHU", "learn: opening charts per table size");

// 12. River explanations name the straight: every listed straight is real, and none is missed
const P2 = s => X.parse(s);
ok(X.strNames(P2("8♥ 3♣ T♦ A♦ 4♠")) === "52 makes A-2-3-4-5", "straight names: the wheel on 8-3-T-A-4");
ok(X.strNames(P2("9♥ 8♣ 7♦ 2♦ 2♠")).startsWith("JT makes 7-8-9-T-J"), "straight names: highest first");
gen("River vs big bets", null, 600, g => {
  if (!g.sp) return;
  const used = new Set(g.board.map(c => c.v + "_" + c.s));
  const free = v => [0, 1, 2, 3].filter(s => !used.has(v + "_" + s));
  let any = false;
  for (let a = 2; a <= 14 && !any; a++) for (let b = 2; b <= a && !any; b++) {
    const sa = free(a), sb = free(b).filter(s => a !== b || s !== sa[0]);
    if (sa.length && sb.length && X.best(g.board.concat([{ v: a, s: sa[0] }, { v: b, s: sb[0] }]))[0] >= 4) any = true;
  }
  ok(any, "river: a board flagged as having a straight must have one");
  if (/straight/.test(g.e)) ok(/makes/.test(g.e), "river: an explanation that mentions a straight must name it");
});

// 13. Raising guide: every card drills a real topic and has rows and a reason
for (const x of X.RAISE_GUIDE) ok(X.G[x.drill] && x.rows.length >= 2 && x.rows.every(r => r.length === 2 && r[0] && r[1]) && x.why.length > 60, `raising guide: "${x.t}" is incomplete`);
// ...and its numbers match what the generators grade
const gtxt = JSON.stringify(X.RAISE_GUIDE);
gen("Preflop opens", "4", 200, g => ok(g.o.some(o => o.t === (g.you === "SB" ? "Raise to 6" : "Raise to 5")) && /Raise to 5 \(2\.5/.test(gtxt) && /Raise to 6 \(3/.test(gtxt), "raising guide: opening sizes"));
gen("Facing a raise", "6", 200, g => ok(g.o[0].t === (g.you === "SB" ? "Re-raise to 18" : "Re-raise to 15") && /Re-raise to 15/.test(gtxt) && /Re-raise to 18/.test(gtxt), "raising guide: re-raise sizes"));
gen("Big blind defense", "4", 200, g => { if (Object.keys(g.sub)[0] !== "SB") ok(g.o[0].t === "Re-raise to 16" && /Re-raise to 16/.test(gtxt), "raising guide: big blind re-raise size"); });
for (const [k, pct] of [["PUSHEP", 11], ["PUSHMID", 15], ["PUSHCO", 21], ["PUSHBTN", 38], ["PUSHHU", 58]]) ok(X.chartPct(X.CH[k]) === pct && gtxt.includes("About " + pct + "%"), `raising guide: shove share for ${k}`);

// 14. Lessons: every lesson has pages, and its quiz can deal enough matching spots at every table size it allows
ok(new Set(X.LESSONS.map(L => L.id)).size === X.LESSONS.length && X.LESSONS.every(L => X.UNITS[L.unit]), "lessons: ids are unique and every lesson has a unit");
for (const L of X.LESSONS) {
  ok(L.pages.length >= 2 && L.pages.every(pg => pg.h && pg.p && (!pg.chart || X.RSPEC[pg.chart])), `lesson ${L.id}: every page needs a heading and text`);
  for (const pg of L.pages) { const rows = typeof pg.rows === "function" ? pg.rows() : pg.rows || [];
    ok(rows.every(r => r.length === 2 && r[0] && r[1] && !/undefined|NaN/.test(r.join())), `lesson ${L.id}: broken table on "${pg.h}"`);
    if (typeof pg.rows === "function") ok(rows.length >= 2, `lesson ${L.id}: empty table on "${pg.h}"`); }
  ok(X.G[L.quiz.topic] && L.quiz.pass <= L.quiz.n && L.quiz.pass >= L.quiz.n / 2, `lesson ${L.id}: bad quiz settings`);
  const sizes = X.lessonSizes(L, X.FMTS);
  ok(sizes.length > 0 && (!L.quiz.need3 || !sizes.includes("2")), `lesson ${L.id}: no table size for its quiz`);
  for (const f of sizes) for (let i = 0; i < 4; i++) {
    const t0 = Date.now(), g = X.lessonSpot(L, f);
    ok(g && (!L.quiz.test || L.quiz.test(g)) && g.topic === L.quiz.topic, `lesson ${L.id}: no quiz spot at ${f}`);
    ok(Date.now() - t0 < 500, `lesson ${L.id}: quiz spot at ${f} is slow`);
  }
}

// 10. The version shown in the app must match the service worker cache
const swv = readFileSync(new URL("../sw.js", import.meta.url), "utf8").match(/holdem-drill-(\d+\.\d+\.\d+)"/);
const appv = html.match(/var BUILD=\{v:"(\d+\.\d+\.\d+)",at:"(\d{4}-\d\d-\d\dT\d\d:\d\dZ)"/);
ok(swv && appv && swv[1] === appv[1], `version in index.html (${appv && appv[1]}) must match the cache name in sw.js (${swv && swv[1]})`);

console.log(fails ? `${fails} failure(s)` : "All checks passed");
process.exit(fails ? 1 : 0);

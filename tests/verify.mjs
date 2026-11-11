// Strategy + integrity checks for the drill. Run: node tests/verify.mjs
// No dependencies. Extracts the engine (everything before the State section) from index.html.
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const engine = script.slice(0, script.indexOf("/* ===================== State"));
const X = new Function(engine + "; return {G,CH,inCh,hc,parse,flopInfo,best,DRAWS,RSPEC,SHOVE,equityVs,chartPct};")();
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL:", m); } };
const H = s => { const c = X.parse(s); return X.hc(c[0], c[1]); };

// 1. Fuzz every generator in every table size
for (const k in X.G) for (const f of X.G[k].fmts || [null]) {
  const n = k === "All-in decisions" ? 60 : 800;
  for (let i = 0; i < n; i++) {
    const g = X.G[k].gen(f); if (!g) continue;
    const txt = g.e + (g.act || "") + g.q + (g.rtext || "") + g.o.map(o => o.t).join();
    ok(g.o.some(o => o.ok), `${k}: no correct option`);
    ok(!/undefined|NaN/.test(txt), `${k}: broken text`);
    ok(new Set(g.o.map(o => o.t)).size === g.o.length, `${k}: duplicate options`);
    const cards = [...(g.board||[]), ...(g.hand||[]), ...(g.opp||[])].map(c => c.v + "_" + c.s);
    ok(new Set(cards).size === cards.length, `${k}: duplicate cards`);
  }
}
// 2. Range shape rules (see CLAUDE.md "Strategy source of truth")
ok(JSON.stringify(X.CH.BTN3) .replace(/"where":"[^"]*"/,"") === JSON.stringify(X.CH.BTN4).replace(/"where":"[^"]*"/,""), "BTN3 must equal BTN4");
ok(!X.inCh(X.CH.BB3, H("K♠ 2♦")) && X.inCh(X.CH.BB3, H("J♠ T♦")), "BB3 folds K2o, defends JTo");
ok(!X.inCh(X.CH.SB3, H("6♠ 5♦")) && X.inCh(X.CH.SB3, H("K♠ 7♦")), "SB folds 65o, opens K7o");
for (let a = 2; a <= 14; a++) for (let b = 2; b <= a; b++) for (const su of [true, false]) {
  if (a === b && su) continue; const h = { hi: a, lo: b, pair: a === b, suited: su && a !== b };
  ok(!X.inCh(X.CH.CO4, h) || X.inCh(X.CH.BTN4, h), "CO range must be inside BTN range");
  ok(!X.inCh(X.CH.PUSHCO, h) || X.inCh(X.CH.PUSHBTN, h), "push CO inside push BTN");
  ok(!X.inCh(X.CH.PUSHBTN, h) || X.inCh(X.CH.PUSHHU, h), "push BTN inside push HU");
}
// 3. Flop c-bet rules
for (let i = 0; i < 3000; i++) {
  const g = X.G["Flop c-bets"].gen("3"), fi = X.flopInfo(g.hand, g.board);
  const c = g.o.filter(o => o.ok).map(o => o.t.includes("1/3") ? "S" : o.t.includes("3/4") ? "B" : "C").sort().join("");
  if (fi.cat === "medium" && !fi.mid2) ok(c === "C", "pair below two board cards must check");
  if (fi.cat === "strong") ok(fi.wet ? c === "B" : c === "BS", "strong: big on wet, either size on dry");
  if (fi.cat === "nothing" && fi.wet) ok(c === "C", "air on wet board must check");
}
// 4. Draw templates: brute-force outs on flop and turn, all suit permutations
for (const d of X.DRAWS) for (const turn of [false, true]) for (const pm of [[0,1,2,3],[1,0,3,2],[2,3,0,1],[3,2,1,0]]) {
  const hole = X.parse(d.h, pm), board = X.parse(d.f, pm).concat(turn ? X.parse(d.t, pm) : []);
  const used = new Set(hole.concat(board).map(c => c.v + "_" + c.s)); let outs = 0;
  for (let v = 2; v <= 14; v++) for (let s = 0; s < 4; s++) {
    if (used.has(v + "_" + s)) continue; const sc = X.best(hole.concat(board, [{ v, s }]));
    if (d.o === 6 ? (sc[0] === 1 && sc[1] >= 13) : sc[0] >= 4) outs++;
  }
  ok(outs === d.o, `outs ${d.h} | ${d.f}${turn ? " " + d.t : ""}: expected ${d.o}, got ${outs}`);
}
// 5. River rules
for (let i = 0; i < 2000; i++) {
  const g = X.G["River vs big bets"].gen("3"), c = g.o.filter(o => o.ok).map(o => o.t.split(" ")[0]).join();
  if (g.q.includes("top pair") && /solid/.test(g.act)) ok(c === "Fold", "top pair vs solid three-street bettor = fold");
  if (g.q.includes("a set") && /solid/.test(g.act) && /straight is possible/.test(g.e)) ok(c === "Call", "set vs solid with straight possible = call");
}
console.log(fails ? `${fails} failure(s)` : "All checks passed");
process.exit(fails ? 1 : 0);

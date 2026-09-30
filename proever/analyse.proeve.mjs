// Prøver af analysemotoren: dekompositionerne skal gå præcist op, og
// sætningerne skal bygge på de tal, der står i tabellerne.

import { test } from "node:test";
import assert from "node:assert/strict";
import { EKSEMPEL } from "../src/analyse/eksempel.js";
import { regnCase } from "../src/analyse/beregning.js";
import { analyser } from "../src/analyse/analyse.js";
import { medAfledte, balanceKontrol } from "../src/analyse/poster.js";
import { fraDataset } from "../src/analyse/fraDataset.js";
import { emptyDataset } from "../src/lib/model.js";
import { beregnAlle, procentvisAendring } from "../src/lib/nogletal.js";
import { tjekTal } from "../src/analyse/tjek.js";

const naer = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);

test("balancen stemmer i eksemplet", () => {
  for (const k of EKSEMPEL.kolonner) {
    const b = balanceKontrol(medAfledte(k.v));
    naer(b.forskel, 0);
  }
});

test("AG = OG × AOH i hvert år", () => {
  for (const b of regnCase(EKSEMPEL)) naer(b.n[1], b.n[2] * b.n[3]);
});

test("hvert nøgletal og hver gruppe har trin 1-3", () => {
  const a = analyser(EKSEMPEL);
  for (const id of ["rentabilitet", "indtjeningsevne", "kapital", "soliditet"])
    for (const g of a.omraader[id].grupper) {
      assert.ok(g.trin1.length, `${g.id} trin 1`);
      assert.ok(g.trin2.length, `${g.id} trin 2`);
      assert.ok(g.trin3.length, `${g.id} trin 3`);
    }
  assert.ok(a.omraader.boers.ikkeRelevant);
  assert.ok(a.konklusion.udkast.length >= 2);
});

test("grupperne er dem, vi aftalte", () => {
  const a = analyser(EKSEMPEL);
  const nrs = id => Object.values(a.omraader).flatMap(o => o.grupper).find(g => g.id === id)?.nrs;
  assert.deepEqual(nrs("robusthed"), [10, 11, 12]);
  assert.deepEqual(nrs("anlaeg"), [13, 14, 15]);
  assert.deepEqual(nrs("arbejdskapital"), [16, 17, 18]);
  assert.deepEqual(nrs("likviditet"), [23, 24]);
  assert.deepEqual(nrs("ag"), [1]);
  assert.deepEqual(nrs("cf"), [19]);
});

test("en gruppes trin 1 nævner hvert af dens nøgletal", () => {
  const a = analyser(EKSEMPEL);
  const g = a.omraader.kapital.grupper.find(x => x.id === "arbejdskapital");
  const t = g.trin1.join(" ");
  for (const navn of ["Varelagerets", "Varedebitorernes", "Varekreditorernes"]) assert.match(t, new RegExp(navn));
});

test("hverken DuPont-figur eller EKF-formel i besvarelsen", () => {
  const a = analyser(EKSEMPEL);
  const alt = JSON.stringify(a.omraader);
  assert.doesNotMatch(alt, /EKF-formlen|afstemning|kædesubstitution|pct\.point står for/);
});

test("konklusionen ser pengestrømmen og kalder modellen presset", () => {
  const a = analyser(EKSEMPEL);
  assert.equal(a.konklusion.model, "presset");
  assert.ok(a.konklusion.svagheder.some(s => s.includes("pengestrømmen")));
  assert.ok(a.konklusion.anbefalinger.some(s => s.includes("bruttomarginen")), "BM faldt, KO-andelen gjorde ikke");
});

test("eksemplet rammer de faldgruber, det er bygget til", () => {
  const a = analyser(EKSEMPEL);
  const temaer = new Set(a.faldgruber.map(f => f.tema));
  assert.ok(temaer.has("sammenhaeng-ubrugt"), "AOH trækker også AG ned");
  assert.ok(a.faldgruber.every(f => f.gruppe), "hver faldgrube hører til et nøgletal eller en gruppe");
  assert.ok(temaer.has("kun-tal"), "vækst uden resultat");
  assert.ok(temaer.has("noegletal-misforstaaet"), "soliditet falder, EK vokser / r under markedsrenten");
});

test("ingen sætning indeholder undefined, NaN eller null", () => {
  const a = analyser(EKSEMPEL);
  const alt = JSON.stringify([a.omraader, a.konklusion, a.faldgruber]);
  assert.doesNotMatch(alt, /undefined|NaN|null %|Infinity/);
});

test("en tom case giver ingen fejl", () => {
  const tom = { navn: "", enhed: "t.kr.", kolonner: [0, 1, 2, 3].map(i => ({ aar: String(2020 + i), v: {} })) };
  const a = analyser(tom);
  assert.ok(Object.values(a.omraader).every(o => o.grupper.length === 0));
});

test("taltjekket finder tal, der ikke står i analysen", () => {
  const a = analyser(EKSEMPEL);
  const ok = a.omraader.rentabilitet.grupper[0].trin1[0];
  assert.deepEqual(tjekTal(ok, a), []);
  assert.deepEqual(tjekTal("Afkastningsgraden var 97,3 % i 2025.", a), ["97,3"]);
});

// Eksemplet som nøgletalsappens dataset: samme tal, som hvis de var indlæst
// og omformet dér. Tallene gemmes i grundenheden (kr.) og vises i 1.000 kr.
function somDataset() {
  const d = emptyDataset();
  const kr = v => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x * 1000]));
  const { leverandoergaeld, kortfristetGaeld, ...primo } = EKSEMPEL.kolonner[0].v;
  d.virksomhed = EKSEMPEL.navn;
  d.enhed = "1.000 kr.";
  d.grundenhed = "kr.";
  d.primo = kr({ ...primo, leverandoergaeld, andenKortfristetGaeld: kortfristetGaeld - leverandoergaeld });
  d.aar = EKSEMPEL.kolonner.slice(1).map(k => {
    const { leverandoergaeld: l, kortfristetGaeld: kg, omsaetningsaktiver, ...v } = k.v;
    return { label: k.aar, poster: {}, values: kr({ ...v, leverandoergaeld: l, andenKortfristetGaeld: kg - l, likvider: omsaetningsaktiver - v.varelager - v.varedebitorer }) };
  });
  d.analyse = { markedsrente: [null, null, 3.4], profil: "grossist", forretningsmodel: EKSEMPEL.forretningsmodel };
  return d;
}

test("analysen bruger nøgletalsappens egne nøgletal", () => {
  const d = somDataset();
  const { kase, noegletal } = fraDataset(d);
  const a = analyser(kase, noegletal);
  const deres = beregnAlle(d);
  for (let i = 0; i < 3; i++)
    for (const nr of [1, 2, 3, 4, 5, 6, 7, 12, 16, 17, 18, 19, 20, 22, 23, 24])
      naer(a.beregnet[i].n[nr], deres[i][nr].value, 1e-9);
  assert.equal(a.aar.join(), "2023,2024,2025");
  assert.equal(kase.kolonner[0].aar, "2022");
});

test("motorens egen regning stemmer med nøgletalsappens", () => {
  const d = somDataset();
  const deres = beregnAlle(d);
  const egne = regnCase(EKSEMPEL);
  for (let i = 0; i < 3; i++)
    for (const nr of [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 23, 24])
      naer(egne[i].n[nr], deres[i][nr].value, 1e-6);
});

test("OG og AOH står under rentabiliteten og undersøges nærmere i indtjeningsevnen og kapitaltilpasningen", () => {
  const a = analyser(EKSEMPEL);
  const ids = a.omraader.rentabilitet.grupper.map(g => g.id);
  assert.deepEqual(ids.slice(0, 3), ["ag", "og", "aoh"]);
  assert.ok(!a.omraader.indtjeningsevne.grupper.some(g => g.id === "og"));
  assert.ok(!a.omraader.kapital.grupper.some(g => g.id === "aoh"));
  assert.match(a.omraader.indtjeningsevne.indledning, /^Indtjeningsevnen undersøger nærmere overskudsgraden/);
  assert.match(a.omraader.kapital.indledning, /^Kapitaltilpasningen undersøger nærmere aktivernes omsætningshastighed/);
  assert.equal(a.omraader.rentabilitet.indledning, "");
  // Forklaringerne i områderne føres tilbage til OG og AOH.
  const tekst = id => a.omraader[id].grupper.flatMap(g => g.trin2).join(" ");
  assert.match(tekst("indtjeningsevne"), /trækker overskudsgraden (op|ned)/);
  assert.match(tekst("kapital"), /trækker aktivernes omsætningshastighed (op|ned)/);
});

test("konstateringen bruger nøgletalsappens ændringsprocent", () => {
  const d = somDataset();
  const { kase, noegletal } = fraDataset(d);
  const a = analyser(kase, noegletal);
  const deres = beregnAlle(d);
  const pct = procentvisAendring(deres, 2);
  const forventet = (pct > 0 ? "+" : "−") + new Intl.NumberFormat("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(pct)) + " %";
  const og = a.omraader.rentabilitet.grupper.find(g => g.id === "og");
  assert.ok(og.trin1[0].includes(`ændring 2023–2025: ${forventet}`), og.trin1[0]);
});

test("kun én delkonklusion pr. analyseområde", () => {
  const a = analyser(EKSEMPEL);
  for (const [id, o] of Object.entries(a.omraader)) {
    for (const g of o.grupper) assert.equal(g.delkonklusion, undefined, g.id);
    if (!o.ikkeRelevant) assert.ok(o.delkonklusion.length > 40, id);
  }
  assert.match(a.omraader.rentabilitet.delkonklusion, /forringet.*overskudsgraden.*markedsrenten/s);
  assert.match(a.omraader.indtjeningsevne.delkonklusion, /^Overskudsgraden er/);
  assert.match(a.omraader.kapital.delkonklusion, /^Aktivernes omsætningshastighed er/);
});

test("den samlede konklusion står, også uden forretningsmodel og profil", () => {
  const a = analyser({ ...EKSEMPEL, profil: "", forretningsmodel: "" });
  assert.equal(a.profil, null);
  assert.ok(a.konklusion.samlet.length >= 2);
  const t = a.konklusion.samlet.join(" ");
  assert.match(t, /^Samlet set er udviklingen i .* fra 2023 til 2025 (positiv|negativ|blandet|stabil)/);
  assert.match(t, /Overskudsgraden/);
  assert.match(t, /Soliditetsgraden/);
  assert.doesNotMatch(t, /forretningsmodellen/);
});

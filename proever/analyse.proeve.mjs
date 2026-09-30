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
import { beregnAlle } from "../src/lib/nogletal.js";
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

test("DuPont-dekompositionen går op", () => {
  const a = analyser(EKSEMPEL);
  for (const d of a.dupont) naer(d.ogEffekt + d.aohEffekt, d.dAG);
});

test("EKF-afstemningen går op til nøgletal 4", () => {
  const a = analyser(EKSEMPEL);
  a.beregnet.forEach((b, i) => {
    const e = a.ekf.afstemning[i];
    naer(e.formel + e.rest + e.skat, b.n[4]);
    naer(e.efterSkat, b.n[4]);
  });
});

test("ΔEKF fordeles præcist på AG, r, gearing, rest og skat", () => {
  const a = analyser(EKSEMPEL);
  for (const p of a.ekf.perioder) naer(p.agEffekt + p.rEffekt + p.gEffekt + p.restEffekt + p.skatEffekt, p.dEKF);
});

test("ΔOG = ΔBM − ΔKO-andel + Δrest", () => {
  const a = analyser(EKSEMPEL);
  for (const d of a.og) naer(d.dBM - d.dKO + d.dRest, d.dOG);
});

test("alle fem områder har trin 1-3, og trin 4 har et udkast", () => {
  const a = analyser(EKSEMPEL);
  for (const id of ["rentabilitet", "indtjeningsevne", "kapital", "soliditet"]) {
    const o = a.omraader[id];
    assert.ok(o.trin1.length, id + " trin 1");
    assert.ok(o.trin2.length, id + " trin 2");
    assert.ok(o.trin3.length, id + " trin 3");
  }
  assert.ok(a.omraader.boers.ikkeRelevant);
  assert.ok(a.konklusion.udkast.length >= 2);
  assert.ok(a.faldgruber.length >= 3);
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
  assert.equal(a.omraader.rentabilitet.trin2.length, 0);
});

test("taltjekket finder tal, der ikke står i analysen", () => {
  const a = analyser(EKSEMPEL);
  const ok = a.omraader.rentabilitet.trin1[0];
  assert.deepEqual(tjekTal(ok, a), []);
  assert.deepEqual(tjekTal("Afkastningsgraden var 17,3 % i 2025.", a), ["17,3"]);
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

test("dekompositionerne går også op på nøgletalsappens tal", () => {
  const { kase, noegletal } = fraDataset(somDataset());
  const a = analyser(kase, noegletal);
  for (const d of a.dupont) naer(d.ogEffekt + d.aohEffekt, d.dAG, 1e-9);
  a.beregnet.forEach((b, i) => naer(a.ekf.afstemning[i].efterSkat, b.n[4], 1e-9));
  for (const p of a.ekf.perioder) naer(p.agEffekt + p.rEffekt + p.gEffekt + p.restEffekt + p.skatEffekt, p.dEKF, 1e-9);
});

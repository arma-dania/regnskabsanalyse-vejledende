// Prøver af analysemotoren: dekompositionerne skal gå præcist op, og
// sætningerne skal bygge på de tal, der står i tabellerne.

import { test } from "node:test";
import assert from "node:assert/strict";
import { EKSEMPEL } from "../src/lib/eksempel.js";
import { regnCase } from "../src/lib/nogletal.js";
import { analyser } from "../src/lib/analyse.js";
import { laesTal, laesIndsat, medAfledte, balanceKontrol } from "../src/lib/poster.js";
import { tjekTal } from "../src/lib/tjek.js";

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

test("tal læses i dansk og engelsk format", () => {
  assert.equal(laesTal("1.234,5"), 1234.5);
  assert.equal(laesTal("1,234.5"), 1234.5);
  assert.equal(laesTal("12.345"), 12345);
  assert.equal(laesTal("(2.400)"), -2400);
  assert.equal(laesTal("−3,5"), -3.5);
  assert.equal(laesTal(""), null);
});

test("indsatte linjer genkendes på postens navn", () => {
  const { poster, ukendte } = laesIndsat("Nettoomsætning\t300.000\t324.000\nAnlægsaktiver i alt\t21.000\t22.200\nNoget andet\t5\t6", 4);
  assert.deepEqual(poster.omsaetning, [300000, 324000]);
  assert.deepEqual(poster.anlaegsaktiver, [21000, 22200]);
  assert.deepEqual(ukendte, ["Noget andet"]);
});

test("taltjekket finder tal, der ikke står i analysen", () => {
  const a = analyser(EKSEMPEL);
  const ok = a.omraader.rentabilitet.trin1[0];
  assert.deepEqual(tjekTal(ok, a), []);
  assert.deepEqual(tjekTal("Afkastningsgraden var 17,3 % i 2025.", a), ["17,3"]);
});

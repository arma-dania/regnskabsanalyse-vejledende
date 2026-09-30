// Prøver af, at alle år står i samme enhed, og at udbytte i noterne findes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { kontrollerEnheder, tilKroner, gaetEnhed } from "../src/lib/enheder.js";
import { udbytteFraRaekker, udbytteFraLinjer } from "../src/lib/beretning.js";
import { fordelKolonner } from "../src/lib/fordeling.js";

const xbrl = { kilde: "2025.xhtml", enhed: "kr.", poster: [{ id: "aktiver:Assets", label: "Aktiver" }, { id: "resultat:Revenue", label: "Nettoomsætning" }],
  kolonner: [{ navn: "2025", values: { "aktiver:Assets": 127_200_000, "resultat:Revenue": 340_000_000 } }, { navn: "2024", values: { "aktiver:Assets": 112_200_000, "resultat:Revenue": 324_000_000 } }] };
const pdf = (enhed, faktor) => ({ kilde: "2024.pdf", enhed, poster: [{ id: "pdf:aktiver:aktiver i alt", label: "Aktiver i alt" }],
  kolonner: [{ navn: "2024", values: { "pdf:aktiver:aktiver i alt": 112_200 * faktor } }, { navn: "2023", values: { "pdf:aktiver:aktiver i alt": 101_000 * faktor } }],
  udbytte: { 2024: { foreslaaet: 3_000 * faktor } } });

test("alle regnskaber regnes om til kroner", () => {
  const d = tilKroner(pdf("1.000 kr.", 1));
  assert.equal(d.enhed, "kr.");
  assert.equal(d.oprindeligEnhed, "1.000 kr.");
  assert.equal(d.kolonner[0].values["pdf:aktiver:aktiver i alt"], 112_200_000);
  assert.equal(d.udbytte["2024"].foreslaaet, 3_000_000);
});

test("en PDF med forkert gættet enhed rettes til XBRL-regnskabet", () => {
  // PDF'en står reelt i t.kr., men enheden blev gættet til mio. kr.
  const { docs, beskeder } = kontrollerEnheder([xbrl, pdf("mio. kr.", 1)]);
  assert.equal(docs[1].kolonner[0].values["pdf:aktiver:aktiver i alt"], 112_200_000);
  assert.equal(docs[0].kolonner[0].values["aktiver:Assets"], 127_200_000, "XBRL rettes ikke");
  assert.equal(docs[1].udbytte["2024"].foreslaaet, 3_000_000, "udbyttet følger med");
  assert.ok(beskeder.some(b => /faktor 1\.000/.test(b.tekst)));
});

test("regnskaber i samme enhed røres ikke", () => {
  const { docs, beskeder } = kontrollerEnheder([xbrl, pdf("1.000 kr.", 1)]);
  assert.equal(docs[1].kolonner[0].values["pdf:aktiver:aktiver i alt"], 112_200_000);
  assert.equal(beskeder.length, 0);
});

test("fordelingen af årene får samme enhed i alle år", () => {
  const { docs } = kontrollerEnheder([xbrl, pdf("mio. kr.", 1)]);
  const f = fordelKolonner(docs);
  assert.ok(f);
});

test("enheden i en PDF afgøres af overskriften, ikke af en enkelt omtale i beretningen", () => {
  assert.equal(gaetEnhed("Bestyrelsen foreslår et udbytte på 80 mio. kr.\nResultatopgørelse\nBeløb i t.kr.\nt.kr. 2025 2024"), "1.000 kr.");
  assert.equal(gaetEnhed("Alle beløb i mio. kr."), "mio. kr.");
  assert.equal(gaetEnhed("Nettoomsætning 300.000"), "kr.");
});

test("udbytte i noterne findes ud fra rækkens navn", () => {
  const ud = udbytteFraRaekker([
    { label: "Foreslået udbytte for regnskabsåret", dato: "2025-12-31", vaerdi: 80_000_000 },
    { label: "Udloddet udbytte", dato: "2025-12-31", vaerdi: -60_000_000 },
    { label: "Udbytte fra dattervirksomheder", dato: "2025-12-31", vaerdi: 5 },
    { label: "Udbytte pr. aktie", dato: "2025-12-31", vaerdi: 8 },
  ]);
  assert.deepEqual(ud, { 2025: { foreslaaet: 80_000_000, betalt: 60_000_000 } });
});

test("\"Udbytte\" alene i resultatdisponeringen bruges, når intet mere præcist findes", () => {
  const laes = t => { const n = Number(t.replace(/[()-]/g, "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
  const ud = udbytteFraLinjer(["Resultatdisponering", "Udbytte 80.000 60.000", "Overført resultat 1.000 2.000"], ["2025", "2024"], laes);
  assert.equal(ud["2025"].foreslaaet, 80_000);
  const præcis = udbytteFraRaekker([{ label: "Udbytte", dato: "2025-12-31", vaerdi: 1 }, { label: "Foreslået udbytte", dato: "2025-12-31", vaerdi: 80 }]);
  assert.equal(præcis["2025"].foreslaaet, 80);
});

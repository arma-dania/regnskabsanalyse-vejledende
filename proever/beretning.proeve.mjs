// Prøver af ledelsesberetningen og udbyttet: at de findes ved indlæsningen,
// og at de faktisk bruges i analysen.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMParser } from "linkedom";
import { udtraekBeretning, udbytteFraFakta, udbytteFraLinjer } from "../src/lib/beretning.js";
import { parseXbrlDokument } from "../src/lib/ixbrlImport.js";
import { fraDataset, fraFund } from "../src/analyse/fraDataset.js";
import { analyser } from "../src/analyse/analyse.js";
import { emptyDataset } from "../src/lib/model.js";
import { EKSEMPEL } from "../src/analyse/eksempel.js";
import { tjekTal } from "../src/analyse/tjek.js";

test("beretningen findes under overskriften – ikke i indholdsfortegnelsen", () => {
  const linjer = [
    "Indhold", "Ledelsesberetning 5", "Resultatopgørelse 9",
    "Ledelsesberetning",
    "Selskabets hovedaktivitet er engroshandel.",
    "Omsætningen steg 5 % som følge af et bredere sortiment.",
    "Resultatopgørelse", "Nettoomsætning 340.000",
  ];
  const t = udtraekBeretning(linjer);
  assert.match(t, /engroshandel/);
  assert.match(t, /bredere sortiment/);
  assert.doesNotMatch(t, /Nettoomsætning/);
});

test("udbytte fra XBRL-fakta: foreslået og betalt, uden udbytte pr. aktie", () => {
  const ud = udbytteFraFakta([
    { begreb: "ProposedDividendRecognisedInEquity", dato: "2025-12-31", vaerdi: 80000000 },
    { begreb: "DividendsPaid", dato: "2025-12-31", vaerdi: -60000000 },
    { begreb: "DividendsProposedPerShare", dato: "2025-12-31", vaerdi: 8 },
    { begreb: "IncomeFromDividends", dato: "2025-12-31", vaerdi: 5 },
  ]);
  assert.deepEqual(ud, { 2025: { foreslaaet: 80000000, betalt: 60000000 } });
});

test("udbytte med IFRS-begreberne", () => {
  const ud = udbytteFraFakta([
    { begreb: "DividendsProposedOrDeclaredBeforeFinancialStatementsAuthorisedForIssueButNotRecognisedAsDistributionToOwners", dato: "2025-12-31", vaerdi: 80e6 },
    { begreb: "DividendsRecognisedAsDistributionsToOwnersOfParent", dato: "2025-12-31", vaerdi: 70e6 },
  ]);
  assert.deepEqual(ud, { 2025: { foreslaaet: 80e6, betalt: 70e6 } });
});

// pdfImport.js kan ikke indlæses i Node (den bruger Vites worker-import),
// så tallene læses her med samme danske format.
const parseDanskTal = t => {
  const neg = /^\(|^-/.test(t);
  const n = Number(t.replace(/[()-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
};

test("ekstraordinært udbytte som hos Gasa: foreslået for 2024, betalt i 2025", () => {
  // 2025-rapporten: besluttet efter 2024's udgang (= foreslået for 2024), betalt
  // i 2025, og en fejlmærket saldo "foreslået … i egenkapitalen" pr. 31.12.2025.
  const ud = udbytteFraFakta([
    { begreb: "ExtraordinaryDividendPaid", dato: "2025-12-31", vaerdi: 80e6 },
    { begreb: "ProposedExtraordinaryDividendRecognisedInEquity", dato: "2025-12-31", vaerdi: 80e6 },
    { begreb: "ProposedExtraordinaryDividendRecognisedInEquity", dato: "2024-12-31", vaerdi: 0 },
    { begreb: "ExtraordinaryDividendDistributedAfterEndOfReportingPeriodGross", dato: "2025-12-31", vaerdi: 0 },
    { begreb: "ExtraordinaryDividendDistributedAfterEndOfReportingPeriodGross", dato: "2024-12-31", vaerdi: 80e6 },
  ]);
  assert.equal(ud["2024"].foreslaaet, 80e6);
  assert.equal(ud["2024"].betalt, undefined);
  assert.equal(ud["2025"].betalt, 80e6);
  assert.equal(ud["2025"].foreslaaet, 0, "saldoen i egenkapitalen overtager ikke");
});

test("ordinært og ekstraordinært udbytte lægges sammen", () => {
  const ud = udbytteFraFakta([
    { begreb: "ProposedDividend", dato: "2025-12-31", vaerdi: 10e6 },
    { begreb: "ProposedExtraordinaryDividend", dato: "2025-12-31", vaerdi: 5e6 },
  ]);
  assert.equal(ud["2025"].foreslaaet, 15e6);
});

test("udbytte fra PDF-linjer", () => {
  const ud = udbytteFraLinjer(["Foreslået udbytte 80.000 60.000", "Betalt udbytte 12 (60.000) (50.000)"], ["2025", "2024"], parseDanskTal);
  assert.equal(ud["2025"].foreslaaet, 80000);
  assert.equal(ud["2024"].foreslaaet, 60000);
  assert.equal(ud["2025"].betalt, 60000);
});

test("iXBRL-dokumentet giver både beretning og udbytte", () => {
  const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:fsa="http://xbrl.dcca.dk/fsa">
<head><title>Eksempel A/S - Årsrapport for 2025</title></head><body>
<ix:header><ix:resources>
<xbrli:context id="c1"><xbrli:entity><xbrli:identifier scheme="x">1</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>2025-12-31</xbrli:instant></xbrli:period></xbrli:context>
<xbrli:context id="d1"><xbrli:entity><xbrli:identifier scheme="x">1</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
<xbrli:unit id="DKK"><xbrli:measure>iso4217:DKK</xbrli:measure></xbrli:unit>
</ix:resources></ix:header>
<h1>Ledelsesberetning</h1>
<p>Bestyrelsen foreslår et udbytte på 80 mio. kr. Omsætningen steg som følge af prisstigninger.</p>
<h1>Resultatopgørelse</h1>
<table><tr><td>Nettoomsætning</td><td><ix:nonFraction name="fsa:Revenue" contextRef="d1" unitRef="DKK" scale="6" decimals="-6">500</ix:nonFraction></td></tr>
<tr><td>Foreslået udbytte</td><td><ix:nonFraction name="fsa:ProposedDividendRecognisedInEquity" contextRef="c1" unitRef="DKK" scale="6" decimals="-6">80</ix:nonFraction></td></tr></table>
</body></html>`;
  const r = parseXbrlDokument(html, "test", DOMParser);
  assert.match(r.beretning, /udbytte på 80 mio/);
  assert.equal(r.udbytte["2025"].foreslaaet, 80e6);
});

// Eksemplet som nøgletalsappens dataset, med et udbytte på 8.000 t.kr. i 2025.
function datasetMedUdbytte() {
  const d = emptyDataset();
  const kr = v => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x * 1000]));
  const { leverandoergaeld, kortfristetGaeld, ...primo } = EKSEMPEL.kolonner[0].v;
  d.virksomhed = "Nordlys Engros A/S"; d.enhed = "1.000 kr."; d.grundenhed = "kr.";
  d.primo = kr({ ...primo, leverandoergaeld, andenKortfristetGaeld: kortfristetGaeld - leverandoergaeld });
  d.aar = EKSEMPEL.kolonner.slice(1).map(k => {
    const { leverandoergaeld: l, kortfristetGaeld: kg, omsaetningsaktiver, ...v } = k.v;
    return { label: k.aar, poster: {}, values: kr({ ...v, leverandoergaeld: l, andenKortfristetGaeld: kg - l, likvider: omsaetningsaktiver - v.varelager - v.varedebitorer }) };
  });
  const fund = [{
    enhed: "kr.", kolonner: [{ navn: "2025" }, { navn: "2024" }],
    beretning: "Bestyrelsen foreslår et udbytte på 8 mio. kr. Egenkapitalen er styrket af årets overskud.",
    udbytte: { 2025: { foreslaaet: 8e6, betalt: 3e6 } },
  }];
  return { d, fund };
}

test("udbyttet omregnes til visningsenheden og følger året", () => {
  const { d, fund } = datasetMedUdbytte();
  const { udbytte, beretning } = fraFund(fund, ["2023", "2024", "2025"], d.enhed);
  assert.equal(udbytte[2].foreslaaet, 8000);
  assert.equal(udbytte[0].foreslaaet, null);
  assert.match(beretning, /udbytte/);
});

test("udbyttet indgår i soliditeten, pengestrømmen og konklusionen", () => {
  const { d, fund } = datasetMedUdbytte();
  const { kase, noegletal } = fraDataset(d, fund);
  const a = analyser(kase, noegletal);
  const sol = a.omraader.soliditet.grupper.find(g => g.id === "sol");
  assert.match(sol.trin2.join(" "), /foreslået et udbytte på 8\.000 t\.kr\./);
  assert.match(sol.trin3.join(" "), /Når det foreslåede udbytte på 8\.000 t\.kr\. udbetales/);
  assert.ok(sol.noegle.some(x => x.startsWith("Udbytte for året")));
  const cf = a.omraader.kapital.grupper.find(g => g.id === "cf");
  assert.match(cf.trin2.join(" "), /betalt 3\.000 t\.kr\. i udbytte/);
  assert.ok(a.faldgruber.some(f => f.gruppe === "sol" && f.tema === "manglende-aarsag"));
});

test("en rettet værdi vinder over den indlæste", () => {
  const { d, fund } = datasetMedUdbytte();
  d.analyse = { udbytte: { foreslaaet: [null, null, 80000], betalt: [null, null, null] } };
  const { kase } = fraDataset(d, fund);
  assert.equal(kase.udbytte[2].foreslaaet, 80000);
  assert.equal(kase.udbytte[2].betalt, 3000);
});

test("beretningen citeres ved det nøgletal, den handler om, og dens tal må bruges", () => {
  const { d, fund } = datasetMedUdbytte();
  const { kase, noegletal } = fraDataset(d, fund);
  const a = analyser(kase, noegletal);
  const sol = a.omraader.soliditet.grupper.find(g => g.id === "sol");
  assert.ok(sol.beretning.some(c => /udbytte på 8 mio\. kr\./.test(c)), "sætningen deles ikke efter mio.");
  assert.ok(a.faldgruber.some(f => f.tema === "beretning-ukritisk"));
  assert.deepEqual(tjekTal("Ifølge ledelsen foreslås et udbytte på 8 mio. kr.", a), []);
});

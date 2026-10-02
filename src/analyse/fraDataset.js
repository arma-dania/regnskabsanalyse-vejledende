// Broen mellem nøgletalsappen og analysemotoren: det omformede regnskab og
// de beregnede nøgletal går direkte videre til analysen. Intet tastes to gange.

import { iVisningsenhed, withDerived, enhedFaktor, FIELD_MAP } from "../lib/model.js";
import { beregnAlle, byggIndeksNogletal, beregnesPaaBrutto } from "../lib/nogletal.js";
import { UDBYTTE_UDGAVE } from "../lib/beretning.js";

// Nøgletalsappens enhed ("1.000 kr.") i analysens korte form ("t.kr.").
const kortEnhed = e => (/mio/i.test(e) ? "mio. kr." : /1\.?000|t\.?kr/i.test(e) ? "t.kr." : "kr.");

// Primo er sammenligningsåret i det ældste regnskab: året før første analyseår.
const primoNavn = label => (/^\d{4}$/.test(label) ? String(Number(label) - 1) : "Primo");

/** Standardværdier for analysens indstillinger, som gemmes i dataset.analyse. */
export const tomAnalyse = () => ({
  markedsrente: [null, null, null], profil: "", forretningsmodel: "",
  beretning: null,
  // Citater fra ledelsesberetningen i analysen – kan slås fra, når
  // beretningen ikke siger noget brugbart om tallene.
  brugCitater: true,
});

const hovedaar = doc => Math.max(...(doc.kolonner || []).map(k => Number(k.navn)).filter(Number.isFinite));

/**
 * Ledelsesberetningen og udbyttet fra de indlæste dokumenter (fund).
 * Beretningen tages fra det nyeste regnskab. Udbyttet for et år tages helst
 * fra det regnskab, hvor året er regnskabsåret, ellers fra sammenligningsåret.
 * Beløbene omregnes til visningsenheden.
 */
export function fraFund(fund = [], aar = [], visEnhed = "") {
  const docs = [...fund].sort((a, b) => hovedaar(b) - hovedaar(a));
  const beretning = docs.find(d => d.beretning)?.beretning || "";
  const faktor = d => enhedFaktor(d.enhed || "kr.") / enhedFaktor(visEnhed);
  // Udbytte fra regnskaber indlæst med en ældre udgave af udbyttelæsningen
  // bruges ikke – de skal indlæses igen.
  const foraeldet = docs.some(d => d.udbytte && Object.keys(d.udbytte).length && d.udbytteUdgave !== UDBYTTE_UDGAVE);
  const udbytte = aar.map(y => {
    const ud = { foreslaaet: null, betalt: null };
    const kilder = [...docs].sort((a, b) => (String(hovedaar(b)) === y) - (String(hovedaar(a)) === y));
    for (const d of kilder)
      for (const art of ["foreslaaet", "betalt"])
        if (d.udbytteUdgave === UDBYTTE_UDGAVE && ud[art] == null && d.udbytte?.[y]?.[art] != null) ud[art] = d.udbytte[y][art] * faktor(d);
    // 0 betyder, at regnskabet udtrykkeligt siger "intet udbytte".
    for (const art of ["foreslaaet", "betalt"]) if (ud[art] === 0) ud[art] = null;
    return ud;
  });
  return { beretning, udbytte, udbytteForaeldet: foraeldet };
}

/**
 * Laver analysens case og nøgletal ud fra nøgletalsappens dataset.
 * Beløbene er i den valgte visningsenhed – de samme tal, som står i tabellerne.
 */
export function fraDataset(dataset, fund = []) {
  const vist = iVisningsenhed(dataset);
  const a = { ...tomAnalyse(), ...(dataset.analyse || {}) };
  const aar = vist.aar.map((y, i) => y.label || `År ${i + 1}`);
  const indlaest = fraFund(fund, aar, dataset.enhed || "");
  // Udbyttet er det, importen fandt i regnskaberne.
  const udbytte = indlaest.udbytte.map(u => ({ foreslaaet: u.foreslaaet, betalt: u.betalt }));
  const kase = {
    navn: dataset.virksomhed || "Virksomheden",
    enhed: kortEnhed(dataset.enhed || ""),
    markedsrente: a.markedsrente,
    profil: a.profil,
    forretningsmodel: a.forretningsmodel,
    beretning: a.beretning ?? indlaest.beretning,
    brugCitater: a.brugCitater !== false,
    udbytte,
    kolonner: [
      { aar: primoNavn(aar[0]), v: withDerived(vist.primo || {}) },
      ...vist.aar.map((y, i) => ({ aar: aar[i], v: withDerived(y.values) })),
    ],
  };
  // Klasse B: brugeren har valgt at regne på bruttofortjenesten.
  kase.bruttoBasis = beregnesPaaBrutto(dataset);
  const noegletal = beregnAlle(dataset).map(r => {
    const n = Object.fromEntries(Object.entries(r).map(([nr, x]) => [nr, x.value]));
    n.skoen = Object.values(r).some(x => x.skoen);
    return n;
  });
  // De indekstal, brugeren har krydset af under "Nøgletal og grafer" – med
  // det valgte basisår. Omsætningen er allerede nøgletal 8.
  const ekstra = byggIndeksNogletal(dataset).filter(n => n.nr !== "indeks:omsaetning" && !(beregnesPaaBrutto(dataset) && n.nr === "indeks:bruttoresultat"));
  const resE = ekstra.length ? beregnAlle(dataset, ekstra) : [];
  kase.indekstal = ekstra.map(n => {
    const key = n.nr.slice("indeks:".length);
    return { key, navn: FIELD_MAP[key]?.label || key, serie: resE.map(r => r[n.nr]?.value ?? null) };
  }).filter(x => x.serie.some(v => v != null));
  kase.indeksBasis = aar[dataset.indeksBasisaar ?? 0] || aar[0];
  kase.indeksOmsaetning = (() => {
    const felt = kase.bruttoBasis ? "bruttoresultat" : "omsaetning";
    const oms = byggIndeksNogletal({ ...dataset, indeksFelter: [felt] });
    return beregnAlle(dataset, oms).map(r => r[`indeks:${felt}`]?.value ?? null);
  })();
  return { kase, noegletal, indlaest };
}

/** Er der tal nok til en analyse? Mindst omsætning eller bruttoresultat og en balance i to år. */
export function klarTilAnalyse(dataset) {
  const aar = (dataset.aar || []).map(y => withDerived(y.values || {}));
  const medTal = aar.filter(v => (v.omsaetning != null || v.bruttoresultat != null) && v.aktiverIAlt != null);
  return medTal.length >= 2;
}

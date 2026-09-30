// Broen mellem nøgletalsappen og analysemotoren: det omformede regnskab og
// de beregnede nøgletal går direkte videre til analysen. Intet tastes to gange.

import { iVisningsenhed, withDerived, enhedFaktor } from "../lib/model.js";
import { beregnAlle } from "../lib/nogletal.js";

// Nøgletalsappens enhed ("1.000 kr.") i analysens korte form ("t.kr.").
const kortEnhed = e => (/mio/i.test(e) ? "mio. kr." : /1\.?000|t\.?kr/i.test(e) ? "t.kr." : "kr.");

// Primo er sammenligningsåret i det ældste regnskab: året før første analyseår.
const primoNavn = label => (/^\d{4}$/.test(label) ? String(Number(label) - 1) : "Primo");

/** Standardværdier for analysens indstillinger, som gemmes i dataset.analyse. */
export const tomAnalyse = () => ({
  markedsrente: [null, null, null], profil: "", forretningsmodel: "",
  // Rettelser til det, importen fandt. null = brug det indlæste.
  udbytte: { foreslaaet: [null, null, null], betalt: [null, null, null] },
  beretning: null,
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
  const udbytte = aar.map(y => {
    const ud = { foreslaaet: null, betalt: null };
    const kilder = [...docs].sort((a, b) => (String(hovedaar(b)) === y) - (String(hovedaar(a)) === y));
    for (const d of kilder)
      for (const art of ["foreslaaet", "betalt"])
        if (ud[art] == null && d.udbytte?.[y]?.[art] != null) ud[art] = d.udbytte[y][art] * faktor(d);
    // 0 betyder, at regnskabet udtrykkeligt siger "intet udbytte".
    for (const art of ["foreslaaet", "betalt"]) if (ud[art] === 0) ud[art] = null;
    return ud;
  });
  return { beretning, udbytte };
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
  const ret = a.udbytte || tomAnalyse().udbytte;
  const udbytte = indlaest.udbytte.map((u, i) => ({
    foreslaaet: ret.foreslaaet?.[i] ?? u.foreslaaet,
    betalt: ret.betalt?.[i] ?? u.betalt,
  }));
  const kase = {
    navn: dataset.virksomhed || "Virksomheden",
    enhed: kortEnhed(dataset.enhed || ""),
    markedsrente: a.markedsrente,
    profil: a.profil,
    forretningsmodel: a.forretningsmodel,
    beretning: a.beretning ?? indlaest.beretning,
    udbytte,
    kolonner: [
      { aar: primoNavn(aar[0]), v: withDerived(vist.primo || {}) },
      ...vist.aar.map((y, i) => ({ aar: aar[i], v: withDerived(y.values) })),
    ],
  };
  const noegletal = beregnAlle(dataset).map(r => {
    const n = Object.fromEntries(Object.entries(r).map(([nr, x]) => [nr, x.value]));
    n.skoen = Object.values(r).some(x => x.skoen);
    return n;
  });
  return { kase, noegletal, indlaest };
}

/** Er der tal nok til en analyse? Mindst omsætning eller bruttoresultat og en balance i to år. */
export function klarTilAnalyse(dataset) {
  const aar = (dataset.aar || []).map(y => withDerived(y.values || {}));
  const medTal = aar.filter(v => (v.omsaetning != null || v.bruttoresultat != null) && v.aktiverIAlt != null);
  return medTal.length >= 2;
}

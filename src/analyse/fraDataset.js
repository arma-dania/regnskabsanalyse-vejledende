// Broen mellem nøgletalsappen og analysemotoren: det omformede regnskab og
// de beregnede nøgletal går direkte videre til analysen. Intet tastes to gange.

import { iVisningsenhed, withDerived } from "../lib/model.js";
import { beregnAlle } from "../lib/nogletal.js";

// Nøgletalsappens enhed ("1.000 kr.") i analysens korte form ("t.kr.").
const kortEnhed = e => (/mio/i.test(e) ? "mio. kr." : /1\.?000|t\.?kr/i.test(e) ? "t.kr." : "kr.");

// Primo er sammenligningsåret i det ældste regnskab: året før første analyseår.
const primoNavn = label => (/^\d{4}$/.test(label) ? String(Number(label) - 1) : "Primo");

/** Standardværdier for analysens indstillinger, som gemmes i dataset.analyse. */
export const tomAnalyse = () => ({ markedsrente: [null, null, null], profil: "", forretningsmodel: "" });

/**
 * Laver analysens case og nøgletal ud fra nøgletalsappens dataset.
 * Beløbene er i den valgte visningsenhed – de samme tal, som står i tabellerne.
 */
export function fraDataset(dataset) {
  const vist = iVisningsenhed(dataset);
  const a = { ...tomAnalyse(), ...(dataset.analyse || {}) };
  const aar = vist.aar.map((y, i) => y.label || `År ${i + 1}`);
  const kase = {
    navn: dataset.virksomhed || "Virksomheden",
    enhed: kortEnhed(dataset.enhed || ""),
    markedsrente: a.markedsrente,
    profil: a.profil,
    forretningsmodel: a.forretningsmodel,
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
  return { kase, noegletal };
}

/** Er der tal nok til en analyse? Mindst omsætning eller bruttoresultat og en balance i to år. */
export function klarTilAnalyse(dataset) {
  const aar = (dataset.aar || []).map(y => withDerived(y.values || {}));
  const medTal = aar.filter(v => (v.omsaetning != null || v.bruttoresultat != null) && v.aktiverIAlt != null);
  return medTal.length >= 2;
}

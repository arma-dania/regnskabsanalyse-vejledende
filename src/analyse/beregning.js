// Analysens regnestykker. Selve nøgletallene kommer fra nøgletalsappens egen
// beregning (src/lib/nogletal.js) og overskriver dem, der regnes her – så
// analysen altid skriver om præcis de tal, der står i tabellerne og graferne.
// Regningen her er den samme efter Bilag 2 og bruges til mellemregningerne
// (gennemsnit, kapitalbinding, EKF-afstemning) og i prøverne.
//
// En case har fire kolonner: [primo, år 1, år 2, år 3]. Primo er det ældste
// regnskabs sammenligningsår og bruges kun til gennemsnit og lager primo.

import { medAfledte } from "./poster.js";

export const OMRAADER = [
  { id: "rentabilitet", navn: "Rentabilitetsanalyse", nrs: [1, 2, 3, 4, 5, 6] },
  { id: "indtjeningsevne", navn: "Indtjeningsevne", nrs: [7, 8, 9, 10, 11, 12] },
  { id: "kapital", navn: "Kapitaltilpasning og pengestrømme", nrs: [13, 14, 15, 16, 17, 18, 19] },
  { id: "soliditet", navn: "Soliditet og likviditet", nrs: [20, 21, 22, 23, 24] },
  { id: "boers", navn: "Børsrelaterede nøgletal", nrs: [25, 26, 27, 28] },
];

// enhed: "%" (procent – ændringer i procentpoint), "x" (gange), "kr", "beløb",
// "indeks". bedre: op / ned / neutral.
export const NOEGLETAL = [
  { nr: 1, navn: "Afkastningsgrad", kort: "AG", enhed: "%", bedre: "op" },
  { nr: 2, navn: "Overskudsgrad", kort: "OG", enhed: "%", bedre: "op" },
  { nr: 3, navn: "Aktivernes omsætningshastighed", kort: "AOH", enhed: "x", bedre: "op" },
  { nr: 4, navn: "Egenkapitalens forrentning", kort: "EKF", enhed: "%", bedre: "op" },
  { nr: 5, navn: "Fremmedkapitalens forrentning", kort: "r", enhed: "%", bedre: "ned" },
  { nr: 6, navn: "Finansiel gearing", kort: "FK/EK", enhed: "x", bedre: "neutral" },
  { nr: 7, navn: "Bruttomargin", kort: "BM", enhed: "%", bedre: "op" },
  { nr: 8, navn: "Indekstal – omsætning", kort: "Indeks oms.", enhed: "indeks", bedre: "op" },
  { nr: 9, navn: "Driftsmæssig gearing", kort: "DG", enhed: "%", bedre: "neutral" },
  { nr: 10, navn: "Kapacitetsgrad", kort: "KG", enhed: "x", bedre: "op" },
  { nr: 11, navn: "Nulpunktsomsætning", kort: "Nulpunkt", enhed: "beløb", bedre: "ned" },
  { nr: 12, navn: "Sikkerhedsmargin", kort: "SM", enhed: "%", bedre: "op" },
  { nr: 13, navn: "Anlægsaktivernes omsætningshastighed", kort: "Anlæg oms.hast.", enhed: "x", bedre: "op" },
  { nr: 14, navn: "Immaterielle anlægsaktivers omsætningshastighed", kort: "Immat. oms.hast.", enhed: "x", bedre: "op" },
  { nr: 15, navn: "Materielle anlægsaktivers omsætningshastighed", kort: "Mat. oms.hast.", enhed: "x", bedre: "op" },
  { nr: 16, navn: "Varelagerets omsætningshastighed", kort: "Lager oms.hast.", enhed: "x", bedre: "op" },
  { nr: 17, navn: "Varedebitorernes omsætningshastighed", kort: "Debitor oms.hast.", enhed: "x", bedre: "op" },
  { nr: 18, navn: "Varekreditorernes omsætningshastighed", kort: "Kreditor oms.hast.", enhed: "x", bedre: "ned" },
  { nr: 19, navn: "Pengestrøm fra primær drift / omsætning", kort: "CF/oms.", enhed: "%", bedre: "op" },
  { nr: 20, navn: "Soliditetsgrad", kort: "Soliditet", enhed: "%", bedre: "op" },
  { nr: 21, navn: "Anlægsgrad", kort: "Anlægsgrad", enhed: "%", bedre: "neutral" },
  { nr: 22, navn: "Kapitalbindingsgrad", kort: "Kap.binding", enhed: "x", bedre: "ned" },
  { nr: 23, navn: "Likviditetsgrad I", kort: "LG I", enhed: "%", bedre: "op" },
  { nr: 24, navn: "Likviditetsgrad II", kort: "LG II", enhed: "%", bedre: "op" },
  { nr: 25, navn: "Resultat pr. aktie", kort: "EPS", enhed: "kr", bedre: "op" },
  { nr: 26, navn: "P/E-værdien", kort: "P/E", enhed: "x", bedre: "neutral" },
  { nr: 27, navn: "Indre værdi pr. aktie", kort: "Indre værdi", enhed: "kr", bedre: "op" },
  { nr: 28, navn: "Kurs/indre værdi", kort: "K/I", enhed: "x", bedre: "neutral" },
];

export const NT = Object.fromEntries(NOEGLETAL.map(n => [n.nr, n]));

const div = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
const pct = (a, b) => { const x = div(a, b); return x == null ? null : x * 100; };
const gns = (a, b) => (a == null ? null : b == null ? a : (a + b) / 2);
const fk = v => (v.aktiverIAlt != null && v.egenkapital != null ? v.aktiverIAlt - v.egenkapital : null);

// Beløb pr. aktie: regnskabet står i fx 1.000 kr., aktietal i stk.
export const ENHEDER = [
  { id: "kr.", faktor: 1 },
  { id: "t.kr.", faktor: 1000 },
  { id: "mio. kr.", faktor: 1_000_000 },
];
export const enhedFaktor = e => ENHEDER.find(x => x.id === e)?.faktor ?? 1;

/**
 * Regner ét analyseår (i = 1, 2 eller 3). Returnerer nøgletallene og de
 * mellemregninger, analysen bruger (gennemsnit, fremmedkapital osv.).
 */
export function regnAar(kase, i, eksterne = null) {
  const v = medAfledte(kase.kolonner[i].v);
  const f = medAfledte(kase.kolonner[i - 1].v);
  const b = medAfledte(kase.kolonner[1].v); // basisår for indekstal
  const skoen = f.aktiverIAlt == null || f.egenkapital == null;

  const gA = gns(v.aktiverIAlt, f.aktiverIAlt);
  const gEK = gns(v.egenkapital, f.egenkapital);
  const gFK = gns(fk(v), fk(f));
  const bm = pct(v.bruttoresultat, v.omsaetning);
  const nulpunkt = bm ? div(v.kapacitetsomkostninger, bm / 100) : null;
  const varekoeb = v.vareforbrug == null ? null : v.vareforbrug + (v.varelager != null && f.varelager != null ? v.varelager - f.varelager : 0);
  const faktor = enhedFaktor(kase.enhed);
  const eps = v.antalAktier ? div(v.aaretsResultat == null ? null : v.aaretsResultat * faktor, v.antalAktier) : null;
  const indre = v.antalAktier ? div(v.egenkapital == null ? null : v.egenkapital * faktor, v.antalAktier) : null;

  const n = {
    1: pct(v.resultatPrimaerDrift, gA),
    2: pct(v.resultatPrimaerDrift, v.omsaetning),
    3: div(v.omsaetning, gA),
    4: pct(v.aaretsResultat, gEK),
    5: pct(v.finansielleOmkostninger, gFK),
    6: div(gFK, gEK),
    7: bm,
    8: pct(v.omsaetning, b.omsaetning),
    9: pct(v.kapacitetsomkostninger, v.vareforbrug == null && v.kapacitetsomkostninger == null ? null : (v.vareforbrug ?? 0) + (v.kapacitetsomkostninger ?? 0)),
    10: div(v.bruttoresultat, v.kapacitetsomkostninger),
    11: nulpunkt,
    12: nulpunkt == null ? null : pct(v.omsaetning - nulpunkt, v.omsaetning),
    13: div(v.omsaetning, v.anlaegsaktiver),
    14: div(v.omsaetning, v.immaterielleAnlaeg),
    15: div(v.omsaetning, v.materielleAnlaeg),
    16: div(v.vareforbrug, v.varelager),
    17: div(v.omsaetning, v.varedebitorer),
    18: div(varekoeb, v.leverandoergaeld),
    19: pct(v.pengestroemPrimaerDrift, v.omsaetning),
    20: pct(v.egenkapital, v.aktiverIAlt),
    21: pct(v.anlaegsaktiver, v.aktiverIAlt),
    22: div(v.anlaegsaktiver, v.egenkapital == null ? null : v.egenkapital + (v.langfristetGaeld ?? 0)),
    23: pct(v.omsaetningsaktiver == null ? null : v.omsaetningsaktiver - (v.varelager ?? 0), v.kortfristetGaeld),
    24: pct(v.omsaetningsaktiver, v.kortfristetGaeld),
    25: eps,
    26: div(v.boerskurs, eps),
    27: indre,
    28: div(v.boerskurs, indre),
  };
  // Nøgletalsappens egne tal vinder. Indekstallet (8) regnes altid her, fordi
  // nøgletalsappen kun regner indekstal for de poster, brugeren har valgt.
  if (eksterne) for (const nr of Object.keys(n)) if (nr !== "8" && nr in eksterne) n[nr] = eksterne[nr];

  // Mellemregninger til dekompositionerne. Alle i procent af omsætningen eller
  // af gennemsnitlig egenkapital, så de kan lægges sammen.
  const mellem = {
    v, gA, gEK, gFK, varekoeb,
    koAndel: pct(v.kapacitetsomkostninger, v.omsaetning),
    indeks: {
      omsaetning: pct(v.omsaetning, b.omsaetning),
      bruttoresultat: pct(v.bruttoresultat, b.bruttoresultat),
      kapacitetsomkostninger: pct(v.kapacitetsomkostninger, b.kapacitetsomkostninger),
      resultatPrimaerDrift: pct(v.resultatPrimaerDrift, b.resultatPrimaerDrift),
    },
    // Kapitalbinding pr. omsætningskrone (ultimo), i procent af omsætningen.
    binding: {
      anlaeg: pct(v.anlaegsaktiver, v.omsaetning),
      varelager: pct(v.varelager, v.omsaetning),
      debitorer: pct(v.varedebitorer, v.omsaetning),
      oevrige: v.omsaetningsaktiver == null ? null : pct(v.omsaetningsaktiver - (v.varelager ?? 0) - (v.varedebitorer ?? 0), v.omsaetning),
    },
    ekf: ekfAfstemning(v, gEK, n[1], n[5], n[6]),
    skoen: skoen || !!eksterne?.skoen,
  };
  return { n, mellem };
}

/**
 * EKF-formlen og afstemningen til nøgletal 4.
 *
 * Formlen EKF = AG + (AG − r) · FK/EK holder kun før skat, og kun når
 * resultat før skat = primær drift − renteomkostninger. Resten – finansielle
 * indtægter og andre poster – og skatten vises som egne linjer, så
 * afstemningen altid går op til det EKF, nøgletalsappen viser.
 */
export function ekfAfstemning(v, gEK, ag, r, g) {
  if ([ag, r, g, gEK].some(x => x == null) || !gEK) return null;
  const gearingsbidrag = (ag - r) * g;
  const formel = ag + gearingsbidrag;
  const foerSkat = pct(v.resultatFoerSkat, gEK);
  const efterSkat = pct(v.aaretsResultat, gEK);
  if (foerSkat == null || efterSkat == null) return { ag, r, g, gearingsbidrag, formel, rentemarginal: ag - r };
  return {
    ag, r, g,
    rentemarginal: ag - r,
    gearingsbidrag,
    formel,
    rest: foerSkat - formel, // finansielle indtægter m.m.
    foerSkat,
    skat: efterSkat - foerSkat, // negativ ved skatteudgift
    efterSkat,
  };
}

/** eksterne: nøgletalsappens tal pr. år, [{ 1: 9.0, 2: 3.0, … }, …] */
export function regnCase(kase, eksterne = null) {
  return [1, 2, 3].map(i => ({ aar: kase.kolonner[i].aar, ...regnAar(kase, i, eksterne?.[i - 1]) }));
}

/* ---------------------- Formatering ---------------------- */

// Minus skrives som − (U+2212), så det ikke forveksles med en bindestreg.
const fmt = (x, d) => new Intl.NumberFormat("da-DK", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x).replace("-", "−");

export function formatNt(nr, x, enhedstekst = "") {
  if (x == null || !Number.isFinite(x)) return "–";
  const e = NT[nr]?.enhed;
  if (e === "%") return fmt(x, 1) + " %";
  if (e === "x") return fmt(x, 2);
  if (e === "kr") return fmt(x, 2) + " kr.";
  if (e === "indeks") return fmt(x, 0);
  if (e === "beløb") return fmt(x, 0) + (enhedstekst ? " " + enhedstekst : "");
  return fmt(x, 1);
}

/** Ændring formateret efter enhed: procentpoint for %, ellers procent. */
export function formatAendring(nr, fra, til) {
  if (fra == null || til == null) return "–";
  const e = NT[nr]?.enhed;
  if (e === "%") return fortegn(til - fra) + fmt(Math.abs(til - fra), 1) + " pct.point";
  if (e === "indeks") return fortegn(til - fra) + fmt(Math.abs(til - fra), 0) + " point";
  if (!fra) return "–";
  const p = ((til - fra) / Math.abs(fra)) * 100;
  return fortegn(p) + fmt(Math.abs(p), 1) + " %";
}

const fortegn = x => (x > 0 ? "+" : x < 0 ? "−" : "±");
export const fmtPct = (x, d = 1) => (x == null ? "–" : fmt(x, d) + " %");
export const fmtPp = (x, d = 1) => (x == null ? "–" : fortegn(x) + fmt(Math.abs(x), d) + " pct.point");
/** Procentpoint uden fortegn – til sætninger, hvor retningen står i ordene. */
export const fmtPpU = (x, d = 1) => (x == null ? "–" : fmt(Math.abs(x), d) + " pct.point");
/** Grænseværdier: uden decimaler, når de er hele tal (30 %, ikke 30,0 %). */
export function formatGraense(nr, x) {
  const e = NT[nr]?.enhed;
  const t = Number.isInteger(x) ? fmt(x, 0) : fmt(x, e === "x" ? 2 : 1);
  return e === "%" ? t + " %" : t;
}
export const fmtX = (x, d = 2) => (x == null ? "–" : fmt(x, d));
export const fmtBeloeb = (x, enhed = "") => (x == null ? "–" : fmt(x, 0) + (enhed ? " " + enhed : ""));

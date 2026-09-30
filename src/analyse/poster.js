// De poster fra analyseformen, analysemotoren bruger. Nøglerne er de samme
// som i src/lib/model.js. Poster markeret "afledt" beregnes, hvis de mangler.
//
// Resultatposter hører til et år. Balanceposter findes også for primo (det
// ældste regnskabs sammenligningsår), fordi afkastningsgrad, EKF, r og gearing
// regnes på gennemsnit af primo og ultimo.

export const POSTER = [
  // Resultatopgørelse
  { key: "omsaetning", label: "Nettoomsætning", afsnit: "res", synonymer: ["omsætning", "nettoomsætning", "revenue"] },
  { key: "vareforbrug", label: "Vareforbrug", afsnit: "res", synonymer: ["vareforbrug", "produktionsomkostninger", "cost of sales", "variable omkostninger"] },
  { key: "bruttoresultat", label: "Bruttoresultat", afsnit: "res", afledt: true, synonymer: ["bruttoresultat", "bruttofortjeneste", "dækningsbidrag", "gross profit"] },
  { key: "kapacitetsomkostninger", label: "Kapacitetsomkostninger", afsnit: "res", synonymer: ["kapacitetsomkostninger", "faste omkostninger", "kapacitetsomk"] },
  { key: "resultatPrimaerDrift", label: "Resultat af primær drift", afsnit: "res", afledt: true, synonymer: ["resultat af primær drift", "primært resultat", "driftsresultat", "ebit", "resultat før finansielle poster"] },
  { key: "finansielleIndtaegter", label: "Finansielle indtægter", afsnit: "res", synonymer: ["finansielle indtægter", "renteindtægter"] },
  { key: "finansielleOmkostninger", label: "Finansielle omkostninger", afsnit: "res", synonymer: ["finansielle omkostninger", "renteomkostninger", "finansielle udgifter"] },
  { key: "resultatFoerSkat", label: "Resultat før skat", afsnit: "res", afledt: true, synonymer: ["resultat før skat", "ordinært resultat før skat"] },
  { key: "skat", label: "Skat af årets resultat", afsnit: "res", synonymer: ["skat af årets resultat", "skat", "selskabsskat"] },
  { key: "aaretsResultat", label: "Årets resultat", afsnit: "res", afledt: true, synonymer: ["årets resultat", "resultat efter skat", "nettoresultat"] },

  // Aktiver
  { key: "immaterielleAnlaeg", label: "Immaterielle anlægsaktiver", afsnit: "akt", balance: true, synonymer: ["immaterielle anlægsaktiver", "immaterielle aktiver"] },
  { key: "materielleAnlaeg", label: "Materielle anlægsaktiver", afsnit: "akt", balance: true, synonymer: ["materielle anlægsaktiver", "materielle aktiver"] },
  { key: "finansielleAnlaeg", label: "Finansielle anlægsaktiver", afsnit: "akt", balance: true, synonymer: ["finansielle anlægsaktiver"] },
  { key: "anlaegsaktiver", label: "Anlægsaktiver i alt", afsnit: "akt", balance: true, afledt: true, synonymer: ["anlægsaktiver i alt", "anlægsaktiver"] },
  { key: "varelager", label: "Varebeholdninger", afsnit: "akt", balance: true, synonymer: ["varebeholdninger", "varelager", "varelagre", "lager"] },
  { key: "varedebitorer", label: "Tilgodehavender fra salg (varedebitorer)", afsnit: "akt", balance: true, synonymer: ["tilgodehavender fra salg", "varedebitorer", "debitorer"] },
  { key: "omsaetningsaktiver", label: "Omsætningsaktiver i alt", afsnit: "akt", balance: true, synonymer: ["omsætningsaktiver i alt", "omsætningsaktiver"] },
  { key: "aktiverIAlt", label: "Aktiver i alt (balancesum)", afsnit: "akt", balance: true, afledt: true, synonymer: ["aktiver i alt", "balancesum", "passiver i alt"] },

  // Passiver
  { key: "egenkapital", label: "Egenkapital", afsnit: "pas", balance: true, synonymer: ["egenkapital i alt", "egenkapital"] },
  { key: "langfristetGaeld", label: "Langfristede gældsforpligtelser", afsnit: "pas", balance: true, synonymer: ["langfristede gældsforpligtelser", "langfristet gæld"] },
  { key: "kortfristetGaeld", label: "Kortfristede gældsforpligtelser", afsnit: "pas", balance: true, synonymer: ["kortfristede gældsforpligtelser", "kortfristet gæld"] },
  { key: "leverandoergaeld", label: "Leverandører af varer og tjenesteydelser", afsnit: "pas", balance: true, synonymer: ["leverandører af varer og tjenesteydelser", "leverandørgæld", "varekreditorer"] },

  // Øvrige
  { key: "pengestroemPrimaerDrift", label: "Pengestrøm fra primær drift", afsnit: "oev", synonymer: ["pengestrøm fra primær drift", "pengestrømme fra driftsaktivitet", "pengestrøm fra driftsaktivitet"] },
  { key: "antalAktier", label: "Antal aktier (stk.)", afsnit: "oev", enhed: "stk", synonymer: ["antal aktier"] },
  { key: "boerskurs", label: "Børskurs ultimo (kr.)", afsnit: "oev", enhed: "kr", synonymer: ["børskurs", "aktiekurs"] },
];

export const POST = Object.fromEntries(POSTER.map(p => [p.key, p]));

export const AFSNIT = [
  { id: "res", navn: "Resultatopgørelse" },
  { id: "akt", navn: "Aktiver" },
  { id: "pas", navn: "Passiver" },
  { id: "oev", navn: "Pengestrøm og aktie" },
];

const tal = v => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const sum = (...xs) => (xs.some(x => x != null) ? xs.reduce((a, x) => a + (x ?? 0), 0) : null);

/** Et års værdier med de afledte poster udfyldt, hvor de ikke er tastet. */
export function medAfledte(raa = {}) {
  const v = Object.fromEntries(POSTER.map(p => [p.key, tal(raa[p.key])]));
  if (v.bruttoresultat == null && v.omsaetning != null && v.vareforbrug != null)
    v.bruttoresultat = v.omsaetning - v.vareforbrug;
  if (v.vareforbrug == null && v.omsaetning != null && v.bruttoresultat != null)
    v.vareforbrug = v.omsaetning - v.bruttoresultat;
  if (v.resultatPrimaerDrift == null && v.bruttoresultat != null && v.kapacitetsomkostninger != null)
    v.resultatPrimaerDrift = v.bruttoresultat - v.kapacitetsomkostninger;
  if (v.resultatFoerSkat == null && v.resultatPrimaerDrift != null)
    v.resultatFoerSkat = v.resultatPrimaerDrift + (v.finansielleIndtaegter ?? 0) - (v.finansielleOmkostninger ?? 0);
  if (v.aaretsResultat == null && v.resultatFoerSkat != null && v.skat != null)
    v.aaretsResultat = v.resultatFoerSkat - v.skat;
  if (v.anlaegsaktiver == null) v.anlaegsaktiver = sum(v.immaterielleAnlaeg, v.materielleAnlaeg, v.finansielleAnlaeg);
  if (v.aktiverIAlt == null && v.anlaegsaktiver != null && v.omsaetningsaktiver != null)
    v.aktiverIAlt = v.anlaegsaktiver + v.omsaetningsaktiver;
  return v;
}

/** Balancen stemmer, hvis aktiver = egenkapital + gæld (inden for afrunding). */
export function balanceKontrol(v) {
  if (v.aktiverIAlt == null || v.egenkapital == null) return null;
  const passiver = v.egenkapital + (v.langfristetGaeld ?? 0) + (v.kortfristetGaeld ?? 0);
  return { aktiver: v.aktiverIAlt, passiver, forskel: v.aktiverIAlt - passiver };
}

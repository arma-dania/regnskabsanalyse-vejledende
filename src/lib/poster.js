// Regnskabet i analyseform – de poster, analysen bygger på.
//
// Nøglerne er de samme som i nøgletalsappen (arma-dania/regnskaber), så tal
// kan flyttes mellem de to apps uden omdøbning. Poster markeret "afledt"
// beregnes, hvis de ikke er tastet: fx bruttoresultat = omsætning − vareforbrug.
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

/**
 * Læser tal indsat fra Excel eller fra nøgletalsappens Word/Excel: én post pr.
 * linje, navnet først og derefter tallene adskilt af tabulator. Navnet
 * genkendes på postens betegnelse eller et synonym. Tal i dansk format
 * ("1.234,5") og engelsk format ("1,234.5") læses begge.
 */
export function laesIndsat(tekst, antalKolonner) {
  const ud = {};
  const ukendte = [];
  for (const linje of String(tekst).split(/\r?\n/)) {
    const felter = linje.split("\t").map(s => s.trim());
    if (felter.length < 2 || !felter[0]) continue;
    const navn = felter[0].toLowerCase().replace(/\s+/g, " ").replace(/[:*]/g, "").trim();
    const post = findPost(navn);
    const vaerdier = felter.slice(1).map(laesTal).filter((_, i) => i < antalKolonner);
    if (!post) {
      if (vaerdier.some(x => x != null)) ukendte.push(felter[0]);
      continue;
    }
    ud[post.key] = vaerdier;
  }
  return { poster: ud, ukendte };
}

function findPost(navn) {
  // Præcis betegnelse først, så "anlægsaktiver i alt" ikke fanges af "anlægsaktiver".
  for (const p of POSTER) if (p.label.toLowerCase() === navn || p.synonymer.includes(navn)) return p;
  let bedst = null;
  for (const p of POSTER)
    for (const s of p.synonymer)
      if (navn.startsWith(s) && (!bedst || s.length > bedst.l)) bedst = { p, l: s.length };
  return bedst?.p ?? null;
}

export function laesTal(s) {
  if (s == null) return null;
  let t = String(s).replace(/\s|kr\.?|t\.kr\.?/gi, "").replace(/[()]/g, m => (m === "(" ? "-" : ""));
  if (!t || t === "-" || t === "–") return null;
  t = t.replace("−", "-").replace("–", "-");
  const komma = t.lastIndexOf(",");
  const punktum = t.lastIndexOf(".");
  if (komma > punktum) t = t.replace(/\./g, "").replace(",", ".");
  else if (punktum > komma && komma !== -1) t = t.replace(/,/g, "");
  else if (punktum !== -1 && /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

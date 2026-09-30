// Små sproglige byggeklodser til analysens sætninger.

import { NT, formatNt, formatAendring } from "./beregning.js";
import { VAESENTLIG } from "./maalestok.js";

// Nøgletallenes navne i bestemt form, så sætningerne kan begynde med dem.
export const BESTEMT = {
  1: "afkastningsgraden", 2: "overskudsgraden", 3: "aktivernes omsætningshastighed",
  4: "egenkapitalens forrentning", 5: "fremmedkapitalens forrentning", 6: "den finansielle gearing",
  7: "bruttomarginen", 8: "indekstallet for omsætningen", 9: "den driftsmæssige gearing", 10: "kapacitetsgraden",
  11: "nulpunktsomsætningen", 12: "sikkerhedsmarginen", 13: "anlægsaktivernes omsætningshastighed",
  14: "de immaterielle anlægsaktivers omsætningshastighed", 15: "de materielle anlægsaktivers omsætningshastighed",
  16: "varelagerets omsætningshastighed", 17: "varedebitorernes omsætningshastighed",
  18: "varekreditorernes omsætningshastighed", 19: "pengestrømmen fra primær drift i procent af omsætningen",
  20: "soliditetsgraden", 21: "anlægsgraden", 22: "kapitalbindingsgraden", 23: "likviditetsgrad I", 24: "likviditetsgrad II",
  25: "resultatet pr. aktie", 26: "P/E-værdien", 27: "den indre værdi pr. aktie", 28: "kurs/indre værdi",
};

export const stort = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Er ændringen fra a til b stor nok til at nævnes? */
export function vaesentlig(nr, a, b) {
  if (a == null || b == null) return false;
  const e = NT[nr]?.enhed;
  // Procentnøgletal: mindst ½ procentpoint – eller 5 % af udgangsniveauet, så
  // et fald i overskudsgraden fra 2,9 % til 2,6 % hos en grossist også tæller.
  if (e === "%") return Math.abs(b - a) >= VAESENTLIG.procentpoint || (a !== 0 && Math.abs((b - a) / a) * 100 >= VAESENTLIG.relativ && Math.abs(b - a) >= 0.2);
  if (e === "indeks") return Math.abs(b - a) >= VAESENTLIG.relativ;
  if (!a) return b !== 0;
  return Math.abs((b - a) / a) * 100 >= VAESENTLIG.relativ;
}

export const verbum = (a, b) => (b > a ? "steg" : "faldt");

/**
 * Konstaterer udviklingen i ét nøgletal over de tre år – uden årsag og uden
 * vurdering (trin 1). Returnerer null, hvis tallene mangler.
 */
export function konstater(nr, serie, aar, enhedstekst = "") {
  const f = x => formatNt(nr, x, enhedstekst);
  const idx = serie.map((x, i) => (x == null ? null : i)).filter(i => i != null);
  if (!idx.length) return null;
  const navn = stort(BESTEMT[nr]);
  if (idx.length === 1) return `${navn} var ${f(serie[idx[0]])} i ${aar[idx[0]]}.`;
  const [i0, iN] = [idx[0], idx[idx.length - 1]];
  const [a, c] = [serie[i0], serie[iN]];
  const samlet = formatAendring(nr, a, c);

  if (idx.length === 3) {
    const b = serie[1];
    const t1 = vaesentlig(nr, a, b) ? Math.sign(b - a) : 0;
    const t2 = vaesentlig(nr, b, c) ? Math.sign(c - b) : 0;
    if (!t1 && !t2 && !vaesentlig(nr, a, c))
      return `${navn} lå stort set uændret: ${f(a)} i ${aar[0]}, ${f(b)} i ${aar[1]} og ${f(c)} i ${aar[2]}.`;
    if (t1 && t2 && t1 === t2)
      return `${navn} ${verbum(a, c)} begge år, fra ${f(a)} i ${aar[0]} over ${f(b)} i ${aar[1]} til ${f(c)} i ${aar[2]} (${samlet} samlet).`;
    if (t1 && t2 && t1 !== t2)
      return `${navn} ${verbum(a, b)} fra ${f(a)} i ${aar[0]} til ${f(b)} i ${aar[1]}, men ${verbum(b, c)} igen til ${f(c)} i ${aar[2]}.`;
    if (t2)
      return `${navn} lå stabilt i ${aar[0]} og ${aar[1]} (${f(a)} og ${f(b)}) og ${verbum(b, c)} derefter til ${f(c)} i ${aar[2]} (${formatAendring(nr, b, c)}).`;
    return `${navn} ${verbum(a, b)} fra ${f(a)} i ${aar[0]} til ${f(b)} i ${aar[1]} og lå derefter stabilt (${f(c)} i ${aar[2]}).`;
  }
  if (!vaesentlig(nr, a, c)) return `${navn} lå stort set uændret: ${f(a)} i ${aar[i0]} og ${f(c)} i ${aar[iN]}.`;
  return `${navn} ${verbum(a, c)} fra ${f(a)} i ${aar[i0]} til ${f(c)} i ${aar[iN]} (${samlet}).`;
}

export const dage = oms => (oms ? Math.round(365 / oms) : null);

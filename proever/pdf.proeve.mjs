// PDF-indlæsningen: linjer fra pdf.js' tekstudtræk genkendes som
// regnskabsposter. Bygget efter Earth Matters ApS' årsrapport for 2025.
import { test } from "node:test";
import assert from "node:assert/strict";
import { linjerFraSide, posterFraLinjer, udenLigaturHul } from "../src/lib/pdfLinjer.js";

// Ét tekststykke pr. celle: [x, y, tekst]. Tal er højrestillet, så bredden
// sættes, så højre kant står ved kolonnen (2025 ved 400, 2024 ved 480).
const celle = ([x, y, str, hoejre]) => ({ str, transform: [1, 0, 0, 1, x, y], width: hoejre ? hoejre - x : str.length * 5 });
const side = rk => ({ items: rk.map(celle) });

const RESULTAT = side([
  [60, 700, "Note"], [370, 700, "2025", 400], [450, 700, "2024", 480],
  [60, 680, "Bruttofortjeneste/Bruttotab"], [340, 680, "6.533.046", 400], [420, 680, "7.342.243", 480],
  [60, 660, "Lønninger"], [340, 660, "- 4.895.845", 400], [420, 660, "- 4.514.202", 480],
  [60, 640, "Pensioner"], [350, 640, "- 400.198", 400], [430, 640, "- 294.904", 480],
  [60, 620, "Af- og nedskrivninger af materielle og immaterielle"],
  [350, 610, "- 348.910", 400], [430, 610, "- 38.677", 480],
  [60, 600, "anlægsaktiver"],
  [60, 580, "Resultat af ordinær primær drift"], [350, 580, "458.538", 400], [420, 580, "2.204.396", 480],
  [60, 560, "Andre fi nansielle indtægter"], [350, 560, "387.368", 400], [430, 560, "145.464", 480],
  [60, 540, "Andre fi nansielle omkostninger"], [350, 540, "- 187.044", 400], [430, 540, "- 533.195", 480],
  [60, 520, "Årets resultat i 2025 udgør 512 t.kr. og anses for tilfredsstillende"],
  [60, 500, "Tilgodehavende skat"], [440, 500, "23.756", 480],
  [60, 480, "Råvarer og hjælpematerialer"], [340, 480, "1.516.933", 400], [420, 480, "1.219.687", 480],
]);

const { kolonner, poster } = posterFraLinjer(linjerFraSide(RESULTAT));
const efter = navn => {
  const p = poster.find(x => x.label === navn);
  assert.ok(p, `${navn} blev ikke genkendt: ${poster.map(x => x.label).join(" | ")}`);
  return [kolonner[0][p.id], kolonner[1][p.id], p.forslag];
};

test("ligaturen i 'fi nansielle' lukkes", () => {
  assert.equal(udenLigaturHul("Andre fi nansielle indtægter"), "Andre finansielle indtægter");
  assert.equal(udenLigaturHul("Af- og nedskrivninger"), "Af- og nedskrivninger");
  assert.deepEqual(efter("Andre finansielle indtægter"), [387368, 145464, "finansielleIndtaegter"]);
  assert.deepEqual(efter("Andre finansielle omkostninger"), [187044, 533195, "finansielleOmkostninger"]);
});

test("to tal adskilt af mellemrum læses ikke som ét", () => {
  assert.deepEqual(efter("Resultat af ordinær primær drift"), [458538, 2204396, "resultatPrimaerDrift"]);
});

test("navnet er det samme i alle år – uden det første tal", () => {
  assert.deepEqual(efter("Lønninger"), [4895845, 4514202, "personaleomkostninger"]);
  assert.deepEqual(efter("Pensioner"), [400198, 294904, "personaleomkostninger"]);
});

test("tal på linjen under en tekst, der er brudt over to linjer", () => {
  assert.deepEqual(efter("Af- og nedskrivninger af materielle og immaterielle"), [348910, 38677, "afskrivninger"]);
});

test("et tal, der kun står i sammenligningsåret, havner i sammenligningsåret", () => {
  assert.deepEqual(efter("Tilgodehavende skat"), [undefined, 23756, "andreTilgodehavender"]);
});

test("sætninger og varebeholdninger læses ikke som resultatposter", () => {
  assert.ok(!poster.some(p => /udgør/.test(p.label)));
  assert.ok(!poster.some(p => p.forslag === "vareforbrug"), "Råvarer og hjælpematerialer i balancen er ikke vareforbrug");
});

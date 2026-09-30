// Taltjekket: hvert tal i en tekst, Claude har skrevet, skal findes i
// analysen. Claude må formulere, men ikke regne. Et tal, der ikke kan findes,
// markeres, så du kan se det, før besvarelsen bruges.

const TAL = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;
const norm = s => s.replace(/\./g, "");

// Tal, der ikke behøver en kilde: årstal, trinnumre og små hele tal
// ("to år", "trin 3", "5 områder") samt tommelfingerreglernes grænser.
const FRIE = new Set(["100", "30", "150", "200", "365"]);
const erFri = s => !s.includes(",") && (Number(s) <= 12 || /^(19|20)\d\d$/.test(s) || FRIE.has(s));

export function talIAnalysen(a) {
  const kilder = JSON.stringify([
    a.omraader, a.konklusion, a.faldgruber, a.rente, a.forretningsmodel,
    a.beregnet.map(b => b.n), a.profil,
  ]);
  const saet = new Set();
  for (const m of kilder.matchAll(TAL)) saet.add(norm(m[0]));
  // Tabellernes tal står i JSON med punktum som decimaltegn; læg dem også ind
  // med én og to decimaler i dansk format.
  for (const b of a.beregnet)
    for (const x of Object.values(b.n))
      if (x != null) for (const d of [0, 1, 2]) saet.add(x.toFixed(d).replace(".", ","));
  return saet;
}

/** Returnerer de tal i teksten, der ikke findes i analysen. */
export function tjekTal(tekst, analyse, saet = talIAnalysen(analyse)) {
  const ukendte = [];
  for (const m of String(tekst).matchAll(TAL)) {
    const t = norm(m[0]);
    if (erFri(t) || saet.has(t)) continue;
    if (!ukendte.includes(m[0])) ukendte.push(m[0]);
  }
  return ukendte;
}

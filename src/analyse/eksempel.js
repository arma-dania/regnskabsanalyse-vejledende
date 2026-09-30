// En tænkt virksomhed med opdigtede tal – til at prøve appen af og i prøverne.
// Tallene er valgt, så de rammer flere af de klassiske faldgruber: væksten er
// ikke rentabel, AG falder mest på grund af kapitalbindingen, lageret hober
// sig op, pengestrømmen svigter, og egenkapitalen vokser, mens soliditeten
// falder.

export const EKSEMPEL = {
  navn: "Nordlys Engros A/S (tænkt eksempel)",
  enhed: "t.kr.",
  profil: "grossist",
  forretningsmodel: "Grossist, der køber dagligvarer og husholdningsartikler stort ind og sælger videre til butikker og restauranter i Jylland. Kunderne får 30-45 dages kredit. Strategien de seneste år har været vækst gennem et bredere sortiment.",
  markedsrente: [null, null, null],
  kolonner: [
    { aar: "2022", v: { immaterielleAnlaeg: 2000, materielleAnlaeg: 18000, finansielleAnlaeg: 0, varelager: 30000, varedebitorer: 40000, omsaetningsaktiver: 78000, egenkapital: 32000, langfristetGaeld: 20000, kortfristetGaeld: 46000, leverandoergaeld: 28000 } },
    { aar: "2023", v: { omsaetning: 300000, vareforbrug: 246000, kapacitetsomkostninger: 45000, finansielleIndtaegter: 200, finansielleOmkostninger: 2400, skat: 1500,
      immaterielleAnlaeg: 2000, materielleAnlaeg: 19000, finansielleAnlaeg: 0, varelager: 32000, varedebitorer: 41000, omsaetningsaktiver: 80000, egenkapital: 35300, langfristetGaeld: 20000, kortfristetGaeld: 45700, leverandoergaeld: 29000, pengestroemPrimaerDrift: 8000 } },
    { aar: "2024", v: { omsaetning: 324000, vareforbrug: 267000, kapacitetsomkostninger: 47500, finansielleIndtaegter: 150, finansielleOmkostninger: 3000, skat: 1460,
      immaterielleAnlaeg: 2200, materielleAnlaeg: 20000, finansielleAnlaeg: 0, varelager: 40000, varedebitorer: 45000, omsaetningsaktiver: 90000, egenkapital: 38500, langfristetGaeld: 24000, kortfristetGaeld: 49700, leverandoergaeld: 30000, pengestroemPrimaerDrift: 3000 } },
    { aar: "2025", v: { omsaetning: 340000, vareforbrug: 281000, kapacitetsomkostninger: 50000, finansielleIndtaegter: 100, finansielleOmkostninger: 3900, skat: 1140,
      immaterielleAnlaeg: 2200, materielleAnlaeg: 21000, finansielleAnlaeg: 0, varelager: 50000, varedebitorer: 50000, omsaetningsaktiver: 104000, egenkapital: 40500, langfristetGaeld: 30000, kortfristetGaeld: 56700, leverandoergaeld: 31000, pengestroemPrimaerDrift: -1000 } },
  ],
};

export const tomCase = () => ({
  navn: "", enhed: "t.kr.", profil: "", forretningsmodel: "", markedsrente: [null, null, null],
  kolonner: ["", "", "", ""].map((_, i) => ({ aar: String(new Date().getFullYear() - 4 + i), v: {} })),
});

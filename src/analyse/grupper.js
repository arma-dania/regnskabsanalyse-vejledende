// Hvilke nøgletal skrives op ad trappen hver for sig, og hvilke som gruppe?
//
// Nøgletal grupperes, når de deler forklaring (trin 2) og målestok (trin 3) –
// ellers ville samme argument blive skrevet flere gange. Trin 1 nævner
// stadig hvert nøgletal i gruppen med sine egne tal.
//
//   10-12  Kapacitetsgrad, nulpunkt og sikkerhedsmargin er matematisk samme
//          information: SM = 1 − 1/KG, nulpunkt = KO / BM.
//   13-15  Samme tæller (omsætningen); nævnerne er dele af samme helhed.
//   16-18  Ét kredsløb: lagerdage + debitordage − kreditordage.
//   23-24  Forskellen er kun varelageret – og den forskel er selv en pointe.
//   26+28  Markedets pris målt mod et regnskabstal; samme forklaring og målestok.
//
// AG, OG og AOH står hver for sig under rentabiliteten. Indtjeningsevnen
// undersøger nærmere overskudsgraden, og kapitaltilpasningen undersøger
// nærmere aktivernes omsætningshastighed.

export const GRUPPER = {
  rentabilitet: [
    { id: "ag", nrs: [1] },
    { id: "og", nrs: [2] },
    { id: "aoh", nrs: [3] },
    { id: "ekf", nrs: [4] },
    { id: "r", nrs: [5] },
    { id: "gearing", nrs: [6] },
  ],
  indtjeningsevne: [
    { id: "bm", nrs: [7] },
    { id: "indeks", nrs: [8] },
    { id: "dg", nrs: [9] },
    { id: "robusthed", titel: "Robustheden: kapacitetsgrad, nulpunktsomsætning og sikkerhedsmargin", nrs: [10, 11, 12] },
  ],
  kapital: [
    { id: "anlaeg", titel: "Anlægsaktivernes omsætningshastigheder", nrs: [13, 14, 15] },
    { id: "arbejdskapital", titel: "Arbejdskapitalen: varelager, debitorer og kreditorer", nrs: [16, 17, 18] },
    { id: "cf", nrs: [19] },
  ],
  soliditet: [
    { id: "sol", nrs: [20] },
    { id: "anlaegsgrad", nrs: [21] },
    { id: "kapbind", nrs: [22] },
    { id: "likviditet", titel: "Likviditetsgrad I og II", nrs: [23, 24] },
  ],
  boers: [
    { id: "eps", nrs: [25] },
    { id: "marked", titel: "Markedets prissætning: P/E og kurs/indre værdi", nrs: [26, 28] },
    { id: "indre", nrs: [27] },
  ],
};

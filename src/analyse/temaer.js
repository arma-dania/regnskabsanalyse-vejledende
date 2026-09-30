// Formuleringstrappen og temaerne – samme ordlyd som træningsappen
// (netlify/functions/lib/trappe.mjs i Regnskabsanalyse), så den vejledende
// besvarelse og underviseroverblikket taler samme sprog som feedbacken, de
// studerende får. Retter du dér, så ret også her.

export const TRIN = [
  { nr: 1, navn: "Konstatering", spoergsmaal: "Hvad er der sket?",
    krav: "De centrale nøgletal for området er nævnt med konkrete tal og med en rigtig angivelse af retning og størrelsesorden." },
  { nr: 2, navn: "Forklaring", spoergsmaal: "Hvorfor er det sket?",
    krav: "Udviklingen føres tilbage til en årsag, der kan belægges i områdets nøgletal, i regnskabet eller i beretningen. Fortsætter årsagskæden i et andet område, er en henvisning nok." },
  { nr: 3, navn: "Vurdering", spoergsmaal: "Er det godt eller skidt – målt mod hvad?",
    krav: "Vurderingen er holdt op mod en navngivet målestok: sidste år, markedsrenten, en tommelfingerregel eller forretningsmodellen." },
  { nr: 4, navn: "Forretningsmodellen", spoergsmaal: "Hvad betyder det for måden, virksomheden tjener penge på – og hvad skal ledelsen gøre?",
    krav: "Konklusionen siger noget om forretningsmodellens holdbarhed og ender i en anbefaling, der følger af de tal, der er analyseret." },
];

export const TEMAER = [
  { id: "kun-tal", navn: "Gengiver tal uden at læse dem" },
  { id: "manglende-aarsag", navn: "Konstaterer uden at forklare årsagen" },
  { id: "aarsag-forvekslet", navn: "Bytter årsag og virkning om" },
  { id: "ingen-maalestok", navn: "Vurderer uden at holde tallet op mod noget" },
  { id: "noegletal-misforstaaet", navn: "Misforstår, hvad nøgletallet måler" },
  { id: "sammenhaeng-ubrugt", navn: "Bruger ikke sammenhængen mellem nøgletallene" },
  { id: "paastand-uden-tal", navn: "Påstår uden at pege på tallene" },
  { id: "beretning-ukritisk", navn: "Tager ledelsens forklaring for pålydende" },
  { id: "tommelfingerregel", navn: "Læner sig på en tommelfingerregel uden at forstå den" },
  { id: "forretningsmodel-ubrugt", navn: "Kobler ikke tallene til forretningsmodellen" },
  { id: "uklar-formulering", navn: "Uklar formulering gør argumentet svært at følge" },
];

export const TEMANAVN = Object.fromEntries(TEMAER.map(t => [t.id, t.navn]));

// Målestokkene til trin 3 – ét sted, så de kan rettes uden at røre analysen.
//
// Fire slags målestok, som aftalt: sidste år, markedsrenten, tommelfinger-
// reglerne for soliditet og likviditet, og forretningsmodellen. Branchetal
// bruges ikke – de er for svære at skaffe pålideligt.

/* ---------------------- Markedsrenten ---------------------- */
// Den 10-årige danske statsobligation. Omkring 24. september 2026 lå den på
// ca. 3,4 % – den højeste siden 2011. Renten tastes pr. analyseår i appen;
// tallet her er kun forslaget, når intet er tastet. Opdatér det, når renten
// flytter sig, og brug helst årets gennemsnit for de ældre analyseår.
export const MARKEDSRENTE_FORSLAG = 3.4;
export const MARKEDSRENTE_NAVN = "10-årig dansk statsobligation";

/* ---------------------- Tommelfingerregler ---------------------- */
// grænse: tallet, der skal holdes; retning: "min" (mindst) eller "max" (højst).
// komfort: et niveau, hvor der er god luft (valgfrit).
export const TOMMELFINGERREGLER = {
  20: {
    grænse: 30, retning: "min",
    tekst: "En soliditetsgrad på mindst 30 % regnes normalt for tilfredsstillende.",
    hvorfor: "Kan aktiverne tabe 30 % af deres værdi, før kreditorerne rammes, har virksomheden en buffer mod tab og kan låne på rimelige vilkår.",
  },
  22: {
    grænse: 1, retning: "max",
    tekst: "Kapitalbindingsgraden bør højst være 1: anlægsaktiverne skal være finansieret af langfristet kapital.",
    hvorfor: "Langvarige aktiver skal finansieres med penge, der ikke skal betales tilbage inden for et år – ellers skal gælden refinansieres løbende.",
  },
  23: {
    grænse: 100, retning: "min",
    tekst: "Likviditetsgrad I bør være mindst 100 %.",
    hvorfor: "Omsætningsaktiverne uden lageret – dem, der hurtigt bliver til penge – skal kunne dække den gæld, der forfalder inden for et år.",
  },
  24: {
    grænse: 150, komfort: 200, retning: "min",
    tekst: "Likviditetsgrad II bør være mindst 150 %, gerne omkring 200 %.",
    hvorfor: "Lageret tager tid at sælge og sælges måske ikke til bogført værdi. Derfor kræves en større overdækning, når lageret tælles med.",
  },
};

/* ---------------------- Væsentlighed ---------------------- */
// Hvornår en ændring er værd at nævne på trin 1. En regel, ikke et skøn:
// procentnøgletal i procentpoint, de øvrige i procent af udgangsværdien.
export const VAESENTLIG = { procentpoint: 0.5, relativ: 5 };

/* ---------------------- Forretningsmodeller ---------------------- */
// Typiske nøgletal pr. forretningsmodel. Tallene er fra profilerne i
// "Gæt forretningsmodellen" (arma-dania/Forretningsmodellen), så de
// studerende møder de samme billeder igen. De er typiske niveauer, ikke
// facit: en virksomhed kan godt ligge anderledes og have en god grund.
//
// bm = bruttomargin, og = overskudsgrad, aoh = aktivernes oms.hastighed,
// al = anlægsgrad, lager = varelagerets oms.hastighed (null = intet lager),
// deb = varedebitorernes oms.hastighed, sol = soliditetsgrad.
// kendetegn = det, der afslører modellen i tallene.
export const PROFILER = [
  { id: "konsulent", navn: "Konsulenthus / rådgivning", v: { bm: 85, og: 11, aoh: 1.9, al: 8, lager: null, deb: 6.5, sol: 45 },
    kendetegn: "Meget høj bruttomargin, fordi der næsten intet vareforbrug er – omkostningerne er løn og dermed kapacitetsomkostninger. Høj driftsmæssig gearing. Få anlægsaktiver, intet lager, og kunderne får kredit (lav debitoromsætningshastighed)." },
  { id: "producent", navn: "Producent med egen fabrik", v: { bm: 48, og: 7, aoh: 0.85, al: 52, lager: 2.4, deb: 7.3, sol: 48 },
    kendetegn: "Tung balance: høj anlægsgrad og lav aktivernes omsætningshastighed. Stort varelager med råvarer, varer i arbejde og færdigvarer. Kunder er forhandlere, der får kredit. Rentabiliteten skal hentes i overskudsgraden." },
  { id: "saas", navn: "Softwarevirksomhed (SaaS)", v: { bm: 88, og: 18, aoh: 0.7, al: 60, lager: null, deb: 20, sol: 55 },
    kendetegn: "Meget høj bruttomargin og høj overskudsgrad, når kundebasen er bygget. Høj anlægsgrad af immaterielle aktiver (aktiveret udvikling). Intet lager. Abonnement betales forud, så debitorerne er små." },
  { id: "webshop", navn: "Online forhandler", v: { bm: 17, og: 2.8, aoh: 3.4, al: 6, lager: 9, deb: 90, sol: 28 },
    kendetegn: "Lav bruttomargin og lav overskudsgrad – modellen tjener på volumen. Høj aktivernes omsætningshastighed, næsten ingen anlægsaktiver, hurtigt lager og kunder, der betaler ved køb." },
  { id: "supermarked", navn: "Supermarkeds- eller discountkæde", v: { bm: 21, og: 3.3, aoh: 2.7, al: 52, lager: 17, deb: 190, sol: 36 },
    kendetegn: "Lav margin, meget hurtigt lager og kontantsalg (næsten ingen debitorer). Butikkerne giver en høj anlægsgrad. Leverandørerne finansierer en stor del af lageret – derfor er en lav likviditetsgrad normal her." },
  { id: "grossist", navn: "Grossist", v: { bm: 18, og: 3, aoh: 2.4, al: 12, lager: 6.5, deb: 8, sol: 32 },
    kendetegn: "Lav bruttomargin og lav overskudsgrad. Få anlægsaktiver, men meget kapital bundet i lager og i debitorer, fordi erhvervskunderne får kredit." },
  { id: "brand", navn: "Brand via forhandlere (produktion hos underleverandører)", v: { bm: 45, og: 9, aoh: 1.7, al: 10, lager: 3, deb: 5.5, sol: 45 },
    kendetegn: "Høj bruttomargin fra brandet, men få anlægsaktiver, fordi produktionen er lagt ud. Langsomt lager (sæsonvarer) og forhandlere, der får kredit." },
  { id: "specialbutik", navn: "Specialbutikskæde", v: { bm: 55, og: 6, aoh: 1.6, al: 30, lager: 2.2, deb: 150, sol: 40 },
    kendetegn: "Høj bruttomargin, men høje kapacitetsomkostninger til butikker og personale (høj driftsmæssig gearing, lav sikkerhedsmargin). Langsomt lager, kontantsalg." },
  { id: "abonnement-fysisk", navn: "Abonnement med fysisk levering", v: { bm: 35, og: 2, aoh: 3, al: 35, lager: 40, deb: 200, sol: 22 },
    kendetegn: "Meget hurtigt lager (friske varer), kunder betaler forud (ingen debitorer), lav overskudsgrad og lav soliditet i vækstfasen." },
];

export const findProfil = id => PROFILER.find(p => p.id === id) ?? null;

// Profilens nøgler svarer til disse nøgletal. Lager og debitorer i profilerne
// er omsætningshastigheder, ligesom nøgletal 16 og 17.
export const PROFILNOEGLE = { bm: 7, og: 2, aoh: 3, al: 21, lager: 16, deb: 17, sol: 20 };

/** Holder et tal op mod profilens niveau: "lavere", "på linje" eller "højere". */
export function modProfil(vaerdi, profilVaerdi) {
  if (vaerdi == null || profilVaerdi == null) return null;
  const forhold = vaerdi / profilVaerdi;
  if (forhold < 0.75) return "lavere";
  if (forhold > 1.33) return "højere";
  return "på linje";
}

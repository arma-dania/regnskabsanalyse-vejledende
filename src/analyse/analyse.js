// Analysemotoren. Skriver hvert nøgletal – eller hver gruppe af nøgletal, der
// hører sammen (se grupper.js) – op ad formuleringstrappen:
//
//   Trin 1 Konstatering – hvad er der sket? Tal, retning og størrelse.
//   Trin 2 Forklaring   – hvorfor? Tællerens og nævnerens udvikling og
//                         sammenhængen til andre nøgletal.
//   Trin 3 Vurdering    – målt mod hvad? Sidste år, markedsrenten,
//                         tommelfingerregler eller forretningsmodellen.
//
// Trin 4 (forretningsmodellen) skrives i den samlede konklusion, fordi det
// først kan gøres, når alle nøgletal er læst.
//
// Ingen AI her. Alt er deterministisk, og hver sætning bygger på tal, der står
// i nøgletalstabellen eller i regnskabet i analyseform.

import { OMRAADER, NT, regnCase, formatNt, formatAendring, formatGraense, fmtPct, fmtPpU, fmtX, fmtBeloeb } from "./beregning.js";
import { BESTEMT, stort, konstater, vaesentlig, verbum, dage, aendringsprocent, fmtAendringsprocent } from "./tekst.js";
import { TOMMELFINGERREGLER, MARKEDSRENTE_FORSLAG, MARKEDSRENTE_NAVN, findProfil, PROFILNOEGLE, modProfil } from "./maalestok.js";
import { TEMANAVN } from "./temaer.js";
import { GRUPPER } from "./grupper.js";

const PROFILNAVN = { bm: "bruttomargin", og: "overskudsgrad", aoh: "aktivernes omsætningshastighed", al: "anlægsgrad", lager: "varelagerets omsætningshastighed", deb: "varedebitorernes omsætningshastighed", sol: "soliditetsgrad" };
const DETAILHANDEL = ["supermarked", "abonnement-fysisk"];

/**
 * kase: regnskabet og målestokkene (se fraDataset.js).
 * noegletal: nøgletalsappens egne tal pr. år – dem skrives analysen ud fra.
 */
export function analyser(kase, noegletal = null) {
  const beregnet = regnCase(kase, noegletal);
  const aar = beregnet.map(b => b.aar);
  const serie = nr => beregnet.map(b => b.n[nr]);
  const rente = [0, 1, 2].map(i => {
    const x = kase.markedsrente?.[i];
    return x == null || x === "" || !Number.isFinite(Number(x)) ? MARKEDSRENTE_FORSLAG : Number(x);
  });
  const ctx = {
    kase, beregnet, aar, serie, rente,
    sidst: nr => serie(nr)[2],
    V: beregnet.map(b => b.mellem.v),
    M: beregnet.map(b => b.mellem),
    profil: findProfil(kase.profil),
    enh: kase.enhed || "",
    udbytte: kase.udbytte || [{}, {}, {}],
    beretning: kase.beretning || "",
    brugCitater: kase.brugCitater !== false,
    faldgruber: [],
  };

  const omraader = {};
  for (const o of OMRAADER) {
    const grupper = GRUPPER[o.id]
      .filter(g => g.nrs.some(nr => serie(nr).some(x => x != null)))
      .map(g => {
        ctx.gruppe = { omraade: o.id, gruppe: g.id };
        const t = SKRIV[g.id](ctx, g);
        return {
          id: g.id, nrs: g.nrs,
          titel: g.titel || NT[g.nrs[0]].navn,
          trin1: ren(t.trin1), trin2: ren(t.trin2), trin3: ren(t.trin3),
          noegle: [
            ...g.nrs.filter(nr => serie(nr)[2] != null).map(nr => `${NT[nr].navn}: ${serie(nr).map(x => formatNt(nr, x, ctx.enh)).join(" → ")}`),
            ...(g.id === "sol" && ctx.udbytte.some(u => u?.foreslaaet != null) ? [`Udbytte for året: ${ctx.udbytte.map(u => fmtBeloeb(u?.foreslaaet, ctx.enh)).join(" → ")}`] : []),
            ...(g.id === "sol" && ctx.udbytte.some(u => u?.betalt) ? [`Udbytte betalt i året: ${ctx.udbytte.map(u => fmtBeloeb(u?.betalt, ctx.enh)).join(" → ")}`] : []),
          ],
          // Ledelsens egne ord om netop dette nøgletal – til trin 2, og til
          // at holde op mod tallene.
          beretning: ctx.brugCitater ? citater(ctx.beretning, g.id) : [],
        };
      });
    omraader[o.id] = {
      navn: o.navn,
      indledning: ren([INDLEDNING[o.id]?.(ctx)])[0] || "",
      grupper,
      delkonklusion: grupper.length ? ren([OMRAADE_KONKLUSION[o.id](ctx).filter(Boolean).join(" ")])[0] || "" : "",
      ikkeRelevant: o.id === "boers" && !grupper.length,
      // De afkrydsede indekstal står under indtjeningsevnen sammen med nr. 8.
      ekstraTabel: o.id === "indtjeningsevne" ? (kase.indekstal || []).map(x => ({
        navn: `Indekstal – ${x.navn}`, tekst: x.serie.map(v => (v == null ? "–" : fmtX(v, 0))),
        pct: fmtAendringsprocent(aendringsprocent(x.serie)) || "–",
      })) : [],
      tabel: o.nrs.map(nr => ({
        nr, navn: NT[nr].navn, vaerdier: serie(nr),
        tekst: serie(nr).map(x => formatNt(nr, x, ctx.enh)),
        aendring: [formatAendring(nr, serie(nr)[0], serie(nr)[1]), formatAendring(nr, serie(nr)[1], serie(nr)[2])],
        // Fra første til sidste år – som "Ændring i %" i nøgletalsappen.
        pct: fmtAendringsprocent(aendringsprocent(serie(nr))) || "–",
      })),
    };
  }
  ctx.gruppe = { omraade: "konklusion", gruppe: "konklusion" };
  const konklusion = konkluder(ctx);
  const pointer = vejledningsPointer(ctx, omraader);

  return {
    navn: kase.navn || "Virksomheden",
    aar, enhed: ctx.enh, rente, profil: ctx.profil,
    forretningsmodel: kase.forretningsmodel || "",
    beregnet, omraader, konklusion, pointer,
    faldgruber: ctx.faldgruber,
    beretning: ctx.beretning,
    brugCitater: ctx.brugCitater,
    udbytte: ctx.udbytte,
    skoen: beregnet.some(b => b.mellem.skoen),
  };
}

/* ====================== Hjælpere ====================== */

// Fjerner tomme sætninger og dobbelt punktum efter en forkortelse ("t.kr..").
const ren = liste => liste.filter(Boolean).map(s => s.replace(/\.\.(\s|$)/g, ".$1"));

const vaekst = (a, b) => (a == null || b == null || !a ? null : ((b - a) / Math.abs(a)) * 100);

/** "omsætningen voksede 13,3 %" – eller "var stort set uændret". */
function udv(navn, a, b) {
  const g = vaekst(a, b);
  if (g == null) return null;
  if (Math.abs(g) < 1) return `${navn} var stort set uændret`;
  return `${navn} ${g > 0 ? "voksede" : "faldt"} ${fmtPct(Math.abs(g))}`;
}

/** Udviklingen i en post fra første til sidste analyseår. */
const postUdv = (ctx, key, navn) => udv(navn, ctx.V[0][key], ctx.V[2][key]);

/** "steg fra 3,0 % til 2,6 %" for et nøgletal over hele perioden. */
function nt(ctx, nr) {
  const s = ctx.serie(nr);
  if (s[0] == null || s[2] == null) return null;
  const f = x => formatNt(nr, x, ctx.enh);
  if (!vaesentlig(nr, s[0], s[2])) return `${BESTEMT[nr]} var stort set uændret (${f(s[0])} → ${f(s[2])})`;
  return `${BESTEMT[nr]} ${verbum(s[0], s[2])} fra ${f(s[0])} til ${f(s[2])}`;
}

/** "Den lavere bruttomargin trækker overskudsgraden ned." – kun ved en væsentlig ændring. */
function traekker(ctx, nr, hvad, op, ned) {
  const s = ctx.serie(nr);
  if (s[0] == null || s[2] == null || !vaesentlig(nr, s[0], s[2])) return null;
  return s[2] > s[0] ? `${op} trækker ${hvad} op.` : `${ned} trækker ${hvad} ned.`;
}

// Hvad det betyder, at en post vokser hurtigere (eller langsommere) end
// omsætningen – så indekstallet forbindes med de andre nøgletal.
const INDEKS_BETYDNING = [
  [/^(varelager|varedebitorer|andreTilgodehavender|anlaegsaktiver|materielleAnlaeg|immaterielleAnlaeg|finansielleAnlaeg|omsaetningsaktiver|aktiverIAlt)$/,
    ", så der bindes mere kapital pr. omsat krone – det trækker aktivernes omsætningshastighed ned", ", så der bindes mindre kapital pr. omsat krone – det trækker aktivernes omsætningshastighed op"],
  [/^(vareforbrug)$/, ", så bruttomarginen presses", ", så bruttomarginen forbedres"],
  [/^(personaleomkostninger|andreEksterne|afskrivninger|kapacitetsomkostninger)$/, ", så kapacitetsomkostningerne fylder mere og presser overskudsgraden", ", så kapacitetsomkostningerne fylder mindre og løfter overskudsgraden"],
  [/^(bruttoresultat|resultatPrimaerDrift|resultatFoerSkat|aaretsResultat)$/, ", så væksten er rentabel", ", så væksten ikke er rentabel"],
  [/^(egenkapital)$/, ", hvilket styrker soliditeten", ", hvilket svækker soliditeten"],
  [/^(leverandoergaeld|andenKortfristetGaeld|kortfristetGaeld|langfristetGaeld)$/, ", så en større del af væksten er finansieret med fremmedkapital", ", så en mindre del af væksten er finansieret med fremmedkapital"],
];
function indeksBetydning(key, hurtigere) {
  const m = INDEKS_BETYDNING.find(([re]) => re.test(key));
  return m ? (hurtigere ? m[1] : m[2]) : "";
}

/** Sætter delsætninger sammen: "a, mens b." */
const saetning = (...dele) => {
  const d = dele.filter(Boolean);
  if (!d.length) return null;
  const s = d.length === 1 ? d[0] : `${d.slice(0, -1).join(", ")}, mens ${d[d.length - 1]}`;
  return stort(s) + ".";
};

const mellemPer = (ctx, key) => [ctx.M[0][key], ctx.M[2][key]];

const trin1 = (ctx, nrs) => nrs.map(nr => konstater(nr, ctx.serie(nr), ctx.aar, ctx.enh));

function faldgrube(ctx, tema, forventet, spoergsmaal, svar) {
  ctx.faldgruber.push({ ...ctx.gruppe, tema, temaNavn: TEMANAVN[tema] || tema, forventet, spoergsmaal, svar });
}

/** Trin 3 mod sidste år – ud fra nøgletallets "bedre"-retning. */
function sidsteAar(ctx, nr) {
  const s = ctx.serie(nr);
  if (s[1] == null || s[2] == null) return null;
  const f = x => formatNt(nr, x, ctx.enh);
  if (!vaesentlig(nr, s[1], s[2]))
    return `Målt mod sidste år er ${BESTEMT[nr]} stabil (${f(s[1])} → ${f(s[2])})` +
      (s[0] != null && vaesentlig(nr, s[0], s[2]) ? `, men over hele perioden er ${BESTEMT[nr]} ${s[2] > s[0] ? "steget" : "faldet"} fra ${f(s[0])} i ${ctx.aar[0]}.` : ".");
  const bedre = NT[nr].bedre;
  if (bedre === "neutral") return `Målt mod sidste år ${verbum(s[1], s[2])} ${BESTEMT[nr]} (${f(s[1])} → ${f(s[2])}); om det er godt eller skidt, afhænger af de øvrige målestokke.`;
  const god = (s[2] > s[1]) === (bedre === "op");
  let t = `Målt mod sidste år er udviklingen ${god ? "positiv" : "negativ"}: ${BESTEMT[nr]} ${verbum(s[1], s[2])} fra ${f(s[1])} til ${f(s[2])}.`;
  if (s[0] != null && vaesentlig(nr, s[0], s[2]) && Math.sign(s[2] - s[0]) !== Math.sign(s[2] - s[1]))
    t += ` Over hele perioden er ${BESTEMT[nr]} dog ${s[2] > s[0] ? "steget" : "faldet"} (${f(s[0])} i ${ctx.aar[0]}).`;
  return t;
}

function profilSaetning(ctx, noegle) {
  const p = ctx.profil;
  if (!p) return null;
  const nr = PROFILNOEGLE[noegle];
  const v = ctx.sidst(nr);
  const pv = p.v[noegle];
  if (noegle === "lager" && pv == null)
    return v == null ? null : `En ${p.navn.toLowerCase()} har typisk intet varelager af betydning; her omsættes lageret ${fmtX(v)} gange om året, og det kræver en forklaring.`;
  const dom = modProfil(v, pv);
  if (!dom) return null;
  const fv = formatNt(nr, v), fp = formatNt(nr, pv);
  if (dom === "på linje") return `Målt mod forretningsmodellen (${p.navn.toLowerCase()}, typisk ${PROFILNAVN[noegle]} ${fp}) ligger ${BESTEMT[nr]} på ${fv} på linje med det normale.`;
  return `Målt mod forretningsmodellen (${p.navn.toLowerCase()}, typisk ${PROFILNAVN[noegle]} ${fp}) er ${BESTEMT[nr]} på ${fv} markant ${dom} end normalt.`;
}

function tommelfinger(ctx, nr) {
  const regel = TOMMELFINGERREGLER[nr];
  const v = ctx.sidst(nr);
  if (!regel || v == null) return null;
  const fv = formatNt(nr, v);
  const fg = formatGraense(nr, regel.grænse);
  const holder = regel.retning === "min" ? v >= regel.grænse : v <= regel.grænse;
  let s = holder
    ? `${stort(BESTEMT[nr])} på ${fv} i ${ctx.aar[2]} overholder tommelfingerreglen (${regel.retning === "min" ? "mindst" : "højst"} ${fg}).`
    : `${stort(BESTEMT[nr])} på ${fv} i ${ctx.aar[2]} ligger ${regel.retning === "min" ? "under" : "over"} tommelfingerreglen på ${fg}.`;
  if (holder && regel.komfort && v < regel.komfort) s += ` Der er dog et stykke op til de ${formatGraense(nr, regel.komfort)}, der giver god luft.`;
  return s;
}

function markedsrenten(ctx, nr, over, under) {
  const v = ctx.sidst(nr), mr = ctx.rente[2];
  if (v == null) return null;
  const grundlag = `markedsrenten (${MARKEDSRENTE_NAVN}, ${fmtPct(mr)} i ${ctx.aar[2]})`;
  return v >= mr ? over(fmtPpU(v - mr), grundlag, v - mr) : under(fmtPpU(v - mr), grundlag, v - mr);
}

/** Udbyttet for de år, det kendes, og hvor stor en del af årets resultat det er. */
function udbytteSaetninger(ctx) {
  const ud = [];
  ctx.udbytte.forEach((u, i) => {
    const res = ctx.V[i]?.aaretsResultat;
    if (u?.foreslaaet == null) return;
    ud.push(res > 0
      ? `For ${ctx.aar[i]} er der foreslået et udbytte på ${fmtBeloeb(u.foreslaaet, ctx.enh)}, svarende til ${fmtPct((u.foreslaaet / res) * 100)} af årets resultat.`
      : `For ${ctx.aar[i]} er der foreslået et udbytte på ${fmtBeloeb(u.foreslaaet, ctx.enh)}, selv om årets resultat var ${fmtBeloeb(res, ctx.enh)}.`);
  });
  // Betalt udbytte i året – typisk det, der blev foreslået for året før.
  // Det er det, der trækker egenkapitalen ned i året.
  ctx.udbytte.forEach((u, i) => {
    if (!u?.betalt) return;
    const res = ctx.V[i]?.aaretsResultat, foer = i > 0 ? ctx.udbytte[i - 1]?.foreslaaet : null;
    ud.push(`I ${ctx.aar[i]} blev der udbetalt ${fmtBeloeb(u.betalt, ctx.enh)} i udbytte${foer ? `, som blev foreslået for ${ctx.aar[i - 1]}` : ""}.` +
      (res != null && u.betalt > res ? ` Det er mere end årets resultat på ${fmtBeloeb(res, ctx.enh)}, så egenkapitalen falder.` : ""));
  });
  const betaltSidst = ctx.udbytte[2]?.betalt, resSidst = ctx.V[2]?.aaretsResultat;
  if (betaltSidst && resSidst != null && betaltSidst > resSidst)
    faldgrube(ctx, "manglende-aarsag",
      `Der er udbetalt ${fmtBeloeb(betaltSidst, ctx.enh)} i udbytte i ${ctx.aar[2]} – mere end årets resultat. Studerende forklarer faldet i soliditeten uden at nævne udbyttet, eller tror, at det er årets eget udbytte.`,
      "Hvad står der i egenkapitalopgørelsen? Hvornår blev udbyttet foreslået, og hvornår blev det betalt?",
      `Udbyttet blev ${ctx.udbytte[1]?.foreslaaet ? `foreslået for ${ctx.aar[1]} og ` : ""}betalt i ${ctx.aar[2]}. Det forklarer, at egenkapitalen falder, selv om årets resultat er positivt.`);
  const sidst = ctx.udbytte[2]?.foreslaaet, res = ctx.V[2]?.aaretsResultat;
  if (sidst != null && res != null && sidst > res)
    faldgrube(ctx, "manglende-aarsag",
      `Udbyttet for ${ctx.aar[2]} er større end årets resultat. Studerende forklarer udviklingen i egenkapitalen og soliditeten uden at nævne udbyttet.`,
      "Hvor er overskuddet blevet af? Se resultatdisponeringen og egenkapitalopgørelsen.",
      `Udbyttet på ${fmtBeloeb(sidst, ctx.enh)} overstiger årets resultat på ${fmtBeloeb(res, ctx.enh)}, så egenkapitalen tappes.`);
  else if (sidst != null)
    faldgrube(ctx, "manglende-aarsag",
      "Studerende forklarer soliditeten med resultatet alene og overser, at en del af overskuddet udloddes som udbytte.",
      "Hvor meget af årets resultat bliver i virksomheden?",
      `Udbyttet på ${fmtBeloeb(sidst, ctx.enh)} forlader virksomheden, når det udbetales.`);
  return ud;
}

/**
 * Soliditeten efter udbetaling af det foreslåede udbytte. Efter
 * årsregnskabsloven står det foreslåede udbytte i egenkapitalen ved årets
 * udgang; når det udbetales, falder både egenkapitalen og aktiverne.
 */
function efterUdbytte(ctx) {
  const u = ctx.udbytte[2]?.foreslaaet, v = ctx.V[2];
  if (u == null || v.egenkapital == null || !v.aktiverIAlt) return null;
  const efter = ((v.egenkapital - u) / (v.aktiverIAlt - u)) * 100;
  return `Når det foreslåede udbytte på ${fmtBeloeb(u, ctx.enh)} udbetales, falder soliditetsgraden fra ${fmtPct(ctx.sidst(20))} til ${fmtPct(efter)}${efter < 30 && ctx.sidst(20) >= 30 ? " – under tommelfingerreglen" : ""}.`;
}

// Fordelingen af ændringen i AG på OG og AOH (kædesubstitution). Vises ikke,
// men bruges til at sige, hvilken faktor der driver udviklingen.
function agDrivere(ctx) {
  const [og0, og2] = [ctx.serie(2)[0], ctx.serie(2)[2]];
  const [aoh0, aoh2] = [ctx.serie(3)[0], ctx.serie(3)[2]];
  if ([og0, og2, aoh0, aoh2].some(x => x == null)) return null;
  return { og: (og2 - og0) * aoh0, aoh: og2 * (aoh2 - aoh0) };
}

/* ====================== Ledelsesberetningen ====================== */

// Ord, der viser, at en sætning i beretningen handler om nøgletallet.
const NOEGLEORD = {
  ag: /afkast|forrent/i,
  og: /overskudsgrad|primær drift|driftsresultat|EBIT|indtjening/i,
  aoh: /kapitalbinding|aktiver|investeret kapital/i,
  ekf: /egenkapitalens forrentning|forrentning af egenkapital|årets resultat|overskud/i,
  r: /rente|finansielle omkostninger|finansiering/i,
  gearing: /gæld|lån|finansiering|kredit/i,
  bm: /bruttomargin|bruttoavance|avance|dækningsgrad|priser|prisstigning|råvare|indkøb|fragt/i,
  indeks: /omsætning|salg|vækst|markedsandel|efterspørgsel/i,
  dg: /omkostning|personale|medarbejder|lønninger/i,
  robusthed: /omkostning|nulpunkt|følsom|risiko/i,
  anlaeg: /investering|anlæg|fabrik|maskine|bygning|udvikling/i,
  arbejdskapital: /lager|varebeholdning|debitor|tilgodehavende|kredittid|leverandør/i,
  cf: /pengestrøm|likvid|cash/i,
  sol: /egenkapital|udbytte|soliditet|kapitalforhold|tilbagekøb/i,
  anlaegsgrad: /investering|anlæg/i,
  kapbind: /langfristet|finansiering|lån/i,
  likviditet: /likvid|kassekredit|bank|kreditfacilitet|finansiering/i,
  eps: /aktie|udbytte/i,
  marked: /aktie|kurs|marked/i,
  indre: /aktie|egenkapital/i,
};

/** Op til to sætninger fra beretningen, der handler om nøgletallet – helst med tal. */
function citater(beretning, id) {
  const re = NOEGLEORD[id];
  if (!beretning || !re) return [];
  return beretning
    // Ny sætning kun, når næste ord begynder med stort – så "8 mio. kr." ikke deles.
    .split(/(?<=[.!?])\s+(?=[A-ZÆØÅ»«"])|\n+/)
    .map(x => x.trim())
    .filter(x => x.length >= 30 && x.length <= 400 && re.test(x))
    .sort((a, b) => /\d/.test(b) - /\d/.test(a))
    .slice(0, 2);
}

/* ====================== Trappen pr. nøgletal og gruppe ====================== */

const SKRIV = {
  /* ---------- Rentabilitet ---------- */

  ag(ctx) {
    const d = agDrivere(ctx);
    const s = ctx.serie(1), og = ctx.serie(2), aoh = ctx.serie(3);
    const t2 = [`Afkastningsgraden er overskudsgraden gange aktivernes omsætningshastighed. ${saetning(nt(ctx, 2), nt(ctx, 3)) ?? ""}`.trim()];
    if (d && vaesentlig(1, s[0], s[2])) {
      const driver = Math.abs(d.og) >= Math.abs(d.aoh) ? "og" : "aoh";
      t2.push(driver === "og"
        ? "Udviklingen kommer primært fra overskudsgraden – altså fra indtjeningen på hver omsat krone. Hvorfor overskudsgraden har udviklet sig sådan, undersøges nærmere under indtjeningsevnen."
        : "Udviklingen kommer primært fra omsætningshastigheden – altså fra, hvor effektivt kapitalen udnyttes. Hvorfor omsætningshastigheden har udviklet sig sådan, undersøges nærmere under kapitaltilpasningen.");
      const mindre = driver === "og" ? d.aoh : d.og;
      if (Math.sign(mindre) === Math.sign(d.og + d.aoh) && Math.abs(mindre) >= Math.abs(d.og + d.aoh) / 4)
        faldgrube(ctx, "sammenhaeng-ubrugt",
          `Både overskudsgraden og omsætningshastigheden trækker afkastningsgraden samme vej. Forvent, at de studerende kun nævner ${driver === "og" ? "overskudsgraden" : "omsætningshastigheden"}.`,
          "Afkastningsgraden er OG × AOH. Hvad er der sket med hver af de to faktorer?",
          saetning(nt(ctx, 2), nt(ctx, 3)));
    } else if (d && vaesentlig(2, og[0], og[2]) && vaesentlig(3, aoh[0], aoh[2])) {
      t2.push("De to faktorer har trukket i hver sin retning og har stort set udlignet hinanden.");
    }
    const p = ctx.profil, ag = ctx.sidst(1);
    const typisk = p ? p.v.og * p.v.aoh : null;
    const m = p && ag != null ? modProfil(ag, typisk) : null;
    return {
      trin1: trin1(ctx, [1]),
      trin2: t2,
      trin3: [
        sidsteAar(ctx, 1),
        markedsrenten(ctx, 1,
          (pp, g) => `Målt mod ${g} forrenter driften kapitalen ${pp} bedre end en risikofri placering.`,
          (pp, g) => `Målt mod ${g} forrenter driften kapitalen ${pp} dårligere end en risikofri statsobligation – det er ikke holdbart på sigt.`),
        m ? `En typisk ${p.navn.toLowerCase()} har en overskudsgrad omkring ${fmtPct(p.v.og)} og en omsætningshastighed omkring ${fmtX(p.v.aoh)}, dvs. en afkastningsgrad omkring ${fmtPct(typisk)}; virksomhedens ${fmtPct(ag)} ligger ${m === "på linje" ? "på linje med det" : `${m} end det`}.` : null,
      ],
    };
  },

  og(ctx) {
    const [ko0, ko2] = mellemPer(ctx, "koAndel");
    return {
      trin1: trin1(ctx, [2]),
      trin2: [
        saetning(postUdv(ctx, "resultatPrimaerDrift", "resultatet af primær drift"), postUdv(ctx, "omsaetning", "omsætningen")),
        ko0 != null && ko2 != null && nt(ctx, 7)
          ? `Overskudsgraden er bruttomarginen fratrukket kapacitetsomkostningerne i procent af omsætningen: ${nt(ctx, 7)}, og kapacitetsomkostningerne gik fra ${fmtPct(ko0)} til ${fmtPct(ko2)} af omsætningen. Hvorfor, undersøges nærmere under indtjeningsevnen.`
          : null,
      ],
      trin3: [sidsteAar(ctx, 2), profilSaetning(ctx, "og")],
    };
  },

  aoh(ctx) {
    const b0 = ctx.M[0].binding, b2 = ctx.M[2].binding;
    const NAVN = { anlaeg: "anlægsaktiverne", varelager: "varelageret", debitorer: "varedebitorerne" };
    const poster = Object.keys(NAVN).filter(k => b0[k] != null && b2[k] != null)
      .map(k => ({ k, a: b0[k], b: b2[k], d: b2[k] - b0[k] })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
    const [gA0, gA2] = mellemPer(ctx, "gA");
    return {
      trin1: trin1(ctx, [3]),
      trin2: [
        saetning(postUdv(ctx, "omsaetning", "omsætningen"), udv("de gennemsnitlige aktiver", gA0, gA2)),
        poster.length && Math.abs(poster[0].d) >= 1
          ? `Pr. 100 kr. omsætning er den største ændring i ${NAVN[poster[0].k]}: fra ${fmtX(poster[0].a, 0)} til ${fmtX(poster[0].b, 0)} kr. (ultimo). Hvorfor, undersøges nærmere under kapitaltilpasningen.`
          : null,
      ],
      trin3: [sidsteAar(ctx, 3), profilSaetning(ctx, "aoh")],
    };
  },

  ekf(ctx) {
    const [ek0, ek2] = mellemPer(ctx, "gEK");
    const ag = ctx.sidst(1), r = ctx.sidst(5);
    const s4 = ctx.serie(4), s1 = ctx.serie(1);
    const drivere = [nt(ctx, 1), nt(ctx, 5), nt(ctx, 6)].filter(Boolean);
    const t2 = [
      saetning(postUdv(ctx, "aaretsResultat", "årets resultat"), udv("den gennemsnitlige egenkapital", ek0, ek2)),
      drivere.length ? `Egenkapitalens forrentning afhænger af afkastningsgraden, fremmedkapitalens forrentning og gearingen: ${drivere.join(", ")}.` : null,
    ];
    if (ag != null && r != null)
      t2.push(ag >= r
        ? `Da afkastningsgraden (${fmtPct(ag)}) ligger over fremmedkapitalens forrentning (${fmtPct(r)}), løfter gearingen egenkapitalens forrentning over afkastningsgraden.`
        : `Da afkastningsgraden (${fmtPct(ag)}) ligger under fremmedkapitalens forrentning (${fmtPct(r)}), trækker gearingen egenkapitalens forrentning ned under afkastningsgraden.`);
    if (s4[0] != null && s1[0] != null && vaesentlig(4, s4[0], s4[2]) && (!vaesentlig(1, s1[0], s1[2]) || Math.sign(s4[2] - s4[0]) !== Math.sign(s1[2] - s1[0])))
      faldgrube(ctx, "aarsag-forvekslet",
        `Egenkapitalens forrentning ${verbum(s4[0], s4[2])}, men afkastningsgraden fulgte ikke med. Forvent forklaringen "EKF ${verbum(s4[0], s4[2])}, fordi driften gik ${s4[2] > s4[0] ? "bedre" : "dårligere"}".`,
        "Hvad skete der med fremmedkapitalens forrentning og med gearingen?",
        [nt(ctx, 5), nt(ctx, 6)].filter(Boolean).join("; ") + ".");
    return {
      trin1: trin1(ctx, [4]),
      trin2: t2,
      trin3: [
        sidsteAar(ctx, 4),
        markedsrenten(ctx, 4,
          (pp, g, x) => x >= 3
            ? `Målt mod ${g} får ejerne ${pp} mere end ved en risikofri placering – en rimelig betaling for at bære risikoen i virksomheden.`
            : `Målt mod ${g} får ejerne kun ${pp} mere end ved en risikofri placering – en lille betaling for at bære risikoen i virksomheden.`,
          (pp, g) => `Målt mod ${g} får ejerne ${pp} mindre end ved en risikofri placering – de får ingen betaling for risikoen.`),
      ],
    };
  },

  r(ctx) {
    const [fk0, fk2] = mellemPer(ctx, "gFK");
    const v = ctx.V[2];
    const fk = v.aktiverIAlt != null && v.egenkapital != null ? v.aktiverIAlt - v.egenkapital : null;
    const r = ctx.sidst(5), mr = ctx.rente[2];
    if (r != null && r < mr)
      faldgrube(ctx, "noegletal-misforstaaet",
        `Fremmedkapitalens forrentning (${fmtPct(r)}) ligger under markedsrenten (${fmtPct(mr)}). Studerende konkluderer, at virksomheden låner billigt.`,
        "Hvad består fremmedkapitalen af? Hvor meget af den koster rente?",
        "r er et gennemsnit over al gæld, også leverandørgæld og anden rentefri gæld. Den lave r siger mere om gældens sammensætning end om lånevilkårene.");
    return {
      trin1: trin1(ctx, [5]),
      trin2: [
        saetning(postUdv(ctx, "finansielleOmkostninger", "de finansielle omkostninger"), udv("den gennemsnitlige fremmedkapital", fk0, fk2)),
        fk && v.leverandoergaeld != null
          ? `Leverandørgælden, som normalt er rentefri, udgør ${fmtPct((v.leverandoergaeld / fk) * 100)} af fremmedkapitalen i ${ctx.aar[2]}. Jo større den andel er, jo lavere bliver fremmedkapitalens forrentning.`
          : null,
      ],
      trin3: [
        sidsteAar(ctx, 5),
        r != null ? `Målt mod markedsrenten (${MARKEDSRENTE_NAVN}, ${fmtPct(mr)}) ligger fremmedkapitalens forrentning ${fmtPpU(r - mr)} ${r >= mr ? "over" : "under"}. Fordi den er regnet på al fremmedkapital, også den rentefri, er den faktiske lånerente på den rentebærende gæld højere.` : null,
      ],
    };
  },

  gearing(ctx) {
    const [fk0, fk2] = mellemPer(ctx, "gFK");
    const [ek0, ek2] = mellemPer(ctx, "gEK");
    const ag = ctx.sidst(1), r = ctx.sidst(5), sol = ctx.sidst(20);
    return {
      trin1: trin1(ctx, [6]),
      trin2: [
        saetning(udv("den gennemsnitlige fremmedkapital", fk0, fk2), udv("den gennemsnitlige egenkapital", ek0, ek2)),
        saetning(postUdv(ctx, "langfristetGaeld", "den langfristede gæld"), postUdv(ctx, "kortfristetGaeld", "den kortfristede gæld")),
      ],
      trin3: [
        sidsteAar(ctx, 6),
        ag != null && r != null
          ? (ag >= r
            ? `Gearingen er en fordel for ejerne, så længe afkastningsgraden ligger over fremmedkapitalens forrentning. Det gør den i ${ctx.aar[2]} (${fmtPct(ag)} mod ${fmtPct(r)}), så den lånte kapital forrentes bedre, end den koster.`
            : `Gearingen er en ulempe, når afkastningsgraden ligger under fremmedkapitalens forrentning, som i ${ctx.aar[2]} (${fmtPct(ag)} mod ${fmtPct(r)}): hver lånt krone koster mere, end den tjener.`)
          : null,
        sol != null ? `Højere gearing betyder samtidig mindre buffer – se soliditetsgraden på ${fmtPct(sol)}.` : null,
      ],
    };
  },

  /* ---------- Indtjeningsevne ---------- */

  bm(ctx) {
    const vf = postUdv(ctx, "vareforbrug", "vareforbruget");
    return {
      trin1: trin1(ctx, [7]),
      trin2: [
        saetning(postUdv(ctx, "bruttoresultat", "bruttoresultatet"), postUdv(ctx, "omsaetning", "omsætningen")),
        vf ? `${stort(vf)}. En ændret bruttomargin skyldes priserne, indkøbspriserne eller varemikset – ledelsesberetningen skal vise hvilket.` : null,
        traekker(ctx, 7, "overskudsgraden", "Den højere bruttomargin", "Den lavere bruttomargin"),
      ],
      trin3: [sidsteAar(ctx, 7), profilSaetning(ctx, "bm")],
    };
  },

  indeks(ctx) {
    const ix = ctx.M.map(m => m.indeks);
    const t1 = trin1(ctx, [8]);
    if (ix[2].resultatPrimaerDrift != null) t1.push(`Til sammenligning står resultatet af primær drift i indeks ${fmtX(ix[2].resultatPrimaerDrift, 0)} i ${ctx.aar[2]}.`);
    const t2 = [];
    if (ix[2].bruttoresultat != null && ix[2].kapacitetsomkostninger != null)
      t2.push(`Med ${ctx.aar[0]} som basisår står bruttoresultatet i indeks ${fmtX(ix[2].bruttoresultat, 0)} og kapacitetsomkostningerne i indeks ${fmtX(ix[2].kapacitetsomkostninger, 0)}. ` +
        (ix[2].kapacitetsomkostninger > ix[2].bruttoresultat + 2
          ? "Omkostningerne er altså vokset hurtigere end det, salget giver i bruttoresultat."
          : ix[2].kapacitetsomkostninger < ix[2].bruttoresultat - 2
            ? "Bruttoresultatet er altså vokset hurtigere end omkostningerne."
            : "Bruttoresultat og kapacitetsomkostninger har fulgt hinanden.") +
        (ix[2].kapacitetsomkostninger > ix[2].bruttoresultat + 2
          ? " Det trækker overskudsgraden ned."
          : ix[2].kapacitetsomkostninger < ix[2].bruttoresultat - 2 ? " Det trækker overskudsgraden op." : ""));
    const t3 = [sidsteAar(ctx, 8)];
    if (ix[2].omsaetning != null && ix[2].resultatPrimaerDrift != null) {
      const rentabel = ix[2].resultatPrimaerDrift >= ix[2].omsaetning - 5;
      t3.push(rentabel
        ? "Væksten er rentabel: resultatet af primær drift er vokset mindst i takt med omsætningen."
        : "Væksten er ikke rentabel: resultatet af primær drift er ikke fulgt med omsætningen.");
      if (!rentabel && ix[2].omsaetning > 102)
        faldgrube(ctx, "kun-tal",
          `Omsætningen er vokset (indeks ${fmtX(ix[2].omsaetning, 0)}), men resultatet af primær drift er ikke fulgt med (indeks ${fmtX(ix[2].resultatPrimaerDrift, 0)}). Studerende skriver "virksomheden går godt, omsætningen stiger".`,
          "Hvad er vokset hurtigst – omsætningen eller omkostningerne? Brug indekstallene.",
          "Væksten er ikke rentabel: omkostningerne er vokset mindst lige så hurtigt som salget.");
    }
    // De indekstal, brugeren har krydset af, holdt op mod omsætningen.
    const valgte = ctx.kase.indekstal || [];
    const omsIx = ctx.kase.indeksOmsaetning || [];
    const basis = ctx.kase.indeksBasis || ctx.aar[0];
    for (const x of valgte) {
      if (x.serie.every(v => v == null)) continue;
      t1.push(`Indekstallet for ${x.navn.toLowerCase()} (${basis} = 100) er ${x.serie.map((v, i) => `${v == null ? "–" : fmtX(v, 0)} i ${ctx.aar[i]}`).join(", ")}.`);
      const s = x.serie[2], o = omsIx[2];
      if (s == null || o == null || Math.abs(s - o) < 3) continue;
      const hurtigere = s > o;
      t2.push(`${stort(x.navn.toLowerCase())} er vokset ${hurtigere ? "hurtigere" : "langsommere"} end omsætningen (indeks ${fmtX(s, 0)} mod ${fmtX(o, 0)})${indeksBetydning(x.key, hurtigere)}.`);
    }
    return { trin1: t1, trin2: t2, trin3: t3 };
  },

  dg(ctx) {
    const dg = ctx.sidst(9), sm = ctx.sidst(12);
    return {
      trin1: trin1(ctx, [9]),
      trin2: [saetning(postUdv(ctx, "kapacitetsomkostninger", "kapacitetsomkostningerne"), postUdv(ctx, "vareforbrug", "vareforbruget"))],
      trin3: [
        sidsteAar(ctx, 9),
        dg != null
          ? `En driftsmæssig gearing på ${fmtPct(dg)} betyder, at ${dg >= 40 ? "en stor" : "en mindre"} del af omkostningerne ikke følger salget. ${dg >= 40 ? "Resultatet svinger derfor kraftigt med omsætningen" : "Resultatet er derfor forholdsvis robust over for udsving i omsætningen"}${sm != null ? ` – sammenhold med sikkerhedsmarginen på ${fmtPct(sm)}` : ""}.`
          : null,
      ],
    };
  },

  robusthed(ctx) {
    const nul = nt(ctx, 11);
    const aarsager = [postUdv(ctx, "kapacitetsomkostninger", "kapacitetsomkostningerne"), nt(ctx, 7)].filter(Boolean);
    return {
      trin1: trin1(ctx, [10, 11, 12]),
      trin2: [
        "De tre nøgletal bygger på samme forhold: kapacitetsgraden er bruttoresultatet divideret med kapacitetsomkostningerne, sikkerhedsmarginen er 1 − 1/kapacitetsgraden, og nulpunktet er kapacitetsomkostningerne divideret med bruttomarginen. De flytter sig derfor sammen.",
        saetning(postUdv(ctx, "bruttoresultat", "bruttoresultatet"), postUdv(ctx, "kapacitetsomkostninger", "kapacitetsomkostningerne")),
        nul && aarsager.length ? `${stort(nul)}, fordi ${aarsager.join(", og ")}.` : null,
      ],
      trin3: [
        sidsteAar(ctx, 12),
        ctx.sidst(12) != null ? `Omsætningen kan falde ${fmtPct(ctx.sidst(12))}, før resultatet af primær drift er nul. Jo lavere sikkerhedsmargin, jo mindre skal der til, før virksomheden taber penge på driften.` : null,
      ],
    };
  },

  /* ---------- Kapitaltilpasning og pengestrømme ---------- */

  anlaeg(ctx) {
    // Er de immaterielle anlægsaktiver næsten nul, bliver deres
    // omsætningshastighed et kæmpe tal uden analytisk værdi.
    const v = ctx.V[2];
    const smaa = v.immaterielleAnlaeg != null && v.aktiverIAlt ? v.immaterielleAnlaeg / v.aktiverIAlt < 0.01 : false;
    const t1 = trin1(ctx, smaa ? [13, 15] : [13, 14, 15]);
    if (smaa && ctx.sidst(14) != null)
      t1.push(`De immaterielle anlægsaktiver er kun ${fmtBeloeb(v.immaterielleAnlaeg, ctx.enh)} (${fmtPct((v.immaterielleAnlaeg / v.aktiverIAlt) * 100)} af aktiverne) i ${ctx.aar[2]}. Deres omsætningshastighed (${formatNt(14, ctx.sidst(14), ctx.enh)}) har derfor ingen analytisk værdi og kommenteres ikke.`);
    return {
      trin1: t1,
      trin2: [
        saetning(postUdv(ctx, "omsaetning", "omsætningen"), postUdv(ctx, "anlaegsaktiver", "anlægsaktiverne")),
        saetning(postUdv(ctx, "materielleAnlaeg", "de materielle anlægsaktiver"), postUdv(ctx, "immaterielleAnlaeg", "de immaterielle anlægsaktiver")),
        "Omsætningshastighederne stiger, når salget vokser hurtigere end anlæggene, og falder, når der investeres forud for salget.",
        traekker(ctx, 13, "aktivernes omsætningshastighed", "Den bedre udnyttelse af anlæggene", "Den dårligere udnyttelse af anlæggene"),
      ],
      trin3: [sidsteAar(ctx, 13)],
    };
  },

  arbejdskapital(ctx) {
    const lager = ctx.serie(16), deb = ctx.serie(17), kred = ctx.serie(18);
    const netto = i => (lager[i] && deb[i] && kred[i] ? dage(lager[i]) + dage(deb[i]) - dage(kred[i]) : null);
    const t1 = trin1(ctx, [16, 17, 18]);
    if (netto(2) != null)
      t1.push(`Omregnet til dage i ${ctx.aar[2]}: lageret ligger i ${dage(lager[2])} dage, kunderne betaler efter ${dage(deb[2])} dage, og leverandørerne betales efter ${dage(kred[2])} dage. Pengene er dermed bundet i ${netto(2)} dage${netto(0) != null ? ` (${netto(0)} dage i ${ctx.aar[0]})` : ""}.`);
    const t2 = [
      saetning(postUdv(ctx, "varelager", "varelageret"), postUdv(ctx, "vareforbrug", "vareforbruget")),
      saetning(postUdv(ctx, "varedebitorer", "varedebitorerne"), postUdv(ctx, "omsaetning", "omsætningen")),
      saetning(postUdv(ctx, "leverandoergaeld", "leverandørgælden"), udv("varekøbet", ctx.M[0].varekoeb, ctx.M[2].varekoeb)),
    ];
    if (netto(0) != null && netto(2) != null && netto(2) !== netto(0)) {
      const dele = [["lageret", dage(lager[2]) - dage(lager[0])], ["debitorerne", dage(deb[2]) - dage(deb[0])], ["leverandørkreditten", dage(kred[0]) - dage(kred[2])]]
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      t2.push(`Bindingen er blevet ${netto(2) > netto(0) ? "længere" : "kortere"} med ${Math.abs(netto(2) - netto(0))} dage, især på grund af ${dele[0][0]} (${dele[0][1] > 0 ? "+" : "−"}${Math.abs(dele[0][1])} dage).`);
    }
    // Lager og debitorer står i aktiverne; leverandørgælden gør ikke.
    const aktivdage = i => (lager[i] && deb[i] ? dage(lager[i]) + dage(deb[i]) : null);
    if (aktivdage(0) != null && aktivdage(2) != null && Math.abs(aktivdage(2) - aktivdage(0)) >= 3)
      t2.push(aktivdage(2) > aktivdage(0)
        ? "Mere kapital bundet i varelager og debitorer pr. omsat krone trækker aktivernes omsætningshastighed ned."
        : "Mindre kapital bundet i varelager og debitorer pr. omsat krone trækker aktivernes omsætningshastighed op.");
    if (kred[0] != null && kred[2] != null && vaesentlig(18, kred[0], kred[2]))
      faldgrube(ctx, "noegletal-misforstaaet",
        `Varekreditorernes omsætningshastighed ${verbum(kred[0], kred[2])}. Her er lavere bedre for likviditeten – det vender mange om.`,
        "Hvad betyder det for virksomhedens pengekasse, når leverandørerne betales hurtigere eller langsommere?",
        `Kreditdage: ${dage(kred[0])} → ${dage(kred[2])}. ${kred[2] > kred[0] ? "Leverandørerne betales hurtigere – virksomheden får mindre gratis kredit." : "Leverandørerne betales langsommere – det frigør likviditet, men kan presse relationen."}`);
    return {
      trin1: t1,
      trin2: t2,
      trin3: [
        sidsteAar(ctx, 16), sidsteAar(ctx, 17), sidsteAar(ctx, 18),
        profilSaetning(ctx, "lager"), profilSaetning(ctx, "deb"),
        netto(0) != null && netto(2) != null && netto(2) > netto(0) ? "Den længere binding skal finansieres – se pengestrømmen fra driften og likviditeten." : null,
      ],
    };
  },

  cf(ctx) {
    const v0 = ctx.V[0], v2 = ctx.V[2];
    const ak = v => (v.varelager != null && v.varedebitorer != null ? v.varelager + v.varedebitorer - (v.leverandoergaeld ?? 0) : null);
    const cf = ctx.serie(19), og = ctx.serie(2);
    const t2 = [];
    if (v2.pengestroemPrimaerDrift != null && v2.resultatPrimaerDrift != null)
      t2.push(`I ${ctx.aar[2]} var pengestrømmen fra primær drift ${fmtBeloeb(v2.pengestroemPrimaerDrift, ctx.enh)} mod et resultat af primær drift på ${fmtBeloeb(v2.resultatPrimaerDrift, ctx.enh)}.`);
    if (ak(v0) != null && ak(v2) != null)
      t2.push(`Arbejdskapitalen (varelager + debitorer − leverandørgæld) gik fra ${fmtBeloeb(ak(v0), ctx.enh)} til ${fmtBeloeb(ak(v2), ctx.enh)}. ${ak(v2) > ak(v0) ? "Når arbejdskapitalen vokser, bindes en del af overskuddet, før det bliver til penge." : "Når arbejdskapitalen falder, frigøres penge ud over resultatet."}`);
    const betalt = ctx.udbytte[2]?.betalt;
    if (betalt != null && v2.pengestroemPrimaerDrift != null)
      t2.push(v2.pengestroemPrimaerDrift > 0
        ? `I ${ctx.aar[2]} blev der betalt ${fmtBeloeb(betalt, ctx.enh)} i udbytte, svarende til ${fmtPct((betalt / v2.pengestroemPrimaerDrift) * 100)} af pengestrømmen fra driften.`
        : `I ${ctx.aar[2]} blev der betalt ${fmtBeloeb(betalt, ctx.enh)} i udbytte, selv om driften ikke skabte penge – udbyttet er altså finansieret af likvider eller gæld.`);
    if (og[0] != null && cf[0] != null && og[2] > og[0] && cf[2] < cf[0] - 0.5)
      faldgrube(ctx, "paastand-uden-tal",
        "Overskudsgraden er steget, mens pengestrømmen fra driften i procent af omsætningen er faldet. Studerende nøjes med resultatopgørelsen.",
        "Er overskuddet blevet til penge? Hvor er pengene blevet af?",
        "Se arbejdskapitalen: kapitalen er bundet i lager og debitorer.");
    return {
      trin1: trin1(ctx, [19]),
      trin2: t2,
      trin3: [
        sidsteAar(ctx, 19),
        cf[2] != null && og[2] != null
          ? (cf[2] < 0
            ? `Målt mod overskudsgraden (${fmtPct(og[2])}) er det et faresignal: driften skaber ikke penge, og væksten må finansieres med gæld eller egenkapital.`
            : cf[2] >= og[2] - 1
              ? `Målt mod overskudsgraden (${fmtPct(og[2])}) bliver overskuddet til penge.`
              : `Målt mod overskudsgraden (${fmtPct(og[2])}) bliver kun en del af overskuddet til penge.`)
          : null,
      ],
    };
  },

  /* ---------- Soliditet og likviditet ---------- */

  sol(ctx) {
    const v0 = ctx.V[0], v2 = ctx.V[2];
    const s = ctx.serie(20);
    const t2 = [saetning(postUdv(ctx, "egenkapital", "egenkapitalen"), postUdv(ctx, "aktiverIAlt", "balancen"))];
    const resultater = ctx.V.slice(1).map(v => v.aaretsResultat);
    if (v0.egenkapital != null && v2.egenkapital != null && resultater.every(x => x != null)) {
      const dEK = v2.egenkapital - v0.egenkapital, sumRes = resultater[0] + resultater[1];
      const kendt = ctx.udbytte.some(u => u?.foreslaaet != null || u?.betalt != null);
      t2.push(`Egenkapitalen ${dEK >= 0 ? "voksede" : "faldt"} ${fmtBeloeb(Math.abs(dEK), ctx.enh)} fra ${ctx.aar[0]} til ${ctx.aar[2]}, mens årets resultat i ${ctx.aar[1]} og ${ctx.aar[2]} var ${fmtBeloeb(sumRes, ctx.enh)} i alt.` +
        (Math.abs(sumRes - dEK) <= Math.abs(sumRes) * 0.05
          ? " Overskuddet er altså stort set blevet i virksomheden."
          : kendt ? ` Forskellen på ${fmtBeloeb(sumRes - dEK, ctx.enh)} skyldes især udbyttet til ejerne.` : ` Forskellen på ${fmtBeloeb(sumRes - dEK, ctx.enh)} er typisk udbytte til ejerne.`));
    }
    t2.push(...udbytteSaetninger(ctx));
    const gEK = vaekst(v0.egenkapital, v2.egenkapital);
    if (s[0] != null && s[2] < s[0] && vaesentlig(20, s[0], s[2]) && gEK > 0)
      faldgrube(ctx, "noegletal-misforstaaet",
        `Egenkapitalen er vokset, men soliditetsgraden er faldet. Studerende skriver, at "egenkapitalen er blevet mindre".`,
        "Hvad er vokset hurtigst – egenkapitalen eller balancen? Hvordan er væksten finansieret?",
        saetning(postUdv(ctx, "egenkapital", "egenkapitalen"), postUdv(ctx, "aktiverIAlt", "balancen")));
    return {
      trin1: trin1(ctx, [20]),
      trin2: t2,
      trin3: [tommelfinger(ctx, 20), sidsteAar(ctx, 20), efterUdbytte(ctx), profilSaetning(ctx, "sol")],
    };
  },

  anlaegsgrad(ctx) {
    return {
      trin1: trin1(ctx, [21]),
      trin2: [saetning(postUdv(ctx, "anlaegsaktiver", "anlægsaktiverne"), postUdv(ctx, "omsaetningsaktiver", "omsætningsaktiverne"))],
      trin3: [
        profilSaetning(ctx, "al"),
        "Anlægsgraden er hverken god eller dårlig i sig selv; den fortæller, hvor tung balancen er, og dermed hvor meget langfristet kapital virksomheden har brug for.",
      ],
    };
  },

  kapbind(ctx) {
    const lk = v => (v.egenkapital == null ? null : v.egenkapital + (v.langfristetGaeld ?? 0));
    const kb = ctx.sidst(22);
    return {
      trin1: trin1(ctx, [22]),
      trin2: [
        saetning(postUdv(ctx, "anlaegsaktiver", "anlægsaktiverne"), udv("den langfristede kapital (egenkapital og langfristet gæld)", lk(ctx.V[0]), lk(ctx.V[2]))),
        kb != null ? (kb <= 1
          ? "Anlægsaktiverne er fuldt finansieret af langfristet kapital, og en del af den langfristede kapital finansierer også omsætningsaktiver."
          : "En del af anlægsaktiverne er finansieret med kortfristet gæld.") : null,
      ],
      trin3: [tommelfinger(ctx, 22), sidsteAar(ctx, 22)],
    };
  },

  likviditet(ctx) {
    const s1 = ctx.serie(23), s2 = ctx.serie(24);
    const t1 = trin1(ctx, [23, 24]);
    if (s1[2] != null && s2[2] != null)
      t1.push(`Forskellen mellem de to – varelageret – svarer til ${fmtX(s2[2] - s1[2], 1)} procentpoint i ${ctx.aar[2]}.`);
    const uden = v => (v.omsaetningsaktiver == null ? null : v.omsaetningsaktiver - (v.varelager ?? 0));
    const lg = ctx.sidst(23);
    const detail = DETAILHANDEL.includes(ctx.profil?.id);
    const t3 = [tommelfinger(ctx, 23), tommelfinger(ctx, 24), sidsteAar(ctx, 23)];
    if (lg != null && lg < 100 && detail) {
      t3.push(`For en ${ctx.profil.navn.toLowerCase()} er en likviditetsgrad under 100 % normal: kunderne betaler kontant eller forud, mens leverandørerne giver kredit. Tommelfingerreglen skal læses med forretningsmodellen for øje.`);
      faldgrube(ctx, "tommelfingerregel",
        `Likviditetsgrad I (${fmtPct(lg)}) er under 100 %. Studerende konkluderer, at virksomheden har likviditetsproblemer.`,
        "Hvordan betaler kunderne, og hvornår betaler virksomheden sine leverandører? Hvorfor er grænsen 100 %?",
        "Med kontantsalg og leverandørkredit binder driften ingen kapital i debitorer – en lav likviditetsgrad er en del af forretningsmodellen, ikke et faresignal.");
    } else if (lg != null && lg < 100) {
      faldgrube(ctx, "tommelfingerregel",
        `Likviditetsgrad I er under 100 %. Studerende skriver "likviditeten er dårlig" uden at spørge, hvorfor grænsen er 100 %.`,
        "Hvad skal omsætningsaktiverne uden lager kunne dække – og er der andre veje til penge (kassekredit, pengestrøm fra driften)?",
        "Grænsen handler om at kunne betale den kortfristede gæld; vurder den sammen med pengestrømmen fra driften.");
    }
    const lagerUdv = postUdv(ctx, "varelager", "varelageret");
    const stoerre = s1[0] != null && s2[0] != null && s1[2] != null && s2[2] != null ? (s2[2] - s1[2]) > (s2[0] - s1[0]) : null;
    return {
      trin1: t1,
      trin2: [
        saetning(udv("omsætningsaktiverne uden varelager", uden(ctx.V[0]), uden(ctx.V[2])), postUdv(ctx, "kortfristetGaeld", "den kortfristede gæld")),
        lagerUdv && stoerre != null ? `${stort(lagerUdv)}, og derfor hviler en ${stoerre ? "større" : "mindre"} del af betalingsevnen på, at lageret kan sælges.` : null,
      ],
      trin3: t3,
    };
  },

  /* ---------- Børsrelaterede nøgletal ---------- */

  eps(ctx) {
    return {
      trin1: trin1(ctx, [25]),
      trin2: [saetning(postUdv(ctx, "aaretsResultat", "årets resultat"), postUdv(ctx, "antalAktier", "antallet af aktier"))],
      trin3: [sidsteAar(ctx, 25)],
    };
  },

  marked(ctx) {
    const pe = ctx.sidst(26), ki = ctx.sidst(28), mr = ctx.rente[2];
    return {
      trin1: trin1(ctx, [26, 28]),
      trin2: [
        saetning(postUdv(ctx, "boerskurs", "børskursen"), nt(ctx, 25)),
        nt(ctx, 27) ? `${stort(nt(ctx, 27))}.` : null,
        "Når kursen stiger mere end indtjeningen og egenkapitalen, er det markedets forventninger til fremtiden, der er steget – og omvendt.",
      ],
      trin3: [
        pe != null && pe > 0
          ? `Et P/E på ${fmtX(pe, 1)} svarer til et indtjeningsafkast (1/P/E) på ${fmtPct(100 / pe)}. Målt mod markedsrenten på ${fmtPct(mr)} ${100 / pe < mr ? "betaler investorerne mere, end den nuværende indtjening alene berettiger – de forventer vækst" : "er aktien prissat lavt i forhold til indtjeningen – markedet forventer ikke vækst eller ser en høj risiko"}.`
          : null,
        ki != null
          ? (ki > 1
            ? `Kurs/indre værdi på ${fmtX(ki)} betyder, at markedet værdsætter virksomheden højere end den bogførte egenkapital.`
            : `Kurs/indre værdi på ${fmtX(ki)} betyder, at markedet værdsætter virksomheden lavere end den bogførte egenkapital – et tegn på tvivl om aktivernes værdi eller den fremtidige indtjening.`)
          : null,
      ],
    };
  },

  indre(ctx) {
    return {
      trin1: trin1(ctx, [27]),
      trin2: [saetning(postUdv(ctx, "egenkapital", "egenkapitalen"), postUdv(ctx, "antalAktier", "antallet af aktier"))],
      trin3: [sidsteAar(ctx, 27)],
    };
  },
};

/* ====================== Delkonklusioner ====================== */

// Én delkonklusion pr. analyseområde, der samler trapperne: hvad er sket,
// hvorfor, og er det godt eller skidt? Den bygges af sætningerne nedenfor –
// én pr. nøgletal eller gruppe – og er byggestenen til den samlede konklusion.

/** "forbedret" / "forringet" / "stabil" – eller "steget" / "faldet" for neutrale nøgletal. */
function bevaegelse(ctx, nr) {
  const s = ctx.serie(nr);
  if (s[0] == null || s[2] == null) return null;
  if (!vaesentlig(nr, s[0], s[2])) return "stabil";
  if (NT[nr].bedre === "neutral") return s[2] > s[0] ? "steget" : "faldet";
  return (s[2] > s[0]) === (NT[nr].bedre === "op") ? "forbedret" : "forringet";
}

const v = (ctx, nr, i = 2) => formatNt(nr, ctx.serie(nr)[i], ctx.enh);
const fraTil = (ctx, nr) => `fra ${v(ctx, nr, 0)} til ${v(ctx, nr)}`;
const er = (ctx, nr, navn) => {
  const b = bevaegelse(ctx, nr);
  if (!b) return null;
  return b === "stabil" ? `${navn} er stort set uændret over perioden (${v(ctx, nr, 0)} → ${v(ctx, nr)})` : `${navn} er ${b} ${fraTil(ctx, nr)}`;
};

const DELKONKLUSION = {
  ag(ctx) {
    const d = agDrivere(ctx), ag = ctx.sidst(1), mr = ctx.rente[2];
    if (ag == null) return null;
    const hvorfor = d && bevaegelse(ctx, 1) !== "stabil"
      ? (Math.abs(d.og) >= Math.abs(d.aoh) ? ", primært på grund af overskudsgraden" : ", primært på grund af aktivernes omsætningshastighed")
      : "";
    return `${er(ctx, 1, "Afkastningsgraden")}${hvorfor}. Driften forrenter kapitalen ${ag >= mr ? `${fmtPpU(ag - mr)} bedre end` : `${fmtPpU(ag - mr)} dårligere end`} markedsrenten, hvilket er ${ag >= mr + 2 ? "tilfredsstillende" : ag >= mr ? "et beskedent merafkast" : "ikke tilfredsstillende"}.`;
  },
  ekf(ctx) {
    const ekf = ctx.sidst(4), ag = ctx.sidst(1), r = ctx.sidst(5), mr = ctx.rente[2];
    if (ekf == null) return null;
    const gearing = ag != null && r != null ? (ag >= r ? " Gearingen løfter forrentningen, fordi afkastningsgraden ligger over lånerenten." : " Gearingen trækker forrentningen ned, fordi afkastningsgraden ligger under lånerenten.") : "";
    return `${er(ctx, 4, "Egenkapitalens forrentning")}, og ejerne får ${ekf >= mr ? `${fmtPpU(ekf - mr)} mere` : `${fmtPpU(ekf - mr)} mindre`} end markedsrenten.${gearing}`;
  },
  r(ctx) {
    const r = ctx.sidst(5), mr = ctx.rente[2];
    if (r == null) return null;
    return `${er(ctx, 5, "Fremmedkapitalens forrentning")} og ligger ${r >= mr ? "over" : "under"} markedsrenten; den reelle lånerente er højere, fordi en del af gælden er rentefri.`;
  },
  gearing(ctx) {
    const ag = ctx.sidst(1), r = ctx.sidst(5);
    if (ctx.sidst(6) == null) return null;
    return `${er(ctx, 6, "Den finansielle gearing")}. ${ag != null && r != null ? (ag >= r ? "Den er en fordel for ejerne, så længe afkastningsgraden ligger over lånerenten, men mindsker bufferen mod tab." : "Den er en ulempe, fordi afkastningsgraden ligger under lånerenten.") : ""}`.trim();
  },
  og(ctx) {
    const [ko0, ko2] = mellemPer(ctx, "koAndel");
    const bm = ctx.serie(7);
    if (ctx.sidst(2) == null) return null;
    let hvorfor = "";
    if (bm[0] != null && ko0 != null && bevaegelse(ctx, 2) !== "stabil")
      hvorfor = Math.abs(bm[2] - bm[0]) >= Math.abs(ko2 - ko0)
        ? `, primært fordi bruttomarginen er ${bm[2] > bm[0] ? "steget" : "faldet"}`
        : `, primært fordi kapacitetsomkostningerne ${ko2 > ko0 ? "fylder mere" : "fylder mindre"} i forhold til omsætningen`;
    const p = profilDom(ctx, "og");
    return `${er(ctx, 2, "Overskudsgraden")}${hvorfor}.${p ? ` Den ligger ${p} for forretningsmodellen.` : ""}`;
  },
  bm(ctx) {
    if (ctx.sidst(7) == null) return null;
    const p = profilDom(ctx, "bm");
    const g = vaekst(ctx.V[0].bruttoresultat, ctx.V[2].bruttoresultat), o = vaekst(ctx.V[0].omsaetning, ctx.V[2].omsaetning);
    const hvorfor = g != null && o != null && bevaegelse(ctx, 7) !== "stabil"
      ? `, fordi bruttoresultatet er vokset ${g > o ? "hurtigere" : "langsommere"} end omsætningen`
      : "";
    return `${er(ctx, 7, "Bruttomarginen")}${hvorfor}.${p ? ` Den ligger ${p} for forretningsmodellen.` : ""}`;
  },
  indeks(ctx) {
    const ix = ctx.M[2].indeks;
    if (ix.omsaetning == null) return null;
    const rentabel = ix.resultatPrimaerDrift == null ? null : ix.resultatPrimaerDrift >= ix.omsaetning - 5;
    return `Omsætningen står i indeks ${fmtX(ix.omsaetning, 0)}${rentabel == null ? "." : rentabel ? ", og væksten er rentabel." : `, men resultatet af primær drift kun i indeks ${fmtX(ix.resultatPrimaerDrift, 0)} – væksten er ikke rentabel.`}`;
  },
  dg(ctx) {
    const dg = ctx.sidst(9);
    if (dg == null) return null;
    return `${er(ctx, 9, "Den driftsmæssige gearing")}; med ${dg >= 40 ? "en høj" : "en lav"} andel faste omkostninger er resultatet ${dg >= 40 ? "følsomt" : "forholdsvis robust"} over for fald i omsætningen.`;
  },
  robusthed(ctx) {
    const sm = ctx.sidst(12);
    if (sm == null) return null;
    return `Robustheden er ${bevaegelse(ctx, 12) === "stabil" ? "uændret" : bevaegelse(ctx, 12)}: omsætningen kan falde ${fmtPct(sm)}, før driften giver underskud${ctx.serie(12)[0] != null ? `, mod ${fmtPct(ctx.serie(12)[0])} i ${ctx.aar[0]}` : ""}.`;
  },
  aoh(ctx) {
    if (ctx.sidst(3) == null) return null;
    const b0 = ctx.M[0].binding, b2 = ctx.M[2].binding;
    const NAVN = { anlaeg: "anlægsaktiverne", varelager: "varelageret", debitorer: "debitorerne" };
    const stoerst = Object.keys(NAVN).filter(k => b0[k] != null && b2[k] != null).sort((a, b) => Math.abs(b2[b] - b0[b]) - Math.abs(b2[a] - b0[a]))[0];
    const p = profilDom(ctx, "aoh");
    return `${er(ctx, 3, "Aktivernes omsætningshastighed")}${stoerst && bevaegelse(ctx, 3) !== "stabil" ? `, især på grund af kapitalbindingen i ${NAVN[stoerst]}` : ""}.${p ? ` Den ligger ${p} for forretningsmodellen.` : ""}`;
  },
  anlaeg(ctx) {
    if (ctx.sidst(13) == null) return null;
    const b = bevaegelse(ctx, 13);
    return `Anlæggene udnyttes ${b === "forbedret" ? "bedre" : b === "forringet" ? "dårligere" : "stort set som før"}: hver krone i anlægsaktiver giver ${v(ctx, 13)} kr. i omsætning mod ${v(ctx, 13, 0)} kr. i ${ctx.aar[0]}.`;
  },
  arbejdskapital(ctx) {
    const l = ctx.serie(16), d = ctx.serie(17), k = ctx.serie(18);
    const netto = i => (l[i] && d[i] && k[i] ? dage(l[i]) + dage(d[i]) - dage(k[i]) : null);
    if (netto(2) == null) return `${er(ctx, 16, "Varelagerets omsætningshastighed") || er(ctx, 17, "Varedebitorernes omsætningshastighed") || ""}.`;
    const n0 = netto(0), n2 = netto(2);
    return `Pengene er bundet i driften i ${n2} dage${n0 != null ? ` mod ${n0} dage i ${ctx.aar[0]}` : ""}. ${n0 == null || Math.abs(n2 - n0) < 3 ? "Kapitaltilpasningen er stort set uændret." : n2 > n0 ? "Kapitalen er dårligere tilpasset aktiviteten, og det skal finansieres." : "Kapitalen er bedre tilpasset aktiviteten, og det frigør penge."}`;
  },
  cf(ctx) {
    const cf = ctx.sidst(19), og = ctx.sidst(2);
    if (cf == null) return null;
    return `${er(ctx, 19, "Pengestrømmen fra driften i procent af omsætningen")}. ${cf < 0 ? "Driften skaber ikke penge – et faresignal." : og != null && cf < og - 1 ? "Kun en del af overskuddet bliver til penge." : "Overskuddet bliver til penge."}`;
  },
  sol(ctx) {
    const sol = ctx.sidst(20);
    if (sol == null) return null;
    const u = ctx.udbytte[2]?.foreslaaet;
    const b = ctx.udbytte[2]?.betalt;
    return `${er(ctx, 20, "Soliditetsgraden")} og ligger ${sol >= 30 ? "over" : "under"} tommelfingerreglen på 30 %.${b && bevaegelse(ctx, 20) === "forringet" ? ` Faldet skyldes især udbyttet på ${fmtBeloeb(b, ctx.enh)}, der blev betalt i ${ctx.aar[2]}.` : ""}${u != null ? ` Det foreslåede udbytte på ${fmtBeloeb(u, ctx.enh)} svækker den yderligere, når det udbetales.` : ""}`;
  },
  anlaegsgrad(ctx) {
    if (ctx.sidst(21) == null) return null;
    const b = bevaegelse(ctx, 21);
    const p = profilDom(ctx, "al");
    return `Balancen er blevet ${b === "steget" ? "tungere" : b === "faldet" ? "lettere" : "hverken tungere eller lettere"} (anlægsgrad ${v(ctx, 21)}).${p ? ` Anlægsgraden ligger ${p} for forretningsmodellen.` : ""}`;
  },
  kapbind(ctx) {
    const kb = ctx.sidst(22);
    if (kb == null) return null;
    return `Anlægsaktiverne er ${kb <= 1 ? "fuldt finansieret med langfristet kapital" : "delvist finansieret med kortfristet gæld"} (kapitalbindingsgrad ${v(ctx, 22)}), hvilket ${kb <= 1 ? "er betryggende" : "giver en refinansieringsrisiko"}.`;
  },
  likviditet(ctx) {
    const lg1 = ctx.sidst(23), lg2 = ctx.sidst(24);
    if (lg1 == null && lg2 == null) return null;
    const detail = DETAILHANDEL.includes(ctx.profil?.id);
    return `${er(ctx, 23, "Likviditetsgrad I") || er(ctx, 24, "Likviditetsgrad II")}. ${lg1 != null && lg1 < 100 ? (detail ? "Den er under 100 %, men det er normalt for forretningsmodellen." : "Den kortfristede gæld kan ikke dækkes uden at sælge af lageret.") : "Den kortfristede gæld kan dækkes af de mest likvide aktiver."}`;
  },
  eps(ctx) { return ctx.sidst(25) == null ? null : `${er(ctx, 25, "Resultatet pr. aktie")}.`; },
  marked(ctx) {
    const ki = ctx.sidst(28);
    return ki == null ? null : `Markedet værdsætter virksomheden ${ki > 1 ? "højere" : "lavere"} end den bogførte egenkapital (kurs/indre værdi ${v(ctx, 28)}).`;
  },
  indre(ctx) { return ctx.sidst(27) == null ? null : `${er(ctx, 27, "Den indre værdi pr. aktie")}.`; },
};

// Indtjeningsevnen og kapitaltilpasningen er ikke selvstændige: de undersøger
// nærmere de to faktorer i afkastningsgraden. Det siges i indledningen.
const INDLEDNING = {
  indtjeningsevne(ctx) {
    const og = nt(ctx, 2);
    return `Indtjeningsevnen undersøger nærmere overskudsgraden fra rentabilitetsanalysen${og ? ` – ${og}` : ""}. Overskudsgraden er bruttomarginen fratrukket kapacitetsomkostningerne i procent af omsætningen. Bruttomarginen, indekstallene, den driftsmæssige gearing og robustheden viser derfor, hvorfor overskudsgraden har udviklet sig, som den har.`;
  },
  kapital(ctx) {
    const aoh = nt(ctx, 3);
    return `Kapitaltilpasningen undersøger nærmere aktivernes omsætningshastighed fra rentabilitetsanalysen${aoh ? ` – ${aoh}` : ""}. Omsætningshastigheden afhænger af, hvor meget kapital der er bundet i anlæg, varelager og debitorer i forhold til omsætningen. Anlæggenes omsætningshastigheder og arbejdskapitalen viser derfor, hvorfor aktivernes omsætningshastighed har udviklet sig, som den har.`;
  },
};

// Hvilke sætninger delkonklusionen for hvert område bygges af. Under
// indtjeningsevnen og kapitaltilpasningen står forklaringen af henholdsvis
// overskudsgraden og aktivernes omsætningshastighed først.
const OMRAADE_KONKLUSION = {
  rentabilitet: ctx => [DELKONKLUSION.ag(ctx), DELKONKLUSION.ekf(ctx)],
  indtjeningsevne: ctx => [DELKONKLUSION.og(ctx), DELKONKLUSION.indeks(ctx), DELKONKLUSION.robusthed(ctx)],
  kapital: ctx => [DELKONKLUSION.aoh(ctx), DELKONKLUSION.arbejdskapital(ctx), DELKONKLUSION.cf(ctx)],
  soliditet: ctx => [DELKONKLUSION.sol(ctx), DELKONKLUSION.kapbind(ctx), DELKONKLUSION.likviditet(ctx)],
  boers: ctx => [DELKONKLUSION.eps(ctx), DELKONKLUSION.marked(ctx)],
};

/**
 * Den samlede konklusion på tværs af de fem analyseområder. Den bygger kun
 * på nøgletallene og de faste målestokke (sidste år, markedsrenten og
 * tommelfingerreglerne) og står derfor, uanset om der er valgt en
 * forretningsmodel. Tre afsnit: udviklingen og dens årsager, ejernes
 * forrentning, og risikoen.
 */
function samletKonklusion(ctx, navn) {
  const utenProfil = t => (t || "").replace(/\s*(Den|Anlægsgraden) ligger [^.]* for forretningsmodellen\./g, "");
  const ag = ctx.serie(1), mr = ctx.rente[2];
  if (ag[2] == null) return [];
  const b = bevaegelse(ctx, 1), sol = ctx.sidst(20);
  const over = ag[2] >= mr;
  const retning = b === "forbedret" && over ? "positiv" : b === "forringet" || !over ? (b === "forbedret" || (b === "stabil" && over) ? "blandet" : "negativ") : "stabil";
  const tekst = {
    positiv: "positiv: driften forrenter kapitalen bedre end før og over markedsrenten",
    negativ: `negativ: ${b === "forringet" ? "driften forrenter kapitalen dårligere end før" : "driften forrenter kapitalen stort set som før"}${over ? ", selv om den stadig ligger over markedsrenten" : " og under markedsrenten"}`,
    blandet: `blandet: ${over ? "driften forrenter kapitalen over markedsrenten" : "afkastningsgraden er forbedret, men ligger under markedsrenten"}${sol != null && sol < 30 ? ", men soliditeten er under tommelfingerreglen" : ""}`,
    stabil: "stabil: driften forrenter kapitalen stort set som før og over markedsrenten",
  }[retning];
  const aarsag = [ctx.sidst(2) != null ? utenProfil(DELKONKLUSION.og(ctx)) : null, ctx.sidst(3) != null ? utenProfil(DELKONKLUSION.aoh(ctx)) : null];
  return ren([
    [`Samlet set er udviklingen i ${navn} fra ${ctx.aar[0]} til ${ctx.aar[2]} ${tekst}.`, DELKONKLUSION.ag(ctx), ...aarsag, DELKONKLUSION.indeks(ctx), DELKONKLUSION.robusthed(ctx)].filter(Boolean).join(" "),
    [DELKONKLUSION.ekf(ctx)].filter(Boolean).join(" "),
    [DELKONKLUSION.sol(ctx), DELKONKLUSION.kapbind(ctx), DELKONKLUSION.likviditet(ctx), ctx.sidst(19) != null ? DELKONKLUSION.cf(ctx) : null].filter(Boolean).join(" "),
  ].filter(Boolean));
}

/* ====================== Underviseroverblikket ====================== */

// Til underviseren: de vigtigste pointer og sammenhænge i hvert område – og
// kæden, der binder områderne sammen. Kun tal fra analysen; ingen profil.

const lille = t => (t ? t[0].toLowerCase() + t.slice(1) : t);
const farveFor = b => (b === "forbedret" ? "op" : b === "forringet" ? "ned" : "");
const pil = (ctx, nr) => {
  const b = bevaegelse(ctx, nr);
  return b === "stabil" ? "→" : ctx.serie(nr)[2] > ctx.serie(nr)[0] ? "↑" : "↓";
};

function vejledningsPointer(ctx, omraader) {
  const utenProfil = t => (t || "").replace(/\s*(Den|Anlægsgraden) ligger [^.]* for forretningsmodellen\./g, "");
  const har = nr => ctx.sidst(nr) != null && ctx.serie(nr)[0] != null;
  const ag = ctx.sidst(1), ekf = ctx.sidst(4), r = ctx.sidst(5), g = ctx.sidst(6), mr = ctx.rente[2];

  const d = agDrivere(ctx);
  const driver = d ? (Math.abs(d.og) >= Math.abs(d.aoh) ? "overskudsgraden" : "aktivernes omsætningshastighed") : null;
  const [ko0, ko2] = mellemPer(ctx, "koAndel");
  const bm = ctx.serie(7);
  const lager = ctx.serie(16), deb = ctx.serie(17), kred = ctx.serie(18);
  const netto = i => (lager[i] && deb[i] && kred[i] ? dage(lager[i]) + dage(deb[i]) - dage(kred[i]) : null);
  const ekSaetning = omraader.soliditet?.grupper.find(x => x.id === "sol")?.trin2.find(t => /^Egenkapitalen (faldt|voksede) .* i alt\./.test(t));

  // To kæder, hvor hvert led forklarer det næste:
  //   Rentabiliteten: OG × AOH → AG → EKF (gearingen er forbindelsen).
  //   Risikoen: resultat − udbytte → egenkapital → soliditet, og
  //             arbejdskapital + pengestrøm → likviditet.
  const nt_led = (nr, navn) => (har(nr) ? { navn, fra: v(ctx, nr, 0), til: v(ctx, nr), pil: pil(ctx, nr), farve: farveFor(bevaegelse(ctx, nr)) } : null);
  const beloebLed = (navn, a0, a2, godOp) => (a0 == null || a2 == null ? null : {
    navn, fra: fmtBeloeb(a0, ctx.enh), til: fmtBeloeb(a2, ctx.enh),
    pil: Math.abs(a2 - a0) <= Math.abs(a0) * 0.02 ? "→" : a2 > a0 ? "↑" : "↓",
    farve: godOp == null || Math.abs(a2 - a0) <= Math.abs(a0) * 0.02 ? "" : (a2 > a0) === godOp ? "op" : "ned",
  });
  const V0 = ctx.V[0], V2 = ctx.V[2];
  // Kun udbytte i de to år, egenkapitalens udvikling fra første til sidste
  // år dækker; udbytte betalt i det første år ligger før perioden.
  const betalt = ctx.udbytte.slice(1).map(u => u?.betalt || 0).reduce((x, y) => x + y, 0);
  const foreslaaet = ctx.udbytte.slice(0, 2).map(u => u?.foreslaaet || 0).reduce((x, y) => x + y, 0);
  const udbLed = betalt || foreslaaet ? { navn: betalt ? "Udbytte betalt i perioden" : "Udbytte foreslået i perioden", fra: "", til: fmtBeloeb(betalt || foreslaaet, ctx.enh), pil: "", farve: "" } : null;
  const dageLed = netto(0) != null && netto(2) != null ? { navn: "Pengene bundet i driften", fra: `${netto(0)} dage`, til: `${netto(2)} dage`, pil: Math.abs(netto(2) - netto(0)) < 3 ? "→" : netto(2) > netto(0) ? "↑" : "↓", farve: Math.abs(netto(2) - netto(0)) < 3 ? "" : netto(2) > netto(0) ? "ned" : "op" } : null;

  const kaeder = [
    {
      id: "rentabilitet", titel: "Rentabiliteten: hvad tjener kapitalen?",
      led: [nt_led(2, "Overskudsgrad"), nt_led(3, "× Aktivernes omsætningshastighed"), nt_led(1, "= Afkastningsgrad"), nt_led(4, "Egenkapitalens forrentning")].filter(Boolean),
      forbindelser: [
        har(1) && har(2) && har(3) ? `OG × AOH = AG: ${nt(ctx, 2)}, og ${nt(ctx, 3)}.${driver && bevaegelse(ctx, 1) !== "stabil" ? ` Det er især ${driver}, der har flyttet afkastningsgraden.` : ""}` : null,
        ekf != null && ag != null && r != null ? `AG → EKF: ejerne får ${ekf >= ag ? "mere" : "mindre"} end afkastningsgraden (${fmtPct(ekf)} mod ${fmtPct(ag)}), fordi den lånte kapital koster ${fmtPct(r)}, hvilket er ${ag >= r ? "mindre" : "mere"} end den tjener${g != null ? `. Med en gearing på ${fmtX(g)} ${ag >= r ? "løfter" : "trækker"} gælden ejernes forrentning ${ag >= r ? "op" : "ned"}` : ""}.` : null,
      ],
    },
    {
      id: "soliditet", titel: "Soliditeten: hvad bliver i virksomheden?",
      led: [beloebLed("Årets resultat", V0.aaretsResultat, V2.aaretsResultat, true), udbLed, beloebLed("Egenkapital", V0.egenkapital, V2.egenkapital, true), nt_led(20, "Soliditetsgrad")].filter(Boolean),
      forbindelser: [
        ekSaetning ? `Resultat − udbytte → egenkapital: ${ekSaetning.replace(/^Egenkapitalen/, "egenkapitalen")}` : null,
        har(20) && V0.aktiverIAlt != null ? `Egenkapital → soliditet: soliditetsgraden er egenkapitalen i procent af aktiverne. ${saetning(postUdv(ctx, "egenkapital", "egenkapitalen"), postUdv(ctx, "aktiverIAlt", "aktiverne"))} Derfor ${bevaegelse(ctx, 20) === "stabil" ? "er soliditetsgraden stort set uændret" : `${verbum(ctx.serie(20)[0], ctx.sidst(20))} soliditetsgraden fra ${v(ctx, 20, 0)} til ${v(ctx, 20)}`}.` : null,
      ],
    },
    {
      id: "likviditet", titel: "Likviditeten: bliver overskuddet til penge?",
      led: [dageLed, nt_led(19, "Pengestrøm fra driften i % af omsætningen"), nt_led(23, "Likviditetsgrad I"), nt_led(24, "Likviditetsgrad II")].filter(Boolean),
      forbindelser: [
        netto(2) != null ? `Arbejdskapital → pengestrøm: pengene er bundet i ${netto(2)} dage${netto(0) != null ? ` mod ${netto(0)} dage i ${ctx.aar[0]}` : ""}. ${netto(0) != null && netto(2) > netto(0) + 2 ? "Når bindingen bliver længere, bliver en større del af overskuddet stående i lager og debitorer i stedet for i kassen." : netto(0) != null && netto(2) < netto(0) - 2 ? "Når bindingen bliver kortere, frigøres penge ud over overskuddet." : "Bindingen er stort set uændret."}` : null,
        har(19) ? `Pengestrøm → likviditet: ${lille(DELKONKLUSION.cf(ctx))}` : null,
        har(23) || har(24) ? `Likviditetsgraderne: ${lille(DELKONKLUSION.likviditet(ctx))}` : null,
        har(23) && har(24) && bevaegelse(ctx, 23) !== "stabil" && bevaegelse(ctx, 24) !== "stabil" && bevaegelse(ctx, 23) !== bevaegelse(ctx, 24)
          ? `${stort(nt(ctx, 23))}, men ${nt(ctx, 24)}. Forskellen på dem er varelageret: ${bevaegelse(ctx, 24) === "forbedret" ? "det er vokset, så pengene står på lageret i stedet for i kassen" : "det er faldet, så lageret dækker mindre af den kortfristede gæld"}.`
          : null,
      ],
    },
  ].map(k => ({ ...k, forbindelser: ren(k.forbindelser.filter(Boolean)) })).filter(k => k.led.length);

  const sammenhaenge = {
    rentabilitet: [
      har(1) && har(2) && har(3) ? `AG = OG × AOH: ${nt(ctx, 2)}, og ${nt(ctx, 3)}.${driver && bevaegelse(ctx, 1) !== "stabil" ? ` Det er især ${driver}, der har flyttet afkastningsgraden.` : ""}` : null,
      ag != null ? `Mod markedsrenten (${fmtPct(mr)}): driften forrenter kapitalen ${fmtPpU(ag - mr)} ${ag >= mr ? "bedre" : "dårligere"} end en risikofri placering.` : null,
      ekf != null && ag != null && r != null ? `EKF (${fmtPct(ekf)}) ligger ${ekf >= ag ? "over" : "under"} AG (${fmtPct(ag)}), fordi AG er ${ag >= r ? "højere" : "lavere"} end fremmedkapitalens forrentning (${fmtPct(r)})${g != null ? `; med en gearing på ${fmtX(g)} ${ag >= r ? "løfter" : "trækker"} lånt kapital ejernes forrentning ${ag >= r ? "op" : "ned"}` : ""}.` : null,
    ],
    indtjeningsevne: [
      har(2) && bm[0] != null && ko0 != null ? `OG = bruttomargin − kapacitetsomkostninger i % af omsætningen: bruttomarginen ${fraTil(ctx, 7)}, kapacitetsomkostningerne fra ${fmtPct(ko0)} til ${fmtPct(ko2)}. ${Math.abs(bm[2] - bm[0]) >= Math.abs(ko2 - ko0) ? "Bruttomarginen" : "Kapacitetsomkostningerne"} forklarer mest af udviklingen i overskudsgraden.` : null,
      DELKONKLUSION.indeks(ctx),
      [DELKONKLUSION.robusthed(ctx), har(9) ? `Den driftsmæssige gearing er ${v(ctx, 9)}.` : null].filter(Boolean).join(" ") || null,
    ],
    kapital: [
      har(3) ? utenProfil(DELKONKLUSION.aoh(ctx)) : null,
      netto(2) != null ? `Arbejdskapitalen: lager ${dage(lager[2])} + debitorer ${dage(deb[2])} − kreditorer ${dage(kred[2])} = ${netto(2)} dage${netto(0) != null ? ` (${netto(0)} dage i ${ctx.aar[0]})` : ""}. ${netto(0) != null && netto(2) > netto(0) + 2 ? "Den længere binding trækker AOH ned og skal finansieres." : netto(0) != null && netto(2) < netto(0) - 2 ? "Den kortere binding trækker AOH op og frigør penge." : ""}`.trim() : null,
      har(19) ? DELKONKLUSION.cf(ctx) : null,
    ],
    soliditet: [
      ekSaetning || null,
      har(20) ? DELKONKLUSION.sol(ctx) : null,
      har(23) || har(24) ? DELKONKLUSION.likviditet(ctx) : null,
      netto(0) != null && netto(2) > netto(0) + 2 && har(23) && bevaegelse(ctx, 23) === "forringet" ? "Likviditeten hænger sammen med kapitaltilpasningen: mere kapital bundet i lager og debitorer binder de likvide midler." : null,
    ],
    boers: [DELKONKLUSION.eps(ctx), DELKONKLUSION.marked(ctx)],
  };
  const ud = {};
  for (const [id, liste] of Object.entries(sammenhaenge)) ud[id] = ren(liste.filter(Boolean));
  return {
    kaeder,
    // Hvordan kæderne hænger sammen: resultatet er bindeleddet.
    bindeled: "Rentabiliteten skaber årets resultat. Det, der ikke udloddes, bliver i egenkapitalen og styrker soliditeten. Det, der bindes i lager og debitorer, bliver ikke til penge og trækker på likviditeten.",
    sammenhaenge: ud,
  };
}

/** "på linje med det normale" / "under det normale" / "over det normale". */
function profilDom(ctx, noegle) {
  const p = ctx.profil;
  if (!p) return null;
  const m = modProfil(ctx.sidst(PROFILNOEGLE[noegle]), p.v[noegle]);
  return m == null ? null : m === "på linje" ? "på linje med det normale" : m === "lavere" ? "under det normale" : "over det normale";
}

/* ====================== Konklusionen (trin 4-udkast) ====================== */

function konkluder(ctx) {
  const { sidst, serie, rente, profil } = ctx;
  const styrker = [], svagheder = [], anbefalinger = [];
  const ag = serie(1), cf = serie(19);
  const lg1 = sidst(23), sol = sidst(20), kb = sidst(22), r = sidst(5);

  if (ag[2] != null) {
    if (ag[2] >= rente[2] + 2) styrker.push(`Driften forrenter kapitalen klart over markedsrenten (AG ${fmtPct(ag[2])} mod ${fmtPct(rente[2])}).`);
    else svagheder.push(`Afkastningsgraden (${fmtPct(ag[2])}) giver kun lidt eller intet merafkast i forhold til markedsrenten (${fmtPct(rente[2])}).`);
  }
  const d = agDrivere(ctx);
  if (d && vaesentlig(1, ag[0], ag[2])) {
    const driver = Math.abs(d.og) >= Math.abs(d.aoh) ? "og" : "aoh";
    const op = ag[2] > ag[0];
    (op ? styrker : svagheder).push(`Afkastningsgraden ${op ? "steg" : "faldt"} fra ${fmtPct(ag[0])} til ${fmtPct(ag[2])}, primært på grund af ${driver === "og" ? "overskudsgraden (indtjeningen pr. omsat krone)" : "aktivernes omsætningshastighed (kapitaludnyttelsen)"}.`);
    if (!op) {
      if (driver === "og") {
        const [ko0, ko2] = mellemPer(ctx, "koAndel");
        const dBM = (serie(7)[2] ?? 0) - (serie(7)[0] ?? 0);
        const dKO = ko0 != null && ko2 != null ? ko2 - ko0 : 0;
        anbefalinger.push(Math.abs(dBM) >= Math.abs(dKO)
          ? "Genopret bruttomarginen: se på priser, rabatter og indkøbsvilkår."
          : "Tilpas kapacitetsomkostningerne til aktiviteten – de er vokset hurtigere end omsætningen.");
      } else anbefalinger.push("Tilpas kapitalen til aktiviteten: nedbring lager og debitorer, eller få mere omsætning ud af de eksisterende anlæg.");
    }
  }
  if (cf[2] != null && cf[2] < 0) {
    svagheder.push(`Driften skaber ikke penge: pengestrømmen fra primær drift er negativ (${fmtPct(cf[2])} af omsætningen).`);
    anbefalinger.push("Frigør kapital i lager og debitorer, så væksten ikke skal finansieres med ny gæld.");
  }
  if (ag[2] != null && r != null && ag[2] < r) {
    svagheder.push(`Gearingen virker negativt: afkastningsgraden (${fmtPct(ag[2])}) er lavere end fremmedkapitalens forrentning (${fmtPct(r)}).`);
    anbefalinger.push("Så længe afkastningsgraden er lavere end lånerenten, bør gælden nedbringes frem for at øges.");
  }
  if (sol != null) (sol >= 30 ? styrker : svagheder).push(`Soliditetsgraden er ${fmtPct(sol)} (tommelfingerregel: mindst 30 %).`);
  if (sol != null && sol < 30) anbefalinger.push("Styrk egenkapitalen – fx ved at holde udbyttet tilbage – så virksomheden kan bære et dårligt år.");
  if (kb != null && kb > 1) {
    svagheder.push(`Anlægsaktiverne er delvist finansieret med kortfristet gæld (kapitalbindingsgrad ${fmtX(kb)}).`);
    anbefalinger.push("Omlæg kortfristet gæld til langfristet finansiering af anlægsaktiverne.");
  }
  if (lg1 != null && lg1 < 100 && !DETAILHANDEL.includes(profil?.id))
    svagheder.push(`Likviditetsgrad I er ${fmtPct(lg1)} – under tommelfingerreglen på 100 %.`);
  const udb = ctx.udbytte[2]?.foreslaaet, res = ctx.V[2]?.aaretsResultat;
  if (udb != null && res != null) {
    if (udb > res) {
      svagheder.push(`Udbyttet for ${ctx.aar[2]} (${fmtBeloeb(udb, ctx.enh)}) er større end årets resultat (${fmtBeloeb(res, ctx.enh)}), så egenkapitalen tappes.`);
      anbefalinger.push("Tilpas udbyttet til indtjeningen, så egenkapitalen ikke udhules.");
    } else if ((sol != null && sol < 30) || (cf[2] != null && cf[2] < 0)) {
      anbefalinger.push(`Overvej et lavere udbytte end de foreslåede ${fmtBeloeb(udb, ctx.enh)}, så kapitalen bliver i virksomheden, indtil ${sol != null && sol < 30 ? "soliditeten" : "pengestrømmen"} er genoprettet.`);
    }
  }

  const afvigelser = [];
  if (profil)
    for (const [k, nr] of Object.entries(PROFILNOEGLE)) {
      const m = modProfil(sidst(nr), profil.v[k]);
      if (m && m !== "på linje") afvigelser.push(`${PROFILNAVN[k]} ${formatNt(nr, sidst(nr))} (typisk ${formatNt(nr, profil.v[k])}) – ${m} end normalt`);
    }

  let model = "ukendt";
  if (ag[2] != null) {
    const lamper = [
      ag[0] != null && ag[2] < ag[0] - 1,
      cf[2] != null && cf[2] < 0,
      lg1 != null && lg1 < 100 && !DETAILHANDEL.includes(profil?.id),
      sol != null && sol < 30,
      r != null && ag[2] < r,
    ].filter(Boolean).length;
    model = ag[2] < rente[2] || lamper >= 2 ? "presset" : afvigelser.length >= 3 ? "under forandring" : "holder";
  }
  const navn = ctx.kase.navn || "Virksomheden";
  const tilstand = {
    holder: "tjener fortsat penge på den måde, forretningsmodellen forudsætter",
    presset: ag[2] != null && ag[2] < rente[2]
      ? "er under pres: driften forrenter ikke kapitalen bedre end en risikofri statsobligation"
      : "er under pres: driften forrenter stadig kapitalen over markedsrenten, men flere advarselslamper lyser på én gang (se svaghederne)",
    "under forandring": "ligner ikke længere den typiske virksomhed med sin forretningsmodel – modellen kan være ved at skifte",
    ukendt: "kan ikke vurderes fuldt ud, fordi der mangler tal",
  }[model];
  const udkast = [
    `${navn} ${tilstand}.`,
    ...(profil ? [afvigelser.length
      ? `Holdt op mod en typisk ${profil.navn.toLowerCase()} afviger ${afvigelser.length === 1 ? "ét nøgletal" : `${afvigelser.length} nøgletal`}: ${afvigelser.join("; ")}.`
      : `Nøgletallene ligger på linje med en typisk ${profil.navn.toLowerCase()}.`] : []),
    anbefalinger.length ? `Anbefaling til ledelsen: ${anbefalinger.join(" ")}` : "Anbefaling til ledelsen: fasthold modellen, og følg især de nøgletal, der har bevæget sig mest.",
  ];

  if (ctx.beretning && ctx.brugCitater)
    faldgrube(ctx, "beretning-ukritisk",
      "Studerende gengiver ledelsens forklaringer som kendsgerninger.",
      "Hvad siger ledelsen – og bekræfter nøgletallene det? Hvad nævner beretningen ikke?",
      "Ledelsens forklaring er en påstand, der skal holdes op mod tallene. Se citaterne fra beretningen ved hvert nøgletal.");

  faldgrube(ctx, "forretningsmodel-ubrugt",
    "Trin 4 bliver en opsummering af nøgletallene uden kobling til, hvordan virksomheden tjener penge.",
    profil ? `Hvilke nøgletal afslører, at det er en ${profil.navn.toLowerCase()}? Holder de tal stadig?` : "Tjener virksomheden penge på marginen eller på volumen? Hvad siger udviklingen i OG og AOH om det?",
    profil ? profil.kendetegn : "Konklusionen skal sige, om modellen holder, presses eller skifter, og slutte med en anbefaling, der følger af tallene.");

  return { styrker, svagheder, anbefalinger, afvigelser, model, udkast, samlet: samletKonklusion(ctx, navn) };
}

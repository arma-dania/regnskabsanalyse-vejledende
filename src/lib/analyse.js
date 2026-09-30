// Analysemotoren. Regner alt, hvad der kan regnes, og skriver det op ad
// formuleringstrappen:
//
//   Trin 1 Konstatering – hvad er der sket? (retning og størrelse)
//   Trin 2 Forklaring   – hvorfor? (DuPont, EKF-formlen, dekomposition)
//   Trin 3 Vurdering    – målt mod hvad? (sidste år, markedsrenten,
//                         tommelfingerregler, forretningsmodellen)
//   Trin 4 Forretningsmodellen – kun et udkast her; den endelige konklusion
//                         skrives af dig eller af Claude ud fra fundene.
//
// Ingen AI her. Alt er deterministisk og kan kontrolleres i prøverne, og hver
// sætning bygger på tal, der står i nøgletalstabellen.

import { OMRAADER, NT, regnCase, formatNt, formatAendring, formatGraense, fmtPct, fmtPp, fmtPpU, fmtX } from "./nogletal.js";
import { BESTEMT, stort, konstater, vaesentlig, verbum, dage } from "./tekst.js";
import { TOMMELFINGERREGLER, MARKEDSRENTE_FORSLAG, MARKEDSRENTE_NAVN, findProfil, PROFILNOEGLE, modProfil } from "./maalestok.js";
import { TEMANAVN } from "./temaer.js";

const PROFILNAVN = { bm: "bruttomargin", og: "overskudsgrad", aoh: "aktivernes omsætningshastighed", al: "anlægsgrad", lager: "varelagerets omsætningshastighed", deb: "varedebitorernes omsætningshastighed", sol: "soliditetsgrad" };

export function analyser(kase) {
  const beregnet = regnCase(kase);
  const aar = beregnet.map(b => b.aar);
  const serie = nr => beregnet.map(b => b.n[nr]);
  const sidst = nr => serie(nr)[2];
  const rente = [0, 1, 2].map(i => {
    const x = kase.markedsrente?.[i];
    return x == null || x === "" || !Number.isFinite(Number(x)) ? MARKEDSRENTE_FORSLAG : Number(x);
  });
  const profil = findProfil(kase.profil);
  const enh = kase.enhed || "";

  const ctx = { kase, beregnet, aar, serie, sidst, rente, profil, enh, faldgruber: [] };
  ctx.dupont = dupont(ctx);
  ctx.ekf = ekfUdvikling(ctx);
  ctx.og = ogDekomposition(ctx);
  ctx.binding = bindingUdvikling(ctx);

  const omraader = {
    rentabilitet: rentabilitet(ctx),
    indtjeningsevne: indtjeningsevne(ctx),
    kapital: kapital(ctx),
    soliditet: soliditet(ctx),
    boers: boers(ctx),
  };
  for (const o of OMRAADER) {
    omraader[o.id].navn = o.navn;
    omraader[o.id].tabel = o.nrs.map(nr => ({
      nr, navn: NT[nr].navn, vaerdier: serie(nr),
      tekst: serie(nr).map(x => formatNt(nr, x, enh)),
      aendring: [formatAendring(nr, serie(nr)[0], serie(nr)[1]), formatAendring(nr, serie(nr)[1], serie(nr)[2])],
    }));
  }

  const konklusion = konkluder(ctx, omraader);
  return {
    navn: kase.navn || "Virksomheden",
    aar, enhed: enh, rente, profil,
    forretningsmodel: kase.forretningsmodel || "",
    beregnet, omraader, konklusion,
    dupont: ctx.dupont, ekf: ctx.ekf, og: ctx.og, binding: ctx.binding,
    faldgruber: ctx.faldgruber,
    skoen: beregnet.some(b => b.mellem.skoen),
  };
}

/* ====================== Dekompositioner ====================== */

// Perioderne: år 1 → år 2 og år 2 → år 3 (indeks i beregnet).
const PERIODER = [[0, 1], [1, 2]];

/**
 * ΔAG fordelt på overskudsgrad og omsætningshastighed ved kædesubstitution:
 * først skiftes OG ud (med sidste års AOH), derefter AOH (med nyt OG).
 * Summen går præcist op, fordi AG = OG × AOH.
 */
function dupont({ beregnet, aar }) {
  return PERIODER.map(([a, b]) => {
    const [og0, og1] = [beregnet[a].n[2], beregnet[b].n[2]];
    const [aoh0, aoh1] = [beregnet[a].n[3], beregnet[b].n[3]];
    const [ag0, ag1] = [beregnet[a].n[1], beregnet[b].n[1]];
    if ([og0, og1, aoh0, aoh1, ag0, ag1].some(x => x == null)) return null;
    return {
      fra: aar[a], til: aar[b], ag0, ag1, og0, og1, aoh0, aoh1,
      dAG: ag1 - ag0,
      ogEffekt: (og1 - og0) * aoh0,
      aohEffekt: og1 * (aoh1 - aoh0),
    };
  });
}

/**
 * ΔEKF (efter skat) fordelt på AG, fremmedkapitalens forrentning, gearing,
 * øvrige finansielle poster og skat. EKF før skat = AG·(1+G) − r·G, så
 * kædesubstitution i rækkefølgen AG → r → G går præcist op.
 */
function ekfUdvikling({ beregnet, aar }) {
  const afst = beregnet.map(b => b.mellem.ekf);
  const perioder = PERIODER.map(([a, b]) => {
    const e0 = afst[a], e1 = afst[b];
    if (!e0 || !e1 || e0.efterSkat == null || e1.efterSkat == null) return null;
    return {
      fra: aar[a], til: aar[b],
      dEKF: e1.efterSkat - e0.efterSkat,
      agEffekt: (e1.ag - e0.ag) * (1 + e0.g),
      rEffekt: -(e1.r - e0.r) * e0.g,
      gEffekt: (e1.ag - e1.r) * (e1.g - e0.g),
      restEffekt: e1.rest - e0.rest,
      skatEffekt: e1.skat - e0.skat,
    };
  });
  return { afstemning: afst, perioder };
}

/** ΔOG = ΔBM − Δ(kapacitetsomkostninger i % af omsætning) + Δrest. */
function ogDekomposition({ beregnet, aar }) {
  const del = b => {
    const og = b.n[2], bm = b.n[7], ko = b.mellem.koAndel;
    return og == null || bm == null || ko == null ? null : { og, bm, ko, rest: og - bm + ko };
  };
  return PERIODER.map(([a, b]) => {
    const d0 = del(beregnet[a]), d1 = del(beregnet[b]);
    if (!d0 || !d1) return null;
    return { fra: aar[a], til: aar[b], d0, d1, dOG: d1.og - d0.og, dBM: d1.bm - d0.bm, dKO: d1.ko - d0.ko, dRest: d1.rest - d0.rest };
  });
}

/** Kapitalbinding pr. 100 kr. omsætning (ultimo) – hvor er kapitalen bundet? */
function bindingUdvikling({ beregnet, aar }) {
  return PERIODER.map(([a, b]) => {
    const b0 = beregnet[a].mellem.binding, b1 = beregnet[b].mellem.binding;
    const poster = ["anlaeg", "varelager", "debitorer", "oevrige"]
      .filter(k => b0[k] != null && b1[k] != null)
      .map(k => ({ k, fra: b0[k], til: b1[k], d: b1[k] - b0[k] }));
    if (!poster.length) return null;
    const stoerst = [...poster].sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
    return { fra: aar[a], til: aar[b], poster, stoerst };
  });
}

const BINDINGNAVN = { anlaeg: "anlægsaktiverne", varelager: "varelageret", debitorer: "varedebitorerne", oevrige: "de øvrige omsætningsaktiver (likvider m.m.)" };

/* ====================== Hjælpere ====================== */

function trin1For(ctx, nrs) {
  return nrs.map(nr => konstater(nr, ctx.serie(nr), ctx.aar, ctx.enh)).filter(Boolean);
}

function faldgrube(ctx, omraade, tema, forventet, spoergsmaal, svar) {
  ctx.faldgruber.push({ omraade, tema, temaNavn: TEMANAVN[tema] || tema, forventet, spoergsmaal, svar });
}

function profilSaetning(ctx, noegle) {
  const p = ctx.profil;
  if (!p) return null;
  const nr = PROFILNOEGLE[noegle];
  const v = ctx.sidst(nr);
  const pv = p.v[noegle];
  if (noegle === "lager" && pv == null) {
    if (v == null) return null;
    return `En ${p.navn.toLowerCase()} har typisk intet varelager af betydning; her omsættes lageret ${fmtX(v)} gange om året, og det kræver en forklaring.`;
  }
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
  const aar = ctx.aar[2];
  let s = holder
    ? `${stort(BESTEMT[nr])} på ${fv} i ${aar} overholder tommelfingerreglen (${regel.retning === "min" ? "mindst" : "højst"} ${fg}).`
    : `${stort(BESTEMT[nr])} på ${fv} i ${aar} ligger ${regel.retning === "min" ? "under" : "over"} tommelfingerreglen på ${fg}.`;
  if (holder && regel.komfort && v < regel.komfort) s += ` Der er dog et stykke op til de ${formatGraense(nr, regel.komfort)}, der giver god luft.`;
  return { tekst: s, holder };
}

/* ====================== Rentabilitet ====================== */

function rentabilitet(ctx) {
  const { aar, serie, sidst, rente } = ctx;
  const t1 = trin1For(ctx, [1, 2, 3, 4, 5, 6]);
  const t2 = [];
  const t3 = [];

  for (const d of ctx.dupont) {
    if (!d || !vaesentlig(1, d.ag0, d.ag1)) {
      if (d) t2.push(`I ${d.til} var afkastningsgraden stort set uændret (${fmtPp(d.dAG)}): ${forklarUaendret(d)}`);
      continue;
    }
    const driver = Math.abs(d.ogEffekt) >= Math.abs(d.aohEffekt) ? "og" : "aoh";
    t2.push(
      `I ${d.til} ${verbum(d.ag0, d.ag1)} afkastningsgraden ${fmtPpU(d.dAG)}. ` +
      `Ændringen i overskudsgraden (${fmtPct(d.og0)} → ${fmtPct(d.og1)}) står for ${fmtPp(d.ogEffekt)}, ` +
      `og ændringen i aktivernes omsætningshastighed (${fmtX(d.aoh0)} → ${fmtX(d.aoh1)}) for ${fmtPp(d.aohEffekt)}. ` +
      (driver === "og"
        ? "Udviklingen drives altså primært af indtjeningen på hver omsat krone – hvorfor overskudsgraden ændrede sig, forklares under indtjeningsevne."
        : "Udviklingen drives altså primært af, hvor effektivt kapitalen udnyttes – hvorfor omsætningshastigheden ændrede sig, forklares under kapitaltilpasning.")
    );
    const mindre = driver === "og" ? d.aohEffekt : d.ogEffekt;
    if (driver === "og" && Math.sign(mindre) === Math.sign(d.dAG) && Math.abs(mindre) >= Math.abs(d.dAG) / 3)
      faldgrube(ctx, "rentabilitet", "sammenhaeng-ubrugt",
        `I ${d.til} trækker både overskudsgraden og omsætningshastigheden afkastningsgraden samme vej. Forvent, at de studerende kun nævner overskudsgraden.`,
        "Hvor stor en del af ændringen i AG kommer fra omsætningshastigheden? Hvad er der sket med kapitalen?",
        `Overskudsgraden står for ${fmtPp(d.ogEffekt)} og omsætningshastigheden for ${fmtPp(d.aohEffekt)} af ${fmtPp(d.dAG)}.`);
    if (driver === "aoh")
      faldgrube(ctx, "rentabilitet", "sammenhaeng-ubrugt",
        `I ${d.til} kommer ændringen i afkastningsgraden fra omsætningshastigheden, ikke fra overskudsgraden. Mange studerende forklarer AG alene med overskudsgraden.`,
        "Hvilken af de to faktorer i AG = OG × AOH flyttede sig mest – og hvor meget af ændringen i AG står den for?",
        `Omsætningshastigheden står for ${fmtPp(d.aohEffekt)} af ${fmtPp(d.dAG)}.`);
    if (Math.sign(d.og1 - d.og0) !== Math.sign(d.aoh1 - d.aoh0) && vaesentlig(2, d.og0, d.og1) && vaesentlig(3, d.aoh0, d.aoh1))
      t2.push(`I ${d.til} trak de to faktorer i hver sin retning, så en del af effekten blev udlignet.`);
  }

  // EKF-formlen og afstemningen
  const afst = ctx.ekf.afstemning[2];
  if (afst?.efterSkat != null) {
    t2.push(
      `EKF-formlen for ${aar[2]}: EKF før skat = AG + (AG − r) · FK/EK = ${fmtPct(afst.ag)} + (${fmtPct(afst.ag)} − ${fmtPct(afst.r)}) · ${fmtX(afst.g)} = ${fmtPct(afst.formel)}. ` +
      (Math.abs(afst.rest) >= 0.05 ? `Øvrige finansielle poster bidrager med ${fmtPp(afst.rest)}, så EKF før skat er ${fmtPct(afst.foerSkat)}. ` : "") +
      `Skatten trækker ${fmtPpU(afst.skat)}, og EKF efter skat bliver ${fmtPct(afst.efterSkat)} – det tal, nøgletal 4 viser.`
    );
    t2.push(afst.rentemarginal >= 0
      ? `Rentemarginalen (AG − r) er positiv (${fmtPp(afst.rentemarginal)}), så gearingen løfter egenkapitalens forrentning med ${fmtPpU(afst.gearingsbidrag)} over afkastningsgraden.`
      : `Rentemarginalen (AG − r) er negativ (${fmtPp(afst.rentemarginal)}): hver lånt krone forrentes lavere, end den koster, så gearingen trækker egenkapitalens forrentning ${fmtPpU(afst.gearingsbidrag)} ned under afkastningsgraden.`);
  }
  for (const p of ctx.ekf.perioder) {
    if (!p || Math.abs(p.dEKF) < 0.5) continue;
    const dele = [["afkastningsgraden", p.agEffekt], ["fremmedkapitalens forrentning", p.rEffekt], ["gearingen", p.gEffekt], ["øvrige finansielle poster", p.restEffekt], ["skatten", p.skatEffekt]]
      .filter(([, x]) => Math.abs(x) >= 0.05)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    if (!dele.length) continue;
    t2.push(`EKF ${p.dEKF >= 0 ? "steg" : "faldt"} ${fmtPpU(p.dEKF)} i ${p.til}. Fordelt på årsager: ${dele.map(([n, x]) => `${n} ${fmtPp(x)}`).join(", ")}.`);
    const agE = p.agEffekt, gE = p.gEffekt + p.rEffekt;
    if (Math.sign(agE) !== Math.sign(p.dEKF) && Math.abs(gE) > Math.abs(agE))
      faldgrube(ctx, "rentabilitet", "aarsag-forvekslet",
        `EKF ${p.dEKF >= 0 ? "steg" : "faldt"} i ${p.til}, selv om afkastningsgraden trak den anden vej. Forvent forklaringen "EKF ændrede sig, fordi driften gik ${p.dEKF >= 0 ? "bedre" : "dårligere"}".`,
        "Hvad skete der med gearingen og fremmedkapitalens forrentning? Sæt tallene ind i EKF-formlen for begge år.",
        `Gearing og rente står for ${fmtPp(gE)}, afkastningsgraden for ${fmtPp(agE)}.`);
  }
  if (afst?.efterSkat != null)
    faldgrube(ctx, "rentabilitet", "noegletal-misforstaaet",
      "EKF-formlen går ikke op mod nøgletal 4, fordi nøgletallet er efter skat og indeholder finansielle indtægter. Studerende sætter tallene ind og tror, de har regnet forkert.",
      "Hvorfor giver formlen ikke det samme som nøgletal 4? Hvilke poster ligger mellem primær drift og årets resultat?",
      `Afstemningen: formel ${fmtPct(afst.formel)}${Math.abs(afst.rest) >= 0.05 ? `, øvrige finansielle poster ${fmtPp(afst.rest)}` : ""}, skat ${fmtPp(afst.skat)} = ${fmtPct(afst.efterSkat)}.`);

  // Trin 3 – målestokke
  const ag = sidst(1), ekf = sidst(4), r = sidst(5);
  const mr = rente[2];
  if (ag != null) {
    const mer = ag - mr;
    t3.push(mer >= 0
      ? `Målt mod markedsrenten (${MARKEDSRENTE_NAVN}, ${fmtPct(mr)} i ${aar[2]}) forrenter driften kapitalen ${fmtPpU(mer)} bedre end en risikofri placering. ${vaesentlig(1, serie(1)[0], ag) && ag < serie(1)[0] ? "Merafkastet er dog skrumpet i perioden." : ""}`.trim()
      : `Afkastningsgraden på ${fmtPct(ag)} ligger ${fmtPpU(mer)} under markedsrenten (${MARKEDSRENTE_NAVN}, ${fmtPct(mr)} i ${aar[2]}). Kapitalen i driften forrentes altså dårligere end i en risikofri statsobligation – det er ikke holdbart på sigt.`);
  }
  if (ekf != null)
    t3.push(ekf - mr >= 3
      ? `Egenkapitalens forrentning på ${fmtPct(ekf)} giver ejerne ${fmtPpU(ekf - mr)} mere end statsobligationen – en rimelig betaling for at bære risikoen i virksomheden.`
      : `Egenkapitalens forrentning på ${fmtPct(ekf)} giver ejerne ${ekf >= mr ? `kun ${fmtPpU(ekf - mr)} mere end` : "mindre end"} statsobligationen (${fmtPct(mr)}). Ejerne får ${ekf >= mr ? "kun en lille" : "ingen"} betaling for at bære virksomhedens risiko.`);
  if (r != null) {
    t3.push(`Fremmedkapitalens forrentning på ${fmtPct(r)} holdes op mod markedsrenten på ${fmtPct(mr)}. Vær opmærksom på, at r er regnet på al fremmedkapital – også rentefri gæld som leverandørgæld og skyldig skat – så den faktiske lånerente på den rentebærende gæld er højere.`);
    if (r < mr)
      faldgrube(ctx, "rentabilitet", "noegletal-misforstaaet",
        `Fremmedkapitalens forrentning (${fmtPct(r)}) ligger under markedsrenten (${fmtPct(mr)}). Studerende konkluderer, at virksomheden låner billigt.`,
        "Hvad består fremmedkapitalen af? Hvor meget af den koster rente?",
        "r er et gennemsnit over al gæld, også leverandørgæld og anden rentefri gæld. Den lave r siger mere om gældens sammensætning end om lånevilkårene.");
  }
  const p1 = profilSaetning(ctx, "og"), p2 = profilSaetning(ctx, "aoh");
  if (p1) t3.push(p1);
  if (p2) t3.push(p2);

  return { trin1: t1, trin2: t2, trin3: t3, noegle: noeglepunkter(ctx, [1, 2, 3, 4]) };
}

function forklarUaendret(d) {
  if (vaesentlig(2, d.og0, d.og1) && vaesentlig(3, d.aoh0, d.aoh1))
    return `overskudsgraden (${fmtPct(d.og0)} → ${fmtPct(d.og1)}) og omsætningshastigheden (${fmtX(d.aoh0)} → ${fmtX(d.aoh1)}) trak i hver sin retning og udlignede hinanden.`;
  return `hverken overskudsgraden (${fmtPct(d.og1)}) eller omsætningshastigheden (${fmtX(d.aoh1)}) flyttede sig væsentligt.`;
}

/* ====================== Indtjeningsevne ====================== */

function indtjeningsevne(ctx) {
  const { aar, beregnet, sidst, serie } = ctx;
  const t1 = trin1For(ctx, [7, 9, 10, 11, 12]);
  const t2 = [];
  const t3 = [];

  const ix = beregnet.map(b => b.mellem.indeks);
  if (ix[2].omsaetning != null && ix[2].resultatPrimaerDrift != null) {
    t1.unshift(`Med ${aar[0]} som indeks 100 er omsætningen ${ix[2].omsaetning >= 100 ? "vokset" : "faldet"} til indeks ${fmtX(ix[2].omsaetning, 0)} i ${aar[2]}, mens resultatet af primær drift står i indeks ${fmtX(ix[2].resultatPrimaerDrift, 0)}.`);
    if (ix[2].kapacitetsomkostninger != null)
      t2.push(`Indekstallene viser forholdet mellem salg og omkostninger: omsætningen står i ${fmtX(ix[2].omsaetning, 0)}, bruttoresultatet i ${fmtX(ix[2].bruttoresultat, 0)} og kapacitetsomkostningerne i ${fmtX(ix[2].kapacitetsomkostninger, 0)}. ` +
        (ix[2].kapacitetsomkostninger > ix[2].bruttoresultat + 2
          ? "Kapacitetsomkostningerne er vokset hurtigere end bruttoresultatet, og det presser resultatet af primær drift."
          : ix[2].kapacitetsomkostninger < ix[2].bruttoresultat - 2
            ? "Bruttoresultatet er vokset hurtigere end kapacitetsomkostningerne, og det løfter resultatet af primær drift."
            : "Bruttoresultat og kapacitetsomkostninger har fulgt hinanden."));
    if (ix[2].omsaetning > 102 && ix[2].resultatPrimaerDrift < ix[2].omsaetning - 5)
      faldgrube(ctx, "indtjeningsevne", "kun-tal",
        `Omsætningen er vokset (indeks ${fmtX(ix[2].omsaetning, 0)}), men resultatet af primær drift er ikke fulgt med (indeks ${fmtX(ix[2].resultatPrimaerDrift, 0)}). Studerende skriver "virksomheden går godt, omsætningen stiger".`,
        "Hvad er vokset hurtigst – omsætningen eller omkostningerne? Brug indekstallene.",
        "Væksten er ikke rentabel: omkostningerne er vokset mindst lige så hurtigt som salget.");
  }

  for (const d of ctx.og) {
    if (!d || !vaesentlig(2, d.d0.og, d.d1.og)) continue;
    const dele = [
      [`bruttomarginen (${fmtPct(d.d0.bm)} → ${fmtPct(d.d1.bm)})`, d.dBM],
      [`kapacitetsomkostningerne i procent af omsætningen (${fmtPct(d.d0.ko)} → ${fmtPct(d.d1.ko)})`, -d.dKO],
      ["andre driftsposter", d.dRest],
    ].filter(([, x]) => Math.abs(x) >= 0.05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    t2.push(`Overskudsgraden ${verbum(d.d0.og, d.d1.og)} ${fmtPpU(d.dOG)} i ${d.til} (overskudsgrad = bruttomargin − kapacitetsomkostninger i procent af omsætningen). Bidrag: ${dele.map(([n, x]) => `${n} ${fmtPp(x)}`).join("; ")}.`);
    if (Math.sign(d.dBM) !== Math.sign(d.dOG) && Math.abs(d.dBM) >= 0.3)
      faldgrube(ctx, "indtjeningsevne", "manglende-aarsag",
        `I ${d.til} ${verbum(d.d0.og, d.d1.og)} overskudsgraden, selv om bruttomarginen ${verbum(d.d0.bm, d.d1.bm)}. Forvent, at forklaringen stopper ved bruttomarginen.`,
        "Hvis bruttomarginen trak den anden vej – hvad forklarer så udviklingen i overskudsgraden?",
        `Kapacitetsomkostningerne i procent af omsætningen: ${fmtPct(d.d0.ko)} → ${fmtPct(d.d1.ko)}.`);
  }

  const dg = sidst(9);
  if (dg != null)
    t2.push(`Den driftsmæssige gearing på ${fmtPct(dg)} betyder, at ${dg >= 40 ? "en stor" : "en mindre"} del af omkostningerne er kapacitetsomkostninger, der ikke følger salget. ${dg >= 40 ? "Resultatet svinger derfor kraftigt med omsætningen – både op og ned." : "Resultatet er derfor forholdsvis robust over for udsving i omsætningen."}`);

  const sm = serie(12);
  if (sm[2] != null)
    t3.push(`Sikkerhedsmarginen på ${fmtPct(sm[2])} i ${aar[2]} betyder, at omsætningen kan falde ${fmtPct(sm[2])}, før resultatet af primær drift er nul${sm[0] != null && vaesentlig(12, sm[0], sm[2]) ? ` – ${sm[2] > sm[0] ? "mere" : "mindre"} luft end i ${aar[0]} (${fmtPct(sm[0])})` : ""}.`);
  const bm = serie(7);
  if (bm[2] != null && bm[1] != null)
    t3.push(`Målt mod sidste år er bruttomarginen ${vaesentlig(7, bm[1], bm[2]) ? (bm[2] > bm[1] ? "forbedret" : "forringet") : "stabil"} (${fmtPct(bm[1])} → ${fmtPct(bm[2])}). En faldende bruttomargin tyder på prispres eller dyrere indkøb; en stigende på bedre priser eller et andet varemiks.`);
  const p = profilSaetning(ctx, "bm");
  if (p) t3.push(p);

  return { trin1: t1, trin2: t2, trin3: t3, noegle: noeglepunkter(ctx, [7, 9, 12]) };
}

/* ====================== Kapitaltilpasning ====================== */

function kapital(ctx) {
  const { aar, sidst, serie } = ctx;
  const t1 = trin1For(ctx, [13, 14, 15, 16, 17, 18, 19]);
  const t2 = [];
  const t3 = [];

  const lager = serie(16), deb = serie(17), kred = serie(18);
  if (lager[2] != null || deb[2] != null) {
    const dele = [];
    if (lager[2] != null) dele.push(`lageret ligger i ${dage(lager[2])} dage${lager[0] != null ? ` (${dage(lager[0])} dage i ${aar[0]})` : ""}`);
    if (deb[2] != null) dele.push(`kunderne betaler efter ${dage(deb[2])} dage${deb[0] != null ? ` (${dage(deb[0])} dage i ${aar[0]})` : ""}`);
    if (kred[2] != null) dele.push(`leverandørerne betales efter ${dage(kred[2])} dage`);
    t1.push(`Omregnet til dage: ${dele.join(", ")} i ${aar[2]}.`);
  }
  if (kred[0] != null && kred[2] != null && vaesentlig(18, kred[0], kred[2]))
    faldgrube(ctx, "kapital", "noegletal-misforstaaet",
      `Varekreditorernes omsætningshastighed ${verbum(kred[0], kred[2])}. Her er lavere bedre for likviditeten – det vender mange om.`,
      "Hvad betyder det for virksomhedens pengekasse, når leverandørerne betales hurtigere eller langsommere?",
      `Kreditdage: ${dage(kred[0])} → ${dage(kred[2])}. ${kred[2] > kred[0] ? "Leverandørerne betales hurtigere – virksomheden får mindre gratis kredit." : "Leverandørerne betales langsommere – det frigør likviditet, men kan presse relationen."}`);

  for (const d of ctx.binding) {
    if (!d) continue;
    const aoh = ctx.dupont.find(x => x?.til === d.til);
    if (aoh && !vaesentlig(3, aoh.aoh0, aoh.aoh1)) continue;
    const s = d.stoerst;
    t2.push(
      `${aoh ? `Aktivernes omsætningshastighed ${verbum(aoh.aoh0, aoh.aoh1)} i ${d.til} (${fmtX(aoh.aoh0)} → ${fmtX(aoh.aoh1)}). ` : ""}` +
      `Pr. 100 kr. omsætning var der bundet ${d.poster.map(p => `${fmtX(p.til, 0)} kr. i ${BINDINGNAVN[p.k].split(" (")[0]}`).join(", ")} (ultimo). ` +
      `Den største ændring er i ${BINDINGNAVN[s.k]}: ${fmtX(s.fra, 0)} → ${fmtX(s.til, 0)} kr. pr. 100 kr. omsætning.`
    );
  }

  const cf = serie(19), og = serie(2);
  if (cf[2] != null && og[2] != null) {
    const gab = og[2] - cf[2];
    t2.push(Math.abs(gab) < 1
      ? `Pengestrømmen fra primær drift (${fmtPct(cf[2])} af omsætningen) følger overskudsgraden (${fmtPct(og[2])}): overskuddet bliver til penge.`
      : gab > 0
        ? `Pengestrømmen fra primær drift (${fmtPct(cf[2])} af omsætningen) er lavere end overskudsgraden (${fmtPct(og[2])}). En del af overskuddet er bundet i arbejdskapital – typisk lager og debitorer – og er endnu ikke blevet til penge.`
        : `Pengestrømmen fra primær drift (${fmtPct(cf[2])} af omsætningen) er højere end overskudsgraden (${fmtPct(og[2])}), fx fordi afskrivninger ikke koster penge, eller fordi arbejdskapitalen er reduceret.`);
    if (og[0] != null && cf[0] != null && og[2] > og[0] && cf[2] < cf[0] - 0.5)
      faldgrube(ctx, "kapital", "paastand-uden-tal",
        "Overskudsgraden er steget, mens pengestrømmen fra driften i procent af omsætningen er faldet. Studerende nøjes med resultatopgørelsen.",
        "Er overskuddet blevet til penge? Hvor er pengene blevet af?",
        "Kig på lager- og debitordage: kapitalen er bundet i arbejdskapital.");
  }

  const p1 = profilSaetning(ctx, "lager"), p2 = profilSaetning(ctx, "deb"), p3 = profilSaetning(ctx, "al");
  for (const p of [p1, p2, p3]) if (p) t3.push(p);
  for (const nr of [16, 17]) {
    const s = serie(nr);
    if (s[1] != null && s[2] != null && vaesentlig(nr, s[1], s[2]))
      t3.push(`Målt mod sidste år er ${BESTEMT[nr]} ${s[2] > s[1] ? "forbedret" : "forringet"} (${fmtX(s[1])} → ${fmtX(s[2])}), dvs. ${s[2] > s[1] ? "mindre" : "mere"} kapital bundet pr. omsætningskrone.`);
  }

  return { trin1: t1, trin2: t2, trin3: t3, noegle: noeglepunkter(ctx, [3, 16, 17, 19]) };
}

/* ====================== Soliditet og likviditet ====================== */

function soliditet(ctx) {
  const { aar, beregnet, sidst, serie } = ctx;
  const t1 = trin1For(ctx, [20, 21, 22, 23, 24]);
  const t2 = [];
  const t3 = [];

  const v0 = beregnet[0].mellem.v, v2 = beregnet[2].mellem.v;
  const vaekst = (a, b) => (a && b != null ? ((b - a) / Math.abs(a)) * 100 : null);
  const gEK = vaekst(v0.egenkapital, v2.egenkapital), gA = vaekst(v0.aktiverIAlt, v2.aktiverIAlt);
  const sol = serie(20);
  if (gEK != null && gA != null && sol[0] != null && vaesentlig(20, sol[0], sol[2])) {
    t2.push(`Soliditetsgraden ${verbum(sol[0], sol[2])}, fordi egenkapitalen ${gEK >= 0 ? "voksede" : "faldt"} ${fmtPct(Math.abs(gEK))}, mens balancen ${gA >= 0 ? "voksede" : "faldt"} ${fmtPct(Math.abs(gA))} fra ${aar[0]} til ${aar[2]}.`);
    if (sol[2] < sol[0] && gEK > 0)
      faldgrube(ctx, "soliditet", "noegletal-misforstaaet",
        `Egenkapitalen er vokset, men soliditetsgraden er faldet. Studerende skriver, at "egenkapitalen er blevet mindre".`,
        "Hvad er vokset hurtigst – egenkapitalen eller balancen? Hvordan er væksten finansieret?",
        `Egenkapital ${fmtPct(gEK)}, balance ${fmtPct(gA)}: væksten er finansieret med gæld.`);
  }
  const lg1 = serie(23);
  if (lg1[0] != null && lg1[2] != null && vaesentlig(23, lg1[0], lg1[2]) && v0.kortfristetGaeld && v2.kortfristetGaeld != null) {
    const gKG = vaekst(v0.kortfristetGaeld, v2.kortfristetGaeld);
    t2.push(`Likviditetsgrad I ${verbum(lg1[0], lg1[2])}; den kortfristede gæld ${gKG >= 0 ? "voksede" : "faldt"} ${fmtPct(Math.abs(gKG))} fra ${aar[0]} til ${aar[2]}${ctx.binding[1] ? `, og kapitalbindingen i ${BINDINGNAVN[ctx.binding[1].stoerst.k].split(" (")[0]} ændrede sig mest (se kapitaltilpasning)` : ""}.`);
  }
  const kb = sidst(22);
  if (kb != null)
    t2.push(kb <= 1
      ? `Kapitalbindingsgraden på ${fmtX(kb)} viser, at anlægsaktiverne er fuldt finansieret af egenkapital og langfristet gæld; en del af den langfristede kapital finansierer også omsætningsaktiver.`
      : `Kapitalbindingsgraden på ${fmtX(kb)} viser, at en del af anlægsaktiverne er finansieret med kortfristet gæld.`);

  for (const nr of [20, 22, 23, 24]) {
    const r = tommelfinger(ctx, nr);
    if (r) t3.push(r.tekst);
  }
  const lg = sidst(23);
  if (lg != null && lg < 100 && ["supermarked", "abonnement-fysisk"].includes(ctx.profil?.id)) {
    t3.push(`For en ${ctx.profil.navn.toLowerCase()} er en likviditetsgrad under 100 % normal: kunderne betaler kontant eller forud, mens leverandørerne giver kredit. Tommelfingerreglen skal derfor læses med forretningsmodellen for øje.`);
    faldgrube(ctx, "soliditet", "tommelfingerregel",
      `Likviditetsgrad I (${fmtPct(lg)}) er under 100 %. Studerende konkluderer, at virksomheden har likviditetsproblemer.`,
      "Hvordan betaler kunderne, og hvornår betaler virksomheden sine leverandører? Hvorfor er grænsen 100 %?",
      "Med kontantsalg og leverandørkredit binder driften ingen kapital i debitorer – en lav likviditetsgrad er en del af forretningsmodellen, ikke et faresignal.");
  } else if (lg != null && lg < 100)
    faldgrube(ctx, "soliditet", "tommelfingerregel",
      `Likviditetsgrad I er under 100 %. Studerende skriver "likviditeten er dårlig" uden at spørge, hvorfor grænsen er 100 %.`,
      "Hvad skal omsætningsaktiverne uden lager kunne dække – og er der andre veje til penge (kassekredit, pengestrøm fra driften)?",
      "Grænsen handler om at kunne betale den kortfristede gæld; vurder den sammen med pengestrømmen fra driften.");

  const p = profilSaetning(ctx, "sol");
  if (p) t3.push(p);

  return { trin1: t1, trin2: t2, trin3: t3, noegle: noeglepunkter(ctx, [20, 22, 23]) };
}

/* ====================== Børsrelaterede nøgletal ====================== */

function boers(ctx) {
  const { aar, sidst, rente } = ctx;
  if ([25, 27].every(nr => ctx.serie(nr).every(x => x == null)))
    return {
      trin1: ["Der er ikke tastet antal aktier og børskurs, så de børsrelaterede nøgletal kan ikke beregnes. Er virksomheden ikke børsnoteret, springes området over."],
      trin2: [], trin3: [], noegle: [], ikkeRelevant: true,
    };
  const t1 = trin1For(ctx, [25, 26, 27, 28]);
  const t2 = ["Resultat pr. aktie følger årets resultat (se rentabilitet), og indre værdi pr. aktie følger egenkapitalen (se soliditet), så længe antallet af aktier er uændret."];
  const t3 = [];
  const pe = sidst(26), ki = sidst(28);
  if (pe != null && pe > 0) {
    const afkast = 100 / pe;
    t3.push(`Et P/E på ${fmtX(pe, 1)} svarer til et indtjeningsafkast (1/P/E) på ${fmtPct(afkast)}. Målt mod markedsrenten på ${fmtPct(rente[2])} ${afkast < rente[2] ? "betaler investorerne mere, end den nuværende indtjening alene berettiger – de forventer vækst" : "er aktien prissat lavt i forhold til indtjeningen – markedet forventer ikke vækst eller ser en høj risiko"}.`);
  }
  if (ki != null)
    t3.push(ki > 1
      ? `Kurs/indre værdi på ${fmtX(ki)} betyder, at markedet værdsætter virksomheden højere end den bogførte egenkapital – det forventer fremtidig indtjening ud over det, balancen viser.`
      : `Kurs/indre værdi på ${fmtX(ki)} betyder, at markedet værdsætter virksomheden lavere end den bogførte egenkapital – et tegn på tvivl om aktivernes værdi eller om fremtidig indtjening.`);
  return { trin1: t1, trin2: t2, trin3: t3, noegle: noeglepunkter(ctx, [25, 26, 28]) };
}

/* ====================== Nøglepunkter og konklusion ====================== */

function noeglepunkter(ctx, nrs) {
  return nrs.map(nr => {
    const s = ctx.serie(nr);
    if (s[2] == null) return null;
    return `${NT[nr].navn}: ${s.map(x => formatNt(nr, x, ctx.enh)).join(" → ")}`;
  }).filter(Boolean);
}

function konkluder(ctx, omraader) {
  const { sidst, serie, rente, profil, aar } = ctx;
  const styrker = [], svagheder = [], anbefalinger = [];
  const ag = serie(1);

  if (ag[2] != null) {
    if (ag[2] >= rente[2] + 2) styrker.push(`Driften forrenter kapitalen klart over markedsrenten (AG ${fmtPct(ag[2])} mod ${fmtPct(rente[2])}).`);
    else svagheder.push(`Afkastningsgraden (${fmtPct(ag[2])}) giver kun lidt eller intet merafkast i forhold til markedsrenten (${fmtPct(rente[2])}).`);
  }
  const sd = ctx.dupont[1] ?? ctx.dupont[0];
  let driver = null;
  if (sd && vaesentlig(1, ag[0], ag[2])) {
    const og = ctx.dupont.reduce((s, d) => s + (d?.ogEffekt ?? 0), 0);
    const aoh = ctx.dupont.reduce((s, d) => s + (d?.aohEffekt ?? 0), 0);
    driver = Math.abs(og) >= Math.abs(aoh) ? "og" : "aoh";
    const op = ag[2] > ag[0];
    (op ? styrker : svagheder).push(`Afkastningsgraden ${op ? "steg" : "faldt"} fra ${fmtPct(ag[0])} til ${fmtPct(ag[2])}, primært drevet af ${driver === "og" ? "overskudsgraden (indtjeningen pr. omsat krone)" : "aktivernes omsætningshastighed (kapitaludnyttelsen)"}.`);
    if (!op) {
      if (driver === "og") {
        // Hvilken del af overskudsgraden svigtede – bruttomarginen eller omkostningerne?
        const dBM = ctx.og.reduce((s, d) => s + (d?.dBM ?? 0), 0);
        const dKO = ctx.og.reduce((s, d) => s + (d?.dKO ?? 0), 0);
        anbefalinger.push(Math.abs(dBM) >= Math.abs(dKO)
          ? "Genopret bruttomarginen: se på priser, rabatter og indkøbsvilkår – væksten er købt med lavere avance."
          : "Tilpas kapacitetsomkostningerne til aktiviteten – de er vokset hurtigere end omsætningen.");
      } else anbefalinger.push("Tilpas kapitalen til aktiviteten: nedbring lager og debitorer, eller få mere omsætning ud af de eksisterende anlæg.");
    }
  }
  const cf = serie(19);
  if (cf[2] != null && cf[2] < 0) {
    svagheder.push(`Driften skaber ikke penge: pengestrømmen fra primær drift er negativ (${fmtPct(cf[2])} af omsætningen) – overskuddet bindes i arbejdskapital.`);
    const b = ctx.binding[1] ?? ctx.binding[0];
    anbefalinger.push(`Frigør kapital i ${b ? BINDINGNAVN[b.stoerst.k].split(" (")[0] : "lager og debitorer"}, så væksten ikke skal finansieres med ny gæld.`);
  }
  const afst = ctx.ekf.afstemning[2];
  if (afst && afst.rentemarginal < 0) {
    svagheder.push(`Gearingen virker negativt: AG (${fmtPct(afst.ag)}) er lavere end fremmedkapitalens forrentning (${fmtPct(afst.r)}).`);
    anbefalinger.push("Så længe afkastningsgraden er lavere end lånerenten, bør gælden nedbringes frem for at øges.");
  }
  const sol = sidst(20), lg1 = sidst(23), kb = sidst(22);
  if (sol != null) (sol >= 30 ? styrker : svagheder).push(`Soliditetsgraden er ${fmtPct(sol)} (tommelfingerregel: mindst 30 %).`);
  if (sol != null && sol < 30) anbefalinger.push("Styrk egenkapitalen – fx ved at holde udbyttet tilbage – så virksomheden kan bære et dårligt år.");
  if (kb != null && kb > 1) {
    svagheder.push(`Anlægsaktiverne er delvist finansieret med kortfristet gæld (kapitalbindingsgrad ${fmtX(kb)}).`);
    anbefalinger.push("Omlæg kortfristet gæld til langfristet finansiering af anlægsaktiverne.");
  }
  if (lg1 != null && lg1 < 100 && !["supermarked", "abonnement-fysisk"].includes(profil?.id))
    svagheder.push(`Likviditetsgrad I er ${fmtPct(lg1)} – under tommelfingerreglen på 100 %.`);

  // Forretningsmodellen: hvor afviger tallene fra det normale?
  const afvigelser = [];
  if (profil)
    for (const [k, nr] of Object.entries(PROFILNOEGLE)) {
      const d = modProfil(sidst(nr), profil.v[k]);
      if (d && d !== "på linje") afvigelser.push(`${PROFILNAVN[k]} ${formatNt(nr, sidst(nr))} (typisk ${formatNt(nr, profil.v[k])}) – ${d} end normalt`);
    }
  let model = "ukendt";
  if (ag[2] != null) {
    // Presset, når driften ikke slår markedsrenten, eller når mindst to
    // advarselslamper lyser på én gang.
    const lamper = [
      ag[0] != null && ag[2] < ag[0] - 1,
      cf[2] != null && cf[2] < 0,
      lg1 != null && lg1 < 100 && !["supermarked", "abonnement-fysisk"].includes(profil?.id),
      sol != null && sol < 30,
      afst != null && afst.rentemarginal < 0,
    ].filter(Boolean).length;
    const presset = ag[2] < rente[2] || lamper >= 2;
    model = presset ? "presset" : afvigelser.length >= 3 ? "under forandring" : "holder";
  }

  const udkast = [
    `${ctx.kase.navn || "Virksomheden"} ${model === "holder" ? "tjener fortsat penge på den måde, forretningsmodellen forudsætter" : model === "presset" ? (ag[2] < rente[2] ? "er under pres: driften forrenter ikke kapitalen bedre end en risikofri statsobligation, og forretningsmodellen giver ikke længere et tilfredsstillende afkast" : "er under pres: driften forrenter stadig kapitalen over markedsrenten, men flere advarselslamper lyser på én gang (se svaghederne)") : model === "under forandring" ? "ligner ikke længere den typiske virksomhed med sin forretningsmodel – modellen kan være ved at skifte" : "kan ikke vurderes fuldt ud, fordi der mangler tal"}.`,
    ...(profil ? [afvigelser.length
      ? `Holdt op mod en typisk ${profil.navn.toLowerCase()} afviger ${afvigelser.length === 1 ? "ét nøgletal" : `${afvigelser.length} nøgletal`}: ${afvigelser.join("; ")}.`
      : `Nøgletallene ligger på linje med en typisk ${profil.navn.toLowerCase()}: ${profil.kendetegn.split(".")[0].toLowerCase()}.`] : []),
    ...(anbefalinger.length ? [`Anbefaling til ledelsen: ${anbefalinger.join(" ")}`] : ["Anbefaling til ledelsen: fasthold modellen, og følg især de nøgletal, der har bevæget sig mest."]),
  ];

  if (profil && !ctx.kase.forretningsmodel)
    faldgrube(ctx, "konklusion", "forretningsmodel-ubrugt",
      "Trin 4 bliver en opsummering af de fem områder uden kobling til, hvordan virksomheden tjener penge.",
      `Hvilke nøgletal afslører, at det er en ${profil.navn.toLowerCase()}? Holder de tal stadig?`,
      profil.kendetegn);
  else
    faldgrube(ctx, "konklusion", "forretningsmodel-ubrugt",
      "Trin 4 bliver en opsummering af de fem områder uden kobling til, hvordan virksomheden tjener penge.",
      "Hvordan tjener virksomheden penge – på margin eller på volumen? Hvad siger udviklingen i OG og AOH om det?",
      "Konklusionen skal sige, om modellen holder, presses eller skifter, og slutte med en anbefaling, der følger af tallene.");

  return { styrker, svagheder, anbefalinger, afvigelser, model, driver, udkast, sidsteAar: aar[2] };
}

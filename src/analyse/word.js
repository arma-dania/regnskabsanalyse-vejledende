// De to Word-dokumenter: den vejledende besvarelse og underviservejledningen.

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, BorderStyle } from "docx";
import { OMRAADER, fmtPct, fmtPp, fmtX } from "./beregning.js";
import { TRIN } from "./temaer.js";
import { MARKEDSRENTE_NAVN } from "./maalestok.js";

const VIN = "7A1F2B";

const p = (tekst, opt = {}) => new Paragraph({ spacing: { after: 120 }, ...opt, children: [new TextRun({ text: tekst, ...(opt.run || {}) })] });
const h = (tekst, niveau) => new Paragraph({ heading: niveau, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: tekst })] });
const fed = (etiket, tekst) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: etiket, bold: true }), new TextRun({ text: tekst })] });
const punkt = tekst => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(tekst)] });

function tabel(hoved, raekker, bredder) {
  const celle = (t, i, erHoved) => new TableCell({
    width: bredder ? { size: bredder[i], type: WidthType.PERCENTAGE } : undefined,
    shading: erHoved ? { type: ShadingType.CLEAR, fill: VIN, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [new TextRun({ text: String(t), bold: erHoved, color: erHoved ? "FFFFFF" : undefined, size: 18 })] })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: hoved.map((t, i) => celle(t, i, true)) }),
      ...raekker.map(r => new TableRow({ children: r.map((t, i) => celle(t, i, false)) })),
    ],
  });
}

const luft = () => new Paragraph({ spacing: { after: 120 }, children: [] });

function noegletalTabel(a, o) {
  return tabel(
    ["Nøgletal", ...a.aar, `Ændring ${a.aar[1]}`, `Ændring ${a.aar[2]}`],
    o.tabel.map(r => [`${r.nr}. ${r.navn}`, ...r.tekst, ...r.aendring]),
    [34, 12, 12, 12, 15, 15],
  );
}

function dupontTabel(a) {
  const d = a.dupont.filter(Boolean);
  if (!d.length) return [];
  return [
    p("DuPont: ændringen i afkastningsgraden fordelt ved kædesubstitution (først overskudsgraden, derefter omsætningshastigheden).", { run: { italics: true } }),
    tabel(["", ...d.map(x => x.til)], [
      ["Afkastningsgrad", ...d.map(x => `${fmtPct(x.ag0)} → ${fmtPct(x.ag1)}`)],
      ["Overskudsgrad", ...d.map(x => `${fmtPct(x.og0)} → ${fmtPct(x.og1)}`)],
      ["Aktivernes omsætningshastighed", ...d.map(x => `${fmtX(x.aoh0)} → ${fmtX(x.aoh1)}`)],
      ["Effekt af overskudsgraden", ...d.map(x => fmtPp(x.ogEffekt))],
      ["Effekt af omsætningshastigheden", ...d.map(x => fmtPp(x.aohEffekt))],
      ["Ændring i AG i alt", ...d.map(x => fmtPp(x.dAG))],
    ]),
    luft(),
  ];
}

function ekfTabel(a) {
  const e = a.ekf.afstemning;
  if (!e.every(x => x?.efterSkat != null)) return [];
  return [
    p("EKF-formlen og afstemningen til nøgletal 4 (EKF efter skat).", { run: { italics: true } }),
    tabel(["", ...a.aar], [
      ["AG", ...e.map(x => fmtPct(x.ag))],
      ["r (fremmedkapitalens forrentning)", ...e.map(x => fmtPct(x.r))],
      ["Rentemarginal AG − r", ...e.map(x => fmtPp(x.rentemarginal))],
      ["Gearing FK/EK", ...e.map(x => fmtX(x.g))],
      ["Gearingsbidrag (AG − r) · FK/EK", ...e.map(x => fmtPp(x.gearingsbidrag))],
      ["= EKF før skat efter formlen", ...e.map(x => fmtPct(x.formel))],
      ["+ øvrige finansielle poster", ...e.map(x => fmtPp(x.rest))],
      ["= EKF før skat", ...e.map(x => fmtPct(x.foerSkat))],
      ["− skat", ...e.map(x => fmtPp(x.skat))],
      ["= EKF efter skat (nøgletal 4)", ...e.map(x => fmtPct(x.efterSkat))],
    ]),
    luft(),
  ];
}

function forudsaetninger(a) {
  return [
    fed("Analyseår: ", `${a.aar.join(", ")} (tal i ${a.enhed || "kr."}).`),
    fed("Markedsrente: ", `${MARKEDSRENTE_NAVN}: ${a.aar.map((y, i) => `${y} ${fmtPct(a.rente[i])}`).join(", ")}.`),
    fed("Forretningsmodel: ", [a.profil ? `typisk profil: ${a.profil.navn.toLowerCase()}.` : "", a.forretningsmodel].filter(Boolean).join(" ") || "Ikke angivet."),
    ...(a.skoen ? [p("Obs: Primobalancen mangler, så gennemsnitstallene for det første år er regnet på ultimotal og er et skøn.", { run: { italics: true } })] : []),
  ];
}

/** Teksten til ét trin: Claudes prosa, hvis den findes, ellers motorens sætninger. */
const trinTekst = (a, prosa, id, nr) => prosa?.[id]?.[`trin${nr}`] || a.omraader[id][`trin${nr}`].join(" ");

export const besvarelseDocx = (a, prosa) => Packer.toBlob(besvarelseDok(a, prosa));
export const vejledningDocx = (a, prosa) => Packer.toBlob(vejledningDok(a, prosa));

export function besvarelseDok(a, prosa = {}) {
  const dele = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(`Vejledende besvarelse – ${a.navn}`)] }),
    p("Regnskabsanalyse på formuleringstrappen: trin 1-3 for hvert analyseområde, trin 4 i den samlede konklusion.", { run: { italics: true } }),
    ...forudsaetninger(a),
  ];
  for (const o of OMRAADER) {
    const om = a.omraader[o.id];
    dele.push(h(om.navn, HeadingLevel.HEADING_1), noegletalTabel(a, om), luft());
    if (o.id === "rentabilitet") dele.push(...dupontTabel(a), ...ekfTabel(a));
    if (om.ikkeRelevant) { dele.push(p(om.trin1[0])); continue; }
    for (const t of TRIN.slice(0, 3)) {
      dele.push(h(`Trin ${t.nr} – ${t.navn}`, HeadingLevel.HEADING_3));
      for (const afsnit of trinTekst(a, prosa, o.id, t.nr).split(/\n+/)) if (afsnit.trim()) dele.push(p(afsnit.trim()));
    }
  }
  dele.push(h("Samlet konklusion – Trin 4 Forretningsmodellen", HeadingLevel.HEADING_1));
  const t4 = prosa.konklusion?.trin4 || a.konklusion.udkast.join(" ");
  for (const afsnit of t4.split(/\n+/)) if (afsnit.trim()) dele.push(p(afsnit.trim()));

  dele.push(h("Metode", HeadingLevel.HEADING_2),
    punkt("Nøgletallene følger Bilag 2 og er regnet som i nøgletalsappen: AG, EKF, r og gearing på gennemsnit af primo og ultimo, de øvrige på ultimotal."),
    punkt("Ændringer i procentnøgletal er i procentpoint; andre ændringer i procent. En ændring nævnes, når den er mindst ½ procentpoint eller 5 %."),
    punkt("DuPont-fordelingen er kædesubstitution: først skiftes overskudsgraden, derefter omsætningshastigheden. En anden rækkefølge fordeler samspillet lidt anderledes."),
    punkt("EKF-formlen gælder før skat. Øvrige finansielle poster og skat vises som egne linjer, så afstemningen går op til nøgletal 4."),
    punkt("Fremmedkapitalens forrentning er regnet på al fremmedkapital, også rentefri gæld. Den faktiske lånerente er derfor højere."));
  return dok(dele);
}

export function vejledningDok(a, prosa = {}) {
  const k = a.konklusion;
  const dele = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(`Underviservejledning – ${a.navn}`)] }),
    p("Til gennemgangen af regnskabsanalysen med holdet. Bruges sammen med den vejledende besvarelse.", { run: { italics: true } }),
    ...forudsaetninger(a),

    h("Det store billede", HeadingLevel.HEADING_1),
    p(prosa.konklusion?.fortaelling || k.udkast[0]),
    ...(k.styrker.length ? [fed("Styrker: ", ""), ...k.styrker.map(punkt)] : []),
    ...(k.svagheder.length ? [fed("Svagheder: ", ""), ...k.svagheder.map(punkt)] : []),

    h("Forslag til forløb (90 minutter)", HeadingLevel.HEADING_1),
    tabel(["Tid", "Aktivitet"], [
      ["0-10", "Genopfrisk formuleringstrappen. Skriv de fire spørgsmål på tavlen – de er ryggraden i gennemgangen."],
      ["10-35", "Rentabilitet: tegn DuPont-tallene (tavleskitse 1), og lad holdet selv finde, hvilken faktor der driver AG. Afslut med EKF-afstemningen (tavleskitse 2)."],
      ["35-50", "Indtjeningsevne og kapitaltilpasning: de to forklarer hver sin faktor i AG. Stil spørgsmålene under faldgruberne."],
      ["50-65", "Soliditet og likviditet: tommelfingerreglerne – og hvornår forretningsmodellen er en bedre målestok."],
      ["65-85", "Trin 4 i grupper: holder forretningsmodellen? Hver gruppe skriver én anbefaling, der følger af tallene."],
      ["85-90", "Opsamling: hvilke faldgruber ramte vi? Hvilket trin var sværest?"],
    ], [15, 85]),
    luft(),

    h("Tavleskitse 1 – DuPont", HeadingLevel.HEADING_2), ...dupontTabel(a),
    h("Tavleskitse 2 – EKF-formlen og afstemningen", HeadingLevel.HEADING_2), ...ekfTabel(a),
  ];

  for (const o of OMRAADER) {
    const om = a.omraader[o.id];
    dele.push(h(om.navn, HeadingLevel.HEADING_1));
    if (om.ikkeRelevant) { dele.push(p(om.trin1[0])); continue; }
    if (om.noegle.length) dele.push(fed("Det skal de finde (trin 1): ", ""), ...om.noegle.map(punkt));
    if (om.trin2.length) dele.push(fed("Årsagskæden (trin 2): ", ""), ...om.trin2.map(punkt));
    if (om.trin3.length) dele.push(fed("Målestokke (trin 3): ", ""), ...om.trin3.map(punkt));
    const fg = a.faldgruber.filter(f => f.omraade === o.id);
    if (fg.length) dele.push(fed("Faldgruber at tage fat i: ", ""), ...fg.flatMap(faldgrubeAfsnit));
  }

  dele.push(h("Trin 4 – forretningsmodellen", HeadingLevel.HEADING_1));
  if (a.profil) dele.push(fed(`Typisk ${a.profil.navn.toLowerCase()}: `, a.profil.kendetegn));
  if (k.afvigelser.length) dele.push(fed("Hvor virksomheden afviger fra profilen: ", ""), ...k.afvigelser.map(punkt));
  dele.push(fed("Motorens vurdering: ", `forretningsmodellen ${k.model === "holder" ? "holder" : k.model === "presset" ? "er presset" : k.model === "under forandring" ? "er muligvis ved at skifte" : "kan ikke vurderes"}.`));
  if (k.anbefalinger.length) dele.push(fed("Anbefalinger, der følger af tallene: ", ""), ...k.anbefalinger.map(punkt));
  dele.push(fed("Spørgsmål til gruppearbejdet: ", ""),
    punkt("Tjener virksomheden sine penge på marginen (OG) eller på volumen og kapitaludnyttelse (AOH)? Har det ændret sig?"),
    punkt("Hvilke tre nøgletal afslører bedst forretningsmodellen – og hvad siger de i dag?"),
    punkt("Hvis I var ledelsen: hvad er det første, I ville gøre, og hvilket nøgletal skal vise, at det virker?"));
  for (const f of a.faldgruber.filter(f => f.omraade === "konklusion")) dele.push(...faldgrubeAfsnit(f));

  dele.push(h("Tjekliste: hvornår er et trin nået?", HeadingLevel.HEADING_1),
    tabel(["Trin", "Kravet"], TRIN.map(t => [`${t.nr} ${t.navn}`, t.krav]), [25, 75]));
  return dok(dele);
}

function faldgrubeAfsnit(f) {
  return [
    new Paragraph({ spacing: { before: 120, after: 60 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: VIN, space: 8 } },
      children: [new TextRun({ text: f.temaNavn, bold: true, color: VIN })] }),
    fed("Forventet: ", f.forventet),
    fed("Spørg: ", f.spoergsmaal),
    fed("Svaret: ", f.svar),
  ];
}

function dok(children) {
  return new Document({
    creator: "Regnskabsanalyse – vejledende",
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
      paragraphStyles: [
        { id: "Title", name: "Title", run: { size: 40, bold: true, color: VIN } },
        { id: "Heading1", name: "Heading 1", run: { size: 30, bold: true, color: VIN } },
        { id: "Heading2", name: "Heading 2", run: { size: 26, bold: true, color: "333333" } },
        { id: "Heading3", name: "Heading 3", run: { size: 23, bold: true, color: "555555" } },
      ],
    },
    sections: [{ properties: {}, children }],
  });
}


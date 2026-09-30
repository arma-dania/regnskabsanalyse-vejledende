// De to Word-dokumenter: den vejledende besvarelse og underviservejledningen.

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, BorderStyle } from "docx";
import { OMRAADER, fmtPct } from "./beregning.js";
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
    ["Nøgletal", ...a.aar, "Ændring i %"],
    o.tabel.map(r => [`${r.nr}. ${r.navn}`, ...r.tekst, r.pct]),
    [40, 15, 15, 15, 15],
  );
}

function forudsaetninger(a) {
  return [
    fed("Analyseår: ", `${a.aar.join(", ")} (tal i ${a.enhed || "kr."}).`),
    fed("Markedsrente: ", `${MARKEDSRENTE_NAVN}: ${a.aar.map((y, i) => `${y} ${fmtPct(a.rente[i])}`).join(", ")}.`),
    ...(a.udbytte?.some(u => u?.foreslaaet != null) ? [fed("Udbytte for året: ", a.aar.map((y, i) => `${y} ${a.udbytte[i]?.foreslaaet == null ? "–" : new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(a.udbytte[i].foreslaaet)}`).join(", ") + ` (${a.enhed}).`)] : []),
    fed("Forretningsmodel: ", [a.profil ? `typisk profil: ${a.profil.navn.toLowerCase()}.` : "", a.forretningsmodel].filter(Boolean).join(" ") || "Ikke angivet."),
    ...(a.skoen ? [p("Obs: Primobalancen mangler, så gennemsnitstallene for det første år er regnet på ultimotal og er et skøn.", { run: { italics: true } })] : []),
  ];
}

/** Teksten til ét trin i en gruppe: Claudes prosa, hvis den findes, ellers motorens sætninger. */
function trinTekst(prosa, g, nr) {
  return prosa?.grupper?.[g.id]?.[`trin${nr}`] || g[`trin${nr}`].join(" ");
}

export const besvarelseDok = (a, prosa = {}) => dok(besvarelseBoern(a, prosa));
export const vejledningDok = (a, prosa = {}) => dok(vejledningBoern(a, prosa));
export const besvarelseDocx = (a, prosa) => Packer.toBlob(besvarelseDok(a, prosa));
export const vejledningDocx = (a, prosa) => Packer.toBlob(vejledningDok(a, prosa));

/** Den vejledende besvarelses indhold – også brugt i det samlede Word-dokument. */
export function besvarelseBoern(a, prosa = {}) {
  const dele = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(`Vejledende besvarelse – ${a.navn}`)] }),
    p("Regnskabsanalyse på formuleringstrappen: trin 1-3 for hvert nøgletal og hver gruppe af nøgletal, en delkonklusion for hvert analyseområde og trin 4 i den samlede konklusion.", { run: { italics: true } }),
    ...forudsaetninger(a),
  ];
  for (const o of OMRAADER) {
    const om = a.omraader[o.id];
    dele.push(h(om.navn, HeadingLevel.HEADING_1));
    if (om.ikkeRelevant) {
      dele.push(p("Der er ikke oplyst antal aktier og børskurs, så de børsrelaterede nøgletal kan ikke beregnes. Er virksomheden ikke børsnoteret, springes området over."));
      continue;
    }
    if (om.indledning) dele.push(p(om.indledning, { run: { italics: true } }));
    dele.push(noegletalTabel(a, om), luft());
    for (const g of om.grupper) {
      dele.push(h(g.titel, HeadingLevel.HEADING_2));
      for (const t of TRIN.slice(0, 3)) {
        const tekst = trinTekst(prosa, g, t.nr);
        if (tekst.trim()) dele.push(fed(`Trin ${t.nr} – ${t.navn}: `, tekst.replace(/\n+/g, " ")));
        if (t.nr === 2 && g.beretning?.length) dele.push(citat(g.beretning));
      }
    }
    const dk = prosa?.omraader?.[o.id]?.delkonklusion || om.delkonklusion;
    if (dk) dele.push(fed(`Delkonklusion – ${om.navn.toLowerCase()}: `, dk.replace(/\n+/g, " ")));
  }
  dele.push(h("Samlet konklusion", HeadingLevel.HEADING_1));
  const samlet = prosa.konklusion?.samlet || a.konklusion.samlet.join("\n");
  for (const afsnit of samlet.split(/\n+/)) if (afsnit.trim()) dele.push(p(afsnit.trim()));
  dele.push(h("Trin 4 – Forretningsmodellen", HeadingLevel.HEADING_1));
  const t4 = prosa.konklusion?.trin4 || a.konklusion.udkast.join(" ");
  for (const afsnit of t4.split(/\n+/)) if (afsnit.trim()) dele.push(p(afsnit.trim()));

  dele.push(h("Metode", HeadingLevel.HEADING_2),
    punkt("Nøgletallene er nøgletalsappens egne og følger Bilag 2: afkastningsgrad, egenkapitalens og fremmedkapitalens forrentning og gearing på gennemsnit af primo og ultimo, de øvrige på ultimotal."),
    punkt("Nøgletal, der deler forklaring og målestok, er skrevet sammen som én gruppe: kapacitetsgrad, nulpunkt og sikkerhedsmargin; anlæggenes omsætningshastigheder; varelager, debitorer og kreditorer; likviditetsgrad I og II; P/E og kurs/indre værdi."),
    punkt("Ændringer i procentnøgletal er i procentpoint; andre ændringer i procent. En ændring nævnes, når den er mindst ½ procentpoint eller 5 %."),
    punkt("Fremmedkapitalens forrentning er regnet på al fremmedkapital, også rentefri gæld. Den faktiske lånerente er derfor højere."));
  return dele;
}

/** Underviservejledningens indhold – også brugt i det samlede Word-dokument. */
export function vejledningBoern(a, prosa = {}) {
  const k = a.konklusion;
  const kaeder = a.pointer?.kaeder || [];
  const dele = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(`Underviservejledning – ${a.navn}`)] }),
    p("De vigtigste pointer og sammenhænge til gennemgangen med holdet. Den fulde trappe står i den vejledende besvarelse.", { run: { italics: true } }),
    ...forudsaetninger(a),

    h("Det store billede", HeadingLevel.HEADING_1),
  ];
  if (kaeder.length) {
    dele.push(h("Sådan hænger det sammen", HeadingLevel.HEADING_2), p(a.pointer.bindeled, { run: { italics: true } }));
    for (const kd of kaeder) {
      dele.push(h(kd.titel, HeadingLevel.HEADING_3),
        tabel(["Led", a.aar[0], a.aar[2], "Retning"], kd.led.map(x => [x.navn, x.fra, x.til, x.pil]), [52, 18, 18, 12]),
        ...kd.forbindelser.map(punkt), luft());
    }
  }
  dele.push(h("Den samlede konklusion", HeadingLevel.HEADING_2),
    ...(prosa.konklusion?.samlet || k.samlet.join("\n") || k.udkast[0]).split(/\n+/).filter(x => x.trim()).map(x => p(x.trim())));
  if (k.styrker.length) dele.push(fed("Styrker: ", ""), ...k.styrker.map(punkt));
  if (k.svagheder.length) dele.push(fed("Svagheder: ", ""), ...k.svagheder.map(punkt));

  for (const o of OMRAADER) {
    const om = a.omraader[o.id];
    if (om.ikkeRelevant) continue;
    dele.push(h(om.navn, HeadingLevel.HEADING_1));
    const dk = prosa?.omraader?.[o.id]?.delkonklusion || om.delkonklusion;
    if (dk) dele.push(fed("Hovedpointe: ", dk.replace(/\n+/g, " ")));
    if (om.indledning) dele.push(p(om.indledning, { run: { italics: true } }));
    dele.push(noegletalTabel(a, om), luft());
    const sam = a.pointer?.sammenhaenge?.[o.id] || [];
    if (sam.length) dele.push(fed("Sammenhænge, holdet skal se: ", ""), ...sam.map(punkt));
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

  dele.push(h("Forslag til forløb (90 minutter)", HeadingLevel.HEADING_1),
    tabel(["Tid", "Aktivitet"], [
      ["0-10", "Genopfrisk formuleringstrappen. Skriv de fire spørgsmål på tavlen – de er ryggraden i gennemgangen."],
      ["10-25", "Det store billede og sammenhængskæden: hvad er sket med AG, og hvilket led i kæden forklarer det?"],
      ["25-50", "Indtjeningsevne og kapitaltilpasning: grupperne forklarer hver sin faktor (OG eller AOH). Brug sammenhængene og faldgruberne."],
      ["50-65", "Soliditet og likviditet: tommelfingerreglerne – og hvad resultat, udbytte og arbejdskapital betyder for dem."],
      ["65-85", "Trin 4 i grupper: holder forretningsmodellen? Hver gruppe skriver én anbefaling, der følger af tallene."],
      ["85-90", "Opsamling: hvilke faldgruber ramte vi? Hvilket trin var sværest?"],
    ], [15, 85]),
    h("Tjekliste: hvornår er et trin nået?", HeadingLevel.HEADING_2),
    tabel(["Trin", "Kravet"], TRIN.map(t => [`${t.nr} ${t.navn}`, t.krav]), [25, 75]));

  if (a.beretning && a.brugCitater) {
    dele.push(h("Bilag: Ledelsesberetningen", HeadingLevel.HEADING_1),
      p("Som indlæst fra årsrapporten. Brug den til at holde ledelsens forklaringer op mod nøgletallene.", { run: { italics: true } }));
    for (const afsnit of a.beretning.split(/\n+/)) if (afsnit.trim()) dele.push(p(afsnit.trim(), { run: { size: 20 } }));
  }
  return dele;
}

/** Ledelsens egne ord – til at holde op mod tallene. */
function citat(saetninger) {
  return new Paragraph({
    spacing: { after: 120 }, indent: { left: 360 },
    children: [new TextRun({ text: "Ledelsesberetningen: ", bold: true, color: "9A6A16" }), new TextRun({ text: saetninger.map(x => `»${x}«`).join(" "), italics: true })],
  });
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

/** Én sektion pr. del; hver del starter på en ny side. */
export function dok(...dele) {
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
    sections: dele.map(children => ({ properties: {}, children })),
  });
}


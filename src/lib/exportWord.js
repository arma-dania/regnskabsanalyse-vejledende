import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, PageBreak
} from 'docx'
import { saveAs } from 'file-saver'
import { omformetRegnskab, sammenlaegningsoversigt, flytningsoversigt } from './model.js'
import { nogletalFor, beregnesPaaBrutto, procentvisAendring, formatAendring, OMRAADER, beregnAlle, formatVaerdi } from './nogletal.js'
import { filnavn } from './exportExcel.js'
import { hentAlleGrafer } from './chartImage.js'

const GRAA = 'F2F4F3'
const LINJE = { style: BorderStyle.SINGLE, size: 4, color: 'C9CFCB' }
const RAMME = { top: LINJE, bottom: LINJE, left: LINJE, right: LINJE }

const tal = (v, decimaler = 0) =>
  v == null || !Number.isFinite(v)
    ? '–'
    : new Intl.NumberFormat('da-DK', { minimumFractionDigits: decimaler, maximumFractionDigits: decimaler }).format(v)

function celle (tekst, { fed = false, hoejre = false, skygge = false, bredde, color } = {}) {
  return new TableCell({
    borders: RAMME,
    shading: skygge ? { fill: GRAA } : undefined,
    width: bredde ? { size: bredde, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({
      alignment: hoejre ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text: String(tekst), bold: fed, size: 19, color })]
    })]
  })
}

function tabel (raekker) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: raekker })
}

function afsnit (tekst, opts = {}) {
  return new Paragraph({ spacing: { before: 120, after: 120 }, children: [new TextRun({ text: tekst, size: 21, ...opts })] })
}

export async function hentWord (dataset, { medGrafer = true } = {}) {
  const grafer = medGrafer ? await hentAlleGrafer() : {}
  const doc = new Document({
    creator: 'Regnskabsanalyse',
    title: `${dataset.virksomhed || 'Regnskabsanalyse'} – nøgletal`,
    styles: STILE,
    sections: [{ properties: { page: { margin: MARGEN } }, children: noegletalBoern(dataset, grafer) }]
  })
  const blob = await Packer.toBlob(doc)
  const navn = filnavn(dataset, 'docx')
  saveAs(blob, navn)
  return navn
}

export const STILE = {
  default: { document: { run: { font: 'Calibri', size: 21 } } },
  paragraphStyles: [
    { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { size: 48, bold: true, color: '14202E' }, paragraph: { spacing: { after: 160 } } },
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { size: 30, bold: true, color: '14202E' } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { size: 25, bold: true, color: '1F5C6E' } },
    { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { size: 22, bold: true, color: '14202E' } }
  ]
}
export const MARGEN = { top: 1000, bottom: 1000, left: 1000, right: 1000 }

/** Nøgletal og grafer som Word-indhold. graferne hentes med hentAlleGrafer(). */
export function noegletalBoern (dataset, grafer = {}) {
  const aarNavne = dataset.aar.map((y, i) => y.label || `År ${i + 1}`)
  const resultater = beregnAlle(dataset)

  const boernForside = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: dataset.virksomhed || 'Regnskabsanalyse', size: 48, bold: true })]
    }),
    afsnit(`Nøgletalsanalyse for ${aarNavne.join(', ')}. Alle beløb i ${dataset.enhed.replace(/\.$/, '')}.`, { color: '5A6570' }),
    ...(beregnesPaaBrutto(dataset)
      ? [afsnit('Regnskabet oplyser ikke nettoomsætning. Nøgletal markeret "af bruttofortjeneste" er beregnet på bruttofortjenesten i stedet og kan kun bruges til at følge udviklingen i virksomheden, ikke til sammenligning med andre.', { color: '5A6570' })]
      : []),
    afsnit(`Udskrevet ${new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}.`, { color: '5A6570', size: 18 })
  ]

  // Regnskabet i analyseform
  const analyseBoern = [new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Regnskabet i analyseform', spacing: { before: 320, after: 160 } })]
  omformetRegnskab(dataset).forEach(afs => {
    const raekker = [new TableRow({
      children: [celle(afs.title, { fed: true, skygge: true, bredde: 46 }), ...aarNavne.map(a => celle(a, { fed: true, skygge: true, hoejre: true, bredde: 18 }))]
    })]
    afs.raekker.forEach(r => raekker.push(new TableRow({
      children: [celle(r.navn, { fed: r.erSum }), ...r.tal.map(v => celle(tal(v, 0), { hoejre: true, fed: r.erSum }))]
    })))
    analyseBoern.push(tabel(raekker), new Paragraph({ text: '', spacing: { after: 160 } }))
  })
  const oversigt = sammenlaegningsoversigt(dataset)
  if (oversigt.length) {
    analyseBoern.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Sammenlagte poster', spacing: { before: 200, after: 120 } }))
    oversigt.forEach(o => analyseBoern.push(new Paragraph({
      children: [new TextRun({ text: o.navn, bold: true, size: 19 }), new TextRun({ text: ' = ' + o.udtryk, size: 19 })],
      spacing: { after: 60 }
    })))
  }
  const flytninger = flytningsoversigt(dataset)
  if (flytninger.length) {
    analyseBoern.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Flyttede poster', spacing: { before: 200, after: 120 } }))
    flytninger.forEach(f => analyseBoern.push(new Paragraph({
      children: [new TextRun({ text: f.navn, bold: true, size: 19 }), new TextRun({ text: ' ' + f.plads, size: 19 })],
      spacing: { after: 60 }
    })))
  }

  // Nøgletal område for område
  const nogletalBoern = [new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'De 28 nøgletal', spacing: { after: 160 } })]

  OMRAADER.forEach(o => {
    nogletalBoern.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: o.title, spacing: { before: 280, after: 120 } }))
    const raekker = [new TableRow({
      children: [
        celle('Nr.', { fed: true, skygge: true, bredde: 6 }),
        celle('Nøgletal', { fed: true, skygge: true, bredde: 36 }),
        ...aarNavne.map(a => celle(a, { fed: true, skygge: true, hoejre: true, bredde: 14 })),
        celle('Ændring i %', { fed: true, skygge: true, hoejre: true, bredde: 16 })
      ]
    })]
    nogletalFor(dataset).filter(n => n.omraade === o.id).forEach(n => {
      raekker.push(new TableRow({
        children: [
          celle(n.nr, { hoejre: true }),
          celle(n.navn),
          ...resultater.map(r => celle(formatVaerdi(n, r[n.nr].value, dataset.enhed), { hoejre: true })),
          celle(formatAendring(procentvisAendring(resultater, n.nr)), { hoejre: true })
        ]
      }))
    })
    nogletalBoern.push(tabel(raekker))
  })

  // Et opslag pr. nøgletal med formel, graf og plads til kommentar
  const detaljer = [new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Nøgletal enkeltvis', spacing: { after: 120 } }),
    afsnit('Hvert nøgletal står med definition, tal for de tre år og en graf. Feltet "Kommentar" er tomt med vilje – analysen skriver du selv.', { color: '5A6570' })]

  nogletalFor(dataset).forEach(n => {
    detaljer.push(new Paragraph({
      heading: HeadingLevel.HEADING_3,
      text: `${n.nr}. ${n.navn}`,
      spacing: { before: 280, after: 80 }
    }))
    detaljer.push(new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `${n.taeller}  ÷  ${n.naevner}`, italics: true, size: 19, color: '1F5C6E' })]
    }))
    detaljer.push(afsnit(n.forklaring, { size: 19 }))
    detaljer.push(tabel([
      new TableRow({ children: [celle('', { skygge: true, bredde: 28 }), ...aarNavne.map(a => celle(a, { fed: true, skygge: true, hoejre: true }))] }),
      new TableRow({ children: [celle('Værdi', { fed: true }), ...resultater.map(r => celle(formatVaerdi(n, r[n.nr].value, dataset.enhed), { hoejre: true }))] }),
      new TableRow({ children: [celle('Tæller', {}), ...resultater.map(r => celle(tal(r[n.nr].num), { hoejre: true }))] }),
      new TableRow({ children: [celle('Nævner', {}), ...resultater.map(r => celle(tal(r[n.nr].den), { hoejre: true }))] })
    ]))
    const g = grafer[n.nr]
    if (g) {
      const b = 460
      detaljer.push(new Paragraph({
        spacing: { before: 140, after: 60 },
        children: [new ImageRun({ data: g.bytes, transformation: { width: b, height: Math.round(b * (g.hoejde / g.bredde)) } })]
      }))
    }
    detaljer.push(new Paragraph({
      spacing: { before: 60, after: 200 },
      border: { bottom: { style: BorderStyle.DOTTED, size: 6, color: 'AAB4AE', space: 8 } },
      children: [new TextRun({ text: 'Kommentar:', bold: true, size: 19 })]
    }))
  })

  return [...boernForside, ...analyseBoern, ...nogletalBoern, ...detaljer]
}

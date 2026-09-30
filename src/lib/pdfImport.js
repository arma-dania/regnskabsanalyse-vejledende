import * as pdfjsLib from 'pdfjs-dist'
import { FIELD_MAP } from './model.js'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// Rækkefølgen betyder noget: mere specifikke mønstre står først, så
// "Anlægsaktiver i alt" ikke bliver fanget af mønsteret for "Materielle anlægsaktiver".
const MOENSTRE = [
  ['omsaetning', [/^nettoomsætning/i, /^omsætning$/i, /^salgsindtægter/i, /^revenue/i]],
  ['vareforbrug', [/^vareforbrug/i, /^produktionsomkostninger/i, /^direkte omkostninger/i, /^råvarer og hjælpematerialer/i]],
  ['bruttoresultat', [/^bruttoresultat/i, /^bruttofortjeneste/i, /^bruttotab/i]],
  ['personaleomkostninger', [/^personaleomkostninger/i, /^personale/i, /^lønninger/i]],
  ['andreEksterne', [/^andre eksterne omkostninger/i, /^eksterne omkostninger/i, /^andre driftsomkostninger/i, /^salgs- og distributionsomkostninger/i, /^administrationsomkostninger/i]],
  ['afskrivninger', [/^af- og nedskrivninger/i, /^afskrivninger/i, /^amortisation/i]],
  ['resultatPrimaerDrift', [/^resultat af (ordinær )?primær drift/i, /^driftsresultat/i, /^resultat før finansielle poster/i, /^ebit/i]],
  ['finansielleIndtaegter', [/^finansielle indtægter/i, /^andre finansielle indtægter/i, /^renteindtægter/i]],
  ['finansielleOmkostninger', [/^finansielle omkostninger/i, /^andre finansielle omkostninger/i, /^renteomkostninger/i]],
  ['resultatFoerSkat', [/^resultat før skat/i, /^ordinært resultat før skat/i]],
  ['skat', [/^skat af (årets|ordinært)/i, /^selskabsskat/i]],
  ['aaretsResultat', [/^årets resultat/i, /^periodens resultat/i]],

  ['immaterielleAnlaeg', [/^immaterielle anlægsaktiver/i, /^immaterielle aktiver/i, /^goodwill/i]],
  ['materielleAnlaeg', [/^materielle anlægsaktiver/i, /^materielle aktiver/i]],
  ['finansielleAnlaeg', [/^finansielle anlægsaktiver/i, /^kapitalandele/i]],
  ['anlaegsaktiver', [/^anlægsaktiver i alt/i, /^anlægsaktiver$/i]],
  ['varelager', [/^varebeholdninger/i, /^varelager/i, /^lagerbeholdning/i]],
  ['varedebitorer', [/^tilgodehavender fra salg/i, /^varedebitorer/i, /^debitorer/i, /^handelsdebitorer/i]],
  ['andreTilgodehavender', [/^andre tilgodehavender/i, /^tilgodehavender i alt/i, /^periodeafgrænsningsposter/i]],
  ['likvider', [/^likvide beholdninger/i, /^likvider/i, /^kassebeholdning/i, /^bankindestående/i]],
  ['omsaetningsaktiver', [/^omsætningsaktiver i alt/i, /^omsætningsaktiver$/i]],
  ['aktiverIAlt', [/^aktiver i alt/i, /^balancesum/i, /^aktiver$/i]],

  ['egenkapital', [/^egenkapital i alt/i, /^egenkapital$/i]],
  ['hensatteForpligtelser', [/^hensatte forpligtelser/i, /^hensættelser/i]],
  ['langfristetGaeld', [/^langfristede gældsforpligtelser/i, /^langfristet gæld/i]],
  ['leverandoergaeld', [/^leverandører af varer/i, /^leverandørgæld/i, /^varekreditorer/i]],
  ['kortfristetGaeld', [/^kortfristede gældsforpligtelser/i, /^kortfristet gæld/i]],
  ['passiverIAlt', [/^passiver i alt/i, /^egenkapital og forpligtelser/i]],
  ['pengestroemPrimaerDrift', [/^pengestrøm(me)? fra (den )?prim(æ|ae)r drift/i, /^pengestrøm(me)? fra driftsaktivitet/i, /^driftens pengestrøm/i]]
]

const TAL = /\(?-?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?\)?|\(?-?\d+(?:,\d+)?\)?/g

export function parseDanskTal (s) {
  if (!s) return null
  let t = s.trim()
  let negativ = false
  if (/^\(.*\)$/.test(t)) { negativ = true; t = t.slice(1, -1) }
  if (/^-/.test(t)) { negativ = true; t = t.slice(1) }
  t = t.replace(/[.\s\u00a0]/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = parseFloat(t)
  if (!Number.isFinite(n)) return null
  return negativ ? -n : n
}

function linjerFraSide (indhold) {
  const rows = new Map()
  indhold.items.forEach(item => {
    if (!item.str || !item.str.trim()) return
    const y = Math.round(item.transform[5] / 3) * 3
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y).push({ x: item.transform[4], str: item.str })
  })
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim())
}

function gaetEnhed (tekst) {
  if (/mio\.?\s*kr/i.test(tekst)) return 'mio. kr.'
  if (/(t\.?\s*kr|1\.000\s*kr|tusinde kr)/i.test(tekst)) return '1.000 kr.'
  return 'kr.'
}

function gaetAarstal (tekst) {
  const fund = [...tekst.matchAll(/\b(19|20)\d{2}\b/g)].map(m => parseInt(m[0], 10))
  const taeller = {}
  fund.forEach(a => { if (a >= 1990 && a <= 2100) taeller[a] = (taeller[a] || 0) + 1 })
  return Object.entries(taeller).sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => parseInt(e[0], 10)).sort((a, b) => b - a)
}

/**
 * Læser en PDF og returnerer op til to talkolonner (regnskabsår og
 * sammenligningsår), som brugeren derefter placerer i det rigtige år.
 */
export async function importerPdf (file) {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const alleLinjer = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const side = await pdf.getPage(p)
    const indhold = await side.getTextContent()
    alleLinjer.push(...linjerFraSide(indhold))
  }
  const helTekst = alleLinjer.join('\n')

  const kolonner = [{}, {}]
  const poster = []

  // Hver genkendt linje bliver en post med linjens eget navn, i den
  // rækkefølge den står i PDF'en. Mønsteret giver et forslag til, hvilken
  // linje i analyseformen posten svarer direkte til.
  alleLinjer.forEach(linje => {
    for (const [key, patterns] of MOENSTRE) {
      const label = linje.replace(/\s+\(?-?[\d.,()\s]+$/, '').trim()
      if (!patterns.some(p => p.test(label) || p.test(linje))) continue
      const tal = (linje.match(TAL) || [])
        .map(parseDanskTal)
        .filter(n => n != null && Math.abs(n) > 0)
        // Note-numre og årstal står ofte i samme linje – de sorteres fra.
        .filter(n => !(Number.isInteger(n) && n >= 1990 && n <= 2100))
      if (!tal.length) continue
      const brugbare = tal.length > 2 ? tal.slice(-2) : tal
      const sektion = SEKTION[FIELD_MAP[key].section]
      const id = `pdf:${sektion}:${label.toLowerCase()}`
      if (kolonner[0][id] == null) {
        const fortegn = POSITIVE.includes(key) ? Math.abs : v => v
        kolonner[0][id] = fortegn(brugbare[0])
        if (brugbare[1] != null) kolonner[1][id] = fortegn(brugbare[1])
        poster.push({ id, label: label || FIELD_MAP[key].label, sektion, forslag: FIELD_MAP[key].derived ? null : key })
      }
      break
    }
  })

  const aarstal = gaetAarstal(helTekst.slice(0, 4000))
  const navn = (alleLinjer.find(l => /(A\/S|ApS|I\/S|K\/S|IVS)\s*$/.test(l)) || '').trim()
  const cvrCifre = (helTekst.match(/CVR[\s.-]*(?:nr|nummer)?[\s.:-]*((?:\d\s?){8})/i)?.[1] || '').replace(/\s/g, '')

  return {
    kilde: file.name,
    virksomhed: navn,
    cvr: cvrCifre.length === 8 ? cvrCifre : null,
    enhed: gaetEnhed(helTekst),
    poster,
    kolonner: [
      { navn: aarstal[0] ? String(aarstal[0]) : 'Regnskabsår', values: kolonner[0] },
      { navn: aarstal[1] ? String(aarstal[1]) : 'Sammenligningsår', values: kolonner[1] }
    ].filter(k => Object.keys(k.values).length > 0)
  }
}

// Omkostninger står ofte med minus i PDF'en, men i XBRL som positive tal —
// PDF-tallene gøres ens med XBRL-tallene.
const POSITIVE = ['vareforbrug', 'personaleomkostninger', 'andreEksterne', 'afskrivninger', 'finansielleOmkostninger', 'skat']

const SEKTION = { resultat: 'resultat', aktiver: 'aktiver', passiver: 'passiver', ovrigt: 'pengestroem' }

// Genkendelse af regnskabslinjer i teksten fra en PDF. Ligger for sig, så
// det kan prøves uden pdf.js.
import { FIELD_MAP } from './model.js'

// Rækkefølgen betyder noget: mere specifikke mønstre står først, så
// "Anlægsaktiver i alt" ikke bliver fanget af mønsteret for "Materielle anlægsaktiver".
const MOENSTRE = [
  ['omsaetning', [/^nettoomsætning/i, /^omsætning$/i, /^salgsindtægter/i, /^revenue/i]],
  ['vareforbrug', [/^vareforbrug/i, /^produktionsomkostninger/i, /^direkte omkostninger/i, /^omkostninger til råvarer/i]],
  ['bruttoresultat', [/^bruttoresultat/i, /^bruttofortjeneste/i, /^bruttotab/i]],
  ['personaleomkostninger', [/^personaleomkostninger/i, /^personale/i, /^lønninger/i, /^gager/i, /^pensioner/i, /^andre omkostninger til social sikring/i, /^omkostninger til social sikring/i, /^andre personaleomkostninger/i]],
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
  ['andreTilgodehavender', [/^andre tilgodehavender/i, /^tilgodehavende skat/i, /^tilgodehavende selskabsskat/i, /^periodeafgrænsningsposter/i]],
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

// Tusindtalsskilletegnet er punktum. Et mellemrum skiller to tal ("1.866.045
// 376.234"), så det må ikke regnes som skilletegn. Et minus kan stå med
// mellemrum foran tallet ("- 3.719.137").
const TAL = /(?:-\s?)?\(?\d{1,3}(?:\.\d{3})+(?:,\d+)?\)?|(?:-\s?)?\(?\d+(?:,\d+)?\)?/g
// Tallene i enden af en linje – med eller uden minus – fjernes fra navnet.
const TAL_TIL_SLUT = /(?:\s+(?:∅|[-–]?\s?\(?\d[\d.,]*\)?))+\s*$/

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

// PDF'er sætter ofte "fi", "fl" og "ff" som ét tegn (ligatur), og
// tekstudtrækket giver så "Andre fi nansielle indtægter". Mellemrummet
// efter ligaturen fjernes, så linjen kan genkendes.
export const udenLigaturHul = s => s.replace(/(^|[\s\-a-zæøå])(ffi|ffl|ff|fi|fl) (?=[a-zæøå])/gi, '$1$2')

// Markerer en tom første talkolonne, så et tal, der kun står i
// sammenligningsåret, ikke havner i regnskabsåret.
export const TOM = '∅'
const ER_TAL = /^[-–]?\s?\(?\d[\d.,]*\)?$/

export function linjerFraSide (indhold) {
  const rows = new Map()
  indhold.items.forEach(item => {
    if (!item.str || !item.str.trim()) return
    const y = Math.round(item.transform[5] / 3) * 3
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y).push({ x: item.transform[4], hoejre: item.transform[4] + (item.width || 0), str: item.str.trim() })
  })
  const raekker = [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, items]) => items.sort((a, b) => a.x - b.x))
  // Kolonnerne findes ud fra overskriften med årstallene ("Note 2025 2024").
  const overskrift = raekker.find(r => r.filter(i => /^(19|20)\d{2}$/.test(i.str)).length >= 2)
  const kol = overskrift ? overskrift.filter(i => /^(19|20)\d{2}$/.test(i.str)).slice(-2).map(i => i.hoejre) : null
  return raekker.map(items => {
    const tal = items.filter(i => ER_TAL.test(i.str) && !/^(19|20)\d{2}$/.test(i.str))
    if (kol && tal.length === 1 && Math.abs(tal[0].hoejre - kol[1]) < Math.abs(tal[0].hoejre - kol[0])) {
      items = items.flatMap(i => (i === tal[0] ? [{ str: TOM }, i] : [i]))
    }
    return udenLigaturHul(items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim())
  })
}

/**
 * Regnskabsåret og sammenligningsåret: helst fra kolonneoverskriften i
 * resultatopgørelsen eller balancen ("Note 2025 2024"). Godkendelsesdatoen
 * og ledelsesberetningen nævner ofte året efter, så det hyppigste årstal er
 * ikke altid regnskabsåret.
 */
export function regnskabsaar (linjer) {
  for (const l of linjer) {
    const m = l.match(/^(?:note\s+)?((?:19|20)\d{2})\s+((?:19|20)\d{2})$/i)
    if (m && Number(m[1]) - Number(m[2]) === 1) return [Number(m[1]), Number(m[2])]
  }
  return gaetAarstal(linjer.join('\n').slice(0, 4000))
}

export function gaetAarstal (tekst) {
  const fund = [...tekst.matchAll(/\b(19|20)\d{2}\b/g)].map(m => parseInt(m[0], 10))
  const taeller = {}
  fund.forEach(a => { if (a >= 1990 && a <= 2100) taeller[a] = (taeller[a] || 0) + 1 })
  return Object.entries(taeller).sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => parseInt(e[0], 10)).sort((a, b) => b - a)
}

/** De genkendte regnskabslinjer: op til to talkolonner og en post pr. linje. */
export function posterFraLinjer (alleLinjer) {
  const kolonner = [{}, {}]
  const poster = []

  // Hver genkendt linje bliver en post med linjens eget navn, i den
  // rækkefølge den står i PDF'en. Mønsteret giver et forslag til, hvilken
  // linje i analyseformen posten svarer direkte til.
  // En lang tekst brydes over to linjer, og tallene står så på linjen under
  // ("Af- og nedskrivninger af materielle og immaterielle" / "- 10.715 - 10.715" /
  // "anlægsaktiver"). Står der kun tal på næste linje, hører de til denne.
  const kunTal = l => !!l && /^[\s\d.,()\-–∅]+$/.test(l) && /\d/.test(l)
  const set = new Set()
  alleLinjer.forEach((linje, i) => {
    for (const [key, patterns] of MOENSTRE) {
      const label = linje.replace(TAL_TIL_SLUT, '').trim()
      if (!patterns.some(p => p.test(label) || p.test(linje))) continue
      // En sætning i ledelsesberetningen ("Årets resultat i 2023 udgør 1.556
      // t.kr. …") er ikke en regnskabslinje.
      if (label.split(' ').length > 9) continue
      const talLinje = /\d/.test(linje.replace(label, '')) || !kunTal(alleLinjer[i + 1]) ? linje : alleLinjer[i + 1]
      const tal = (talLinje.match(TAL) || [])
        .map(parseDanskTal)
        .filter(n => n != null)
        // Note-numre og årstal står ofte i samme linje – de sorteres fra.
        .filter(n => !(Number.isInteger(n) && n >= 1990 && n <= 2100))
      if (!tal.length || tal.every(n => n === 0)) continue
      // Kun ét tal, og det står i sammenligningsårets kolonne.
      const brugbare = tal.length === 1 && talLinje.includes(TOM) ? [null, tal[0]] : tal.length > 2 ? tal.slice(-2) : tal
      const sektion = SEKTION[FIELD_MAP[key].section]
      const id = `pdf:${sektion}:${label.toLowerCase()}`
      if (!set.has(id)) {
        set.add(id)
        const fortegn = POSITIVE.includes(key) ? Math.abs : v => v
        if (brugbare[0] != null) kolonner[0][id] = fortegn(brugbare[0])
        if (brugbare[1] != null) kolonner[1][id] = fortegn(brugbare[1])
        // Også summer (bruttofortjeneste, aktiver i alt …) får deres rolle;
        // beregnAnalyse bruger dem som regnskabets egne tal, ligesom ved XBRL.
        poster.push({ id, label: label || FIELD_MAP[key].label, sektion, forslag: key })
      }
      break
    }
  })
  return { kolonner, poster }
}

// Omkostninger står ofte med minus i PDF'en, men i XBRL som positive tal —
// PDF-tallene gøres ens med XBRL-tallene.
const POSITIVE = ['vareforbrug', 'personaleomkostninger', 'andreEksterne', 'afskrivninger', 'finansielleOmkostninger', 'skat']

const SEKTION = { resultat: 'resultat', aktiver: 'aktiver', passiver: 'passiver', ovrigt: 'pengestroem' }

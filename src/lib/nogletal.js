import { withDerived, PRIMO_FIELDS, FIELD_MAP, FIELDS, enhedFaktor, iVisningsenhed } from './model.js'

export const OMRAADER = [
  { id: 'rentabilitet', title: 'Rentabilitetsanalyse', nrs: [1, 2, 3, 4, 5, 6] },
  { id: 'indtjening', title: 'Indtjeningsevne', nrs: [7, 9, 10, 11, 12] },
  { id: 'kapital', title: 'Kapitaltilpasning og pengestrømme', nrs: [13, 14, 15, 16, 17, 18, 19] },
  { id: 'soliditet', title: 'Soliditet og likviditet', nrs: [20, 21, 22, 23, 24] },
  { id: 'boers', title: 'Børsrelaterede nøgletal', nrs: [25, 26, 27, 28] }
]

const div = (a, b) => (a == null || b == null || b === 0 ? null : a / b)

/**
 * Bygger beregningsgrundlaget for ét år.
 * ultimoFoer henter primo-værdier fra sidste års balance – eller fra det
 * indtastede primo-sæt, når det drejer sig om det ældste år.
 */
export function buildContext (dataset, index) {
  const y = dataset.aar[index]
  const v = withDerived(y.values)
  const prevYear = index > 0 ? dataset.aar[index - 1] : null
  const prev = prevYear ? withDerived(prevYear.values) : null
  const primo = withDerived(dataset.primo || {})

  const ultimoFoer = key => {
    if (prev && prev[key] != null) return prev[key]
    if (index === 0 && PRIMO_FIELDS.includes(key) && primo[key] != null) return primo[key]
    return null
  }

  const gns = key => {
    const b = ultimoFoer(key)
    if (v[key] == null) return null
    return b == null ? v[key] : (v[key] + b) / 2
  }

  const gnsErSkoen = key => ultimoFoer(key) == null && v[key] != null

  const fremmedkapital = u => (u.aktiverIAlt != null && u.egenkapital != null ? u.aktiverIAlt - u.egenkapital : null)
  const fkNu = fremmedkapital(v)
  const fkFoer = (() => {
    const a = ultimoFoer('aktiverIAlt'); const e = ultimoFoer('egenkapital')
    return a != null && e != null ? a - e : null
  })()
  const gnsFremmedkapital = fkNu == null ? null : (fkFoer == null ? fkNu : (fkNu + fkFoer) / 2)

  const samledeDriftsomk = (v.vareforbrug != null || v.kapacitetsomkostninger != null)
    ? (v.vareforbrug || 0) + (v.kapacitetsomkostninger || 0)
    : null

  const varekoeb = (() => {
    if (v.vareforbrug == null) return null
    const lagerPrimo = ultimoFoer('varelager')
    if (v.varelager == null || lagerPrimo == null) return v.vareforbrug
    return v.vareforbrug + (v.varelager - lagerPrimo)
  })()

  const bruttomargin = div(v.bruttoresultat, v.omsaetning)
  const nulpunkt = bruttomargin ? div(v.kapacitetsomkostninger, bruttomargin) : null

  return {
    v, prev, index, gns, gnsErSkoen, ultimoFoer,
    gnsFremmedkapital, samledeDriftsomk, varekoeb, nulpunkt,
    basis: (() => {
      const b = dataset.aar[dataset.indeksBasisaar ?? 0]
      return withDerived(b.values)
    })()
  }
}

/**
 * Bygger ét indekstal pr. afkrydset post (ikke summeret sammen) til visning
 * nederst på siden, efter de 28 faste nøgletal. Genbruger samme opbygning
 * som resten af NOGLETAL, så NogletalKort og beregningen kan bruges uændret.
 */
export function byggIndeksNogletal (dataset) {
  const felter = Array.isArray(dataset.indeksFelter) ? dataset.indeksFelter : [dataset.indeksFelt || 'omsaetning']
  return felter.map(key => {
    const label = FIELD_MAP[key]?.label || key
    return {
      nr: `indeks:${key}`,
      visNr: 8,
      omraade: 'indeks',
      navn: `Indekstal – ${label}`,
      enhed: 'indeks',
      taeller: `${label} · 100`,
      naevner: 'Basisårets tal',
      bedre: 'op',
      forklaring: `Indeksberegning for ${label}. Indeks 100 i basisåret; tallet viser udviklingen i procent af basisåret.`,
      calc: c => ({ num: c.v[key], den: c.basis[key], pct: true })
    }
  })
}

/**
 * Alle 28 nøgletal. Hver post returnerer tæller og nævner, så både resultatet
 * og selve udregningen kan vises.
 */
export const NOGLETAL = [
  { nr: 1, omraade: 'rentabilitet', navn: 'Afkastningsgrad', enhed: '%', taeller: 'Resultat af primær drift · 100', naevner: 'Gennemsnitlig balancesum', bedre: 'op',
    forklaring: 'Viser virksomhedens evne til at forrente den investerede kapital. Kan dekomponeres i overskudsgrad og aktivernes omsætningshastighed.',
    calc: c => ({ num: c.v.resultatPrimaerDrift, den: c.gns('aktiverIAlt'), pct: true, skoen: c.gnsErSkoen('aktiverIAlt') }) },

  { nr: 2, omraade: 'rentabilitet', navn: 'Overskudsgrad', enhed: '%', taeller: 'Resultat af primær drift · 100', naevner: 'Omsætning', bedre: 'op',
    forklaring: 'Viser det aktuelle indtægts-/omkostningsforhold, dvs. virksomhedens evne til at tjene penge.',
    calc: c => ({ num: c.v.resultatPrimaerDrift, den: c.v.omsaetning, pct: true }) },

  { nr: 3, omraade: 'rentabilitet', navn: 'Aktivernes omsætningshastighed', enhed: 'gange', taeller: 'Omsætning', naevner: 'Gennemsnitlig balancesum', bedre: 'op',
    forklaring: 'Viser evnen til at tilpasse kapitalens størrelse til aktiviteten i virksomheden.',
    calc: c => ({ num: c.v.omsaetning, den: c.gns('aktiverIAlt'), skoen: c.gnsErSkoen('aktiverIAlt') }) },

  { nr: 4, omraade: 'rentabilitet', navn: 'Egenkapitalens forrentning', enhed: '%', taeller: 'Årets resultat · 100', naevner: 'Gennemsnitlig egenkapital', bedre: 'op',
    forklaring: 'Viser evnen til at forrente den af ejerne indskudte kapital. Kan også beregnes før skat ved at indsætte resultat før skat i tælleren.',
    calc: c => ({ num: c.v.aaretsResultat, den: c.gns('egenkapital'), pct: true, skoen: c.gnsErSkoen('egenkapital') }) },

  { nr: 5, omraade: 'rentabilitet', navn: 'Fremmedkapitalens forrentning', enhed: '%', taeller: 'Renteomkostninger · 100', naevner: 'Gennemsnitlig fremmedkapital', bedre: 'ned',
    forklaring: 'Viser virksomhedens gennemsnitlige lånerente af fremmedkapital (gæld).',
    calc: c => ({ num: c.v.finansielleOmkostninger, den: c.gnsFremmedkapital, pct: true }) },

  { nr: 6, omraade: 'rentabilitet', navn: 'Finansiel gearing', enhed: 'gange', taeller: 'Gennemsnitlig fremmedkapital', naevner: 'Gennemsnitlig egenkapital', bedre: 'neutral',
    forklaring: 'Viser hvor mange kroner fremmedkapital (gældsforpligtelser), der er pr. krone egenkapital.',
    calc: c => ({ num: c.gnsFremmedkapital, den: c.gns('egenkapital') }) },

  { nr: 7, omraade: 'indtjening', navn: 'Bruttomargin (bruttoavanceprocent)', enhed: '%', taeller: 'Bruttoresultat · 100', naevner: 'Omsætning', bedre: 'op',
    forklaring: 'Viser hvor mange procent af omsætningen, der er tilbage til dækning af kapacitetsomkostninger, renter, skat og overskud. Bruttomargin og bruttoavanceprocent bruges synonymt.',
    calc: c => ({ num: c.v.bruttoresultat, den: c.v.omsaetning, pct: true }) },

  { nr: 9, omraade: 'indtjening', navn: 'Driftsmæssig gearing', enhed: '%', taeller: 'Kapacitetsomkostninger · 100', naevner: 'Samlede driftsomkostninger', bedre: 'neutral',
    forklaring: 'Viser kapacitetsomkostningernes andel af de samlede driftsomkostninger.',
    calc: c => ({ num: c.v.kapacitetsomkostninger, den: c.samledeDriftsomk, pct: true }) },

  { nr: 10, omraade: 'indtjening', navn: 'Kapacitetsgrad', enhed: 'gange', taeller: 'Bruttoresultat', naevner: 'Kapacitetsomkostninger', bedre: 'op',
    forklaring: 'Viser hvor meget hver afholdt krone af kapacitetsomkostninger giver i bruttoresultat – altså hvor stor "overdækning" der er.',
    calc: c => ({ num: c.v.bruttoresultat, den: c.v.kapacitetsomkostninger }) },

  { nr: 11, omraade: 'indtjening', navn: 'Nulpunktsomsætning', enhed: 'beløb', taeller: 'Kapacitetsomkostninger · 100', naevner: 'Bruttomargin', bedre: 'ned',
    forklaring: 'Den omsætning, hvor bruttoresultatet netop dækker kapacitetsomkostningerne.',
    calc: c => ({ num: c.v.kapacitetsomkostninger, den: c.v.omsaetning ? (c.v.bruttoresultat / c.v.omsaetning) : null }) },

  { nr: 12, omraade: 'indtjening', navn: 'Sikkerhedsmargin', enhed: '%', taeller: '(Faktisk omsætning – nulpunktsomsætning) · 100', naevner: 'Faktisk omsætning', bedre: 'op',
    forklaring: 'Viser hvor mange procent omsætningen kan falde, før man befinder sig på nulpunktsomsætningen.',
    calc: c => ({ num: c.nulpunkt == null || c.v.omsaetning == null ? null : c.v.omsaetning - c.nulpunkt, den: c.v.omsaetning, pct: true }) },

  { nr: 13, omraade: 'kapital', navn: 'Anlægsaktivernes omsætningshastighed', enhed: 'gange', taeller: 'Omsætning', naevner: 'Samlede anlægsaktiver ultimo', bedre: 'op',
    forklaring: 'Viser hvor god virksomheden er til at skabe omsætning i forhold til de indsatte anlægsaktiver.',
    calc: c => ({ num: c.v.omsaetning, den: c.v.anlaegsaktiver }) },

  { nr: 14, omraade: 'kapital', navn: 'Immaterielle anlægsaktivers omsætningshastighed', enhed: 'gange', taeller: 'Omsætning', naevner: 'Immaterielle anlægsaktiver ultimo', bedre: 'op',
    forklaring: 'Viser evnen til at skabe omsætning i forhold til de immaterielle anlægsaktiver.',
    calc: c => ({ num: c.v.omsaetning, den: c.v.immaterielleAnlaeg }) },

  { nr: 15, omraade: 'kapital', navn: 'Materielle anlægsaktivers omsætningshastighed', enhed: 'gange', taeller: 'Omsætning', naevner: 'Materielle anlægsaktiver ultimo', bedre: 'op',
    forklaring: 'Viser evnen til at skabe omsætning i forhold til de materielle anlægsaktiver.',
    calc: c => ({ num: c.v.omsaetning, den: c.v.materielleAnlaeg }) },

  { nr: 16, omraade: 'kapital', navn: 'Varelagerets omsætningshastighed', enhed: 'gange', taeller: 'Vareforbrug', naevner: 'Varelagre ultimo', bedre: 'op',
    forklaring: 'Viser hvor mange gange varelageret i gennemsnit omsættes. For funktionsopdelte resultatopgørelser anvendes produktionsomkostninger.',
    calc: c => ({ num: c.v.vareforbrug, den: c.v.varelager }) },

  { nr: 17, omraade: 'kapital', navn: 'Varedebitorernes omsætningshastighed', enhed: 'gange', taeller: 'Omsætning', naevner: 'Varedebitorer ultimo', bedre: 'op',
    forklaring: 'Viser hvor mange gange varedebitorerne i gennemsnit "udskiftes" pr. år.',
    calc: c => ({ num: c.v.omsaetning, den: c.v.varedebitorer }) },

  { nr: 18, omraade: 'kapital', navn: 'Varekreditorernes omsætningshastighed', enhed: 'gange', taeller: 'Varekøb', naevner: 'Leverandørgæld ultimo', bedre: 'ned',
    forklaring: 'Varekøb = vareforbrug + (lager ultimo – lager primo). Viser evnen til at skaffe kredit hos leverandører.',
    calc: c => ({ num: c.varekoeb, den: c.v.leverandoergaeld }) },

  { nr: 19, omraade: 'kapital', navn: 'Pengestrøm fra primær drift / omsætning', enhed: '%', taeller: 'Pengestrøm fra primær drift', naevner: 'Omsætning', bedre: 'op',
    forklaring: 'Viser hvor god virksomheden er til at skabe pengestrømme ud fra omsætningen.',
    calc: c => ({ num: c.v.pengestroemPrimaerDrift, den: c.v.omsaetning, pct: true }) },

  { nr: 20, omraade: 'soliditet', navn: 'Soliditetsgrad', enhed: '%', taeller: 'Egenkapital ultimo · 100', naevner: 'Aktiver i alt ultimo', bedre: 'op',
    forklaring: 'Viser hvor mange procent af aktiverne der kan gå tabt, før kreditorerne lider tab.',
    calc: c => ({ num: c.v.egenkapital, den: c.v.aktiverIAlt, pct: true }) },

  { nr: 21, omraade: 'soliditet', navn: 'Anlægsgrad', enhed: '%', taeller: 'Anlægsaktiver ultimo · 100', naevner: 'Samlede aktiver ultimo', bedre: 'neutral',
    forklaring: 'Viser hvor stor en del af de samlede aktiver der er anlægsaktiver.',
    calc: c => ({ num: c.v.anlaegsaktiver, den: c.v.aktiverIAlt, pct: true }) },

  { nr: 22, omraade: 'soliditet', navn: 'Kapitalbindingsgrad', enhed: 'gange', taeller: 'Anlægsaktiver ultimo', naevner: 'Egenkapital + langfristede forpligtelser ultimo', bedre: 'ned',
    forklaring: 'Viser hvor stor en del anlægsaktiverne udgør af den langfristede kapital.',
    calc: c => ({ num: c.v.anlaegsaktiver, den: c.v.egenkapital == null ? null : c.v.egenkapital + (c.v.langfristetGaeld || 0) }) },

  { nr: 23, omraade: 'soliditet', navn: 'Likviditetsgrad I', enhed: '%', taeller: 'Omsætningsaktiver ekskl. varelager ultimo · 100', naevner: 'Kortfristet gæld ultimo', bedre: 'op',
    forklaring: 'Viser om virksomheden kan betale den gæld tilbage, der forfalder inden for et år. Bør helst være 100 eller derover.',
    calc: c => ({ num: c.v.omsaetningsaktiver == null ? null : c.v.omsaetningsaktiver - (c.v.varelager || 0), den: c.v.kortfristetGaeld, pct: true }) },

  { nr: 24, omraade: 'soliditet', navn: 'Likviditetsgrad II', enhed: '%', taeller: 'Omsætningsaktiver ultimo · 100', naevner: 'Kortfristet gæld ultimo', bedre: 'op',
    forklaring: 'Her indgår hele omsætningsformuen inkl. varelageret i tælleren.',
    calc: c => ({ num: c.v.omsaetningsaktiver, den: c.v.kortfristetGaeld, pct: true }) },

  { nr: 25, omraade: 'boers', navn: 'Resultat pr. aktie', enhed: 'kr', taeller: 'Årets resultat', naevner: 'Antal stk. aktier', bedre: 'op',
    forklaring: 'Viser hvor meget overskud der er til hver enkelt aktie i virksomheden.',
    calc: c => ({ num: c.v.aaretsResultat, den: c.v.antalAktier, skalering: true }) },

  { nr: 26, omraade: 'boers', navn: 'P/E-værdien', enhed: 'gange', taeller: 'Børskurs', naevner: 'Resultat pr. aktie', bedre: 'neutral',
    forklaring: 'Viser hvor meget en investor betaler for 1 kr. resultat.',
    calc: c => ({ num: c.v.boerskurs, den: c.eps }) },

  { nr: 27, omraade: 'boers', navn: 'Indre værdi pr. aktie', enhed: 'kr', taeller: 'Egenkapital', naevner: 'Antal aktier', bedre: 'op',
    forklaring: 'Udtrykker hvor meget egenkapital der er knyttet til 1 stk. aktie.',
    calc: c => ({ num: c.v.egenkapital, den: c.v.antalAktier, skalering: true }) },

  { nr: 28, omraade: 'boers', navn: 'Kurs / indre værdi', enhed: 'gange', taeller: 'Børskurs', naevner: 'Indre værdi', bedre: 'neutral',
    forklaring: 'Viser hvor meget man skal betale for 1 kr. egenkapital. P/E og kurs/indre værdi viser investorernes vurdering af virksomhedens fremtidige værdi.',
    calc: c => ({ num: c.v.boerskurs, den: c.indreVaerdi }) }
]

export const NOGLETAL_MAP = Object.fromEntries(NOGLETAL.map(n => [n.nr, n]))

// Regnskaber i klasse B må vise bruttofortjeneste i stedet for omsætning
// (ÅRL § 32). Bruttofortjenesten er påvirket af både mængde og margin, så
// den kan ikke blot erstatte omsætningen — men i disse nøgletal giver den en
// brugbar variant til at følge udviklingen i virksomheden selv. Varianterne
// får et eget navn, så de ikke forveksles med de almindelige nøgletal.
const MED_BRUTTOFORTJENESTE = {
  2: { navn: 'Overskudsgrad (af bruttofortjeneste)', naevner: 'Bruttofortjeneste',
    forklaring: 'Viser, hvor stor en del af bruttofortjenesten der bliver til resultat af primær drift, når personaleomkostninger og afskrivninger er betalt. Tallet er langt højere end en almindelig overskudsgrad og kan ikke sammenlignes med den eller med branchetal. Sammen med nr. 3 forklarer den afkastningsgraden: nr. 2 × nr. 3 = nr. 1.' },
  3: { navn: 'Aktivernes omsætningshastighed (af bruttofortjeneste)', taeller: 'Bruttofortjeneste',
    forklaring: 'Viser, hvor mange kroner bruttofortjeneste hver krone i aktiver skaber. Sammen med nr. 2 forklarer den afkastningsgraden: nr. 2 × nr. 3 = nr. 1.' },
  13: { navn: 'Anlægsaktivernes omsætningshastighed (af bruttofortjeneste)', taeller: 'Bruttofortjeneste' },
  14: { navn: 'Immaterielle anlægsaktivers omsætningshastighed (af bruttofortjeneste)', taeller: 'Bruttofortjeneste' },
  15: { navn: 'Materielle anlægsaktivers omsætningshastighed (af bruttofortjeneste)', taeller: 'Bruttofortjeneste' },
  19: { navn: 'Pengestrøm fra primær drift / bruttofortjeneste', naevner: 'Bruttofortjeneste' }
}
const BRUTTO_FORBEHOLD = ' Beregnet på bruttofortjenesten, fordi regnskabet ikke oplyser omsætning. Bruttofortjenesten påvirkes både af, hvor meget der sælges, og af, hvor meget der tjenes pr. salg — brug tallet til at følge udviklingen i virksomheden, ikke til at sammenligne med andre.'

const KRAEVER_OMSAETNING = {
  7: 'Bruttomarginen er bruttoresultatet i procent af omsætningen og kan ikke beregnes, når regnskabet kun viser bruttofortjeneste.',
  9: 'Kræver vareforbruget, som ikke er oplyst, når regnskabet kun viser bruttofortjeneste.',
  11: 'Nulpunktsomsætningen bygger på bruttomarginen og kan ikke beregnes uden omsætning.',
  12: 'Sikkerhedsmarginen bygger på nulpunktsomsætningen og kan ikke beregnes uden omsætning.',
  16: 'Kræver vareforbruget, som ikke er oplyst, når regnskabet kun viser bruttofortjeneste.',
  17: 'Varedebitorerne er opgjort i salgspriser inkl. moms og kan ikke holdes op mod bruttofortjenesten. Følg i stedet debitorernes udvikling direkte.',
  18: 'Kræver varekøbet, som ikke er oplyst, når regnskabet kun viser bruttofortjeneste.'
}

/** Oplyser regnskabet bruttofortjeneste, men ingen omsætning, i nogen af årene? */
export function manglerOmsaetning (dataset) {
  const aar = dataset.aar.map(y => withDerived(y.values)).filter(v => FIELDS.some(f => v[f.key] != null))
  return aar.length > 0 && aar.every(v => v.omsaetning == null) && aar.some(v => v.bruttoresultat != null)
}

export const beregnesPaaBrutto = dataset => !!dataset.bruttoBasis && manglerOmsaetning(dataset)

/**
 * Nøgletallene, som de skal vises for netop dette regnskab: uden omsætning
 * får de nøgletal, der ikke kan beregnes, en konkret forklaring, og — når
 * brugeren har valgt det — erstattes omsætningen af bruttofortjenesten i de
 * nøgletal, hvor det giver mening.
 */
export function nogletalFor (dataset) {
  if (!manglerOmsaetning(dataset)) return NOGLETAL
  const brutto = !!dataset.bruttoBasis
  return NOGLETAL.map(n => {
    if (MED_BRUTTOFORTJENESTE[n.nr]) {
      if (!brutto) return { ...n, ikkeBeregnet: 'Kræver omsætning, som regnskabet ikke oplyser. Slå "Beregn på bruttofortjeneste" til øverst på siden for at få en variant beregnet på bruttofortjenesten.' }
      const { forklaring, ...ov } = MED_BRUTTOFORTJENESTE[n.nr]
      return { ...n, ...ov, forklaring: (forklaring || n.forklaring) + BRUTTO_FORBEHOLD, medBrutto: true }
    }
    if (KRAEVER_OMSAETNING[n.nr]) return { ...n, ikkeBeregnet: KRAEVER_OMSAETNING[n.nr] }
    if (n.nr === 10) {
      return { ...n, forklaring: n.forklaring + ' Obs: I et regnskab med bruttofortjeneste er andre eksterne omkostninger allerede trukket fra i bruttofortjenesten, så de indgår hverken i tælleren eller nævneren. Tallet kan derfor ikke sammenlignes med virksomheder, der oplyser omsætning.' }
    }
    return n
  })
}

// Nøgletallene regnes på beløb i den valgte visningsenhed (fx 1.000 kr.),
// mens aktietal er i kroner og stk.; skaleringsfaktoren retter resultat/indre
// værdi pr. aktie op i hele kroner.
export function beregnAar (dataset, index, ekstraNogletal = []) {
  const c = buildContext(dataset, index)
  const cBrutto = { ...c, v: { ...c.v, omsaetning: c.v.bruttoresultat } }
  const faktor = enhedFaktor(dataset.enhed || '')
  const ud = {}

  // 25 og 27 skal beregnes først, fordi 26 og 28 bygger på dem.
  const rows = [...nogletalFor(dataset), ...ekstraNogletal].sort((a, b) => {
    const order = n => ([26, 28].includes(n.nr) ? 1 : 0)
    return order(a) - order(b)
  })

  rows.forEach(n => {
    const r = n.ikkeBeregnet ? {} : (n.calc(n.medBrutto ? cBrutto : c) || {})
    let value = div(r.num, r.den)
    if (value != null) {
      if (r.pct) value *= 100
      if (r.skalering) value *= faktor
    }
    if (n.nr === 25) c.eps = value
    if (n.nr === 27) c.indreVaerdi = value
    ud[n.nr] = {
      nr: n.nr,
      value,
      num: r.num == null ? null : (r.pct ? r.num * 100 : r.num),
      den: r.den,
      skoen: !!r.skoen
    }
  })
  return ud
}

export function beregnAlle (dataset, ekstraNogletal = []) {
  const vist = iVisningsenhed(dataset)
  return vist.aar.map((_, i) => beregnAar(vist, i, ekstraNogletal))
}

function kortEnhed (e) {
  if (/1\.000/.test(e)) return 't.kr.'
  if (/mio/.test(e)) return 'mio.'
  return 'kr.'
}

/**
 * Procentvis ændring fra det første til det sidste år, der har et tal.
 * Nævneren er første års tal uden fortegn, så et fald altid bliver negativt
 * — også når nøgletallet startede under nul.
 */
export function procentvisAendring (resultater, nr) {
  const tal = resultater.map(r => r[nr]?.value).filter(v => v != null && Number.isFinite(v))
  if (tal.length < 2 || tal[0] === 0) return null
  return (tal[tal.length - 1] - tal[0]) / Math.abs(tal[0]) * 100
}

export function formatAendring (p) {
  if (p == null || !Number.isFinite(p)) return '–'
  return (p > 0 ? '+' : '') + new Intl.NumberFormat('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p) + ' %'
}

/** 'op' (bedre), 'ned' (dårligere) eller 'neutral' for en ændring, ud fra nøgletallets "bedre"-retning. */
export function aendringsretning (n, p) {
  if (p == null || Math.abs(p) < 0.05 || n.bedre === 'neutral') return 'neutral'
  return (p > 0) === (n.bedre !== 'ned') ? 'op' : 'ned'
}

export function formatVaerdi (n, value, enhedstekst = '') {
  if (value == null || !Number.isFinite(value)) return '–'
  // Tal under 10 får to decimaler, så fx en overskudsgrad på 0,37 % ikke
  // vises som 0,4 % — ellers kan den procentvise ændring ikke regnes efter.
  const decimaler = Math.abs(value) < 10 ? 2 : 1
  const d = new Intl.NumberFormat('da-DK', { minimumFractionDigits: decimaler, maximumFractionDigits: decimaler })
  const h = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 })
  switch (n.enhed) {
    case '%': return d.format(value) + ' %'
    case 'gange': return d.format(value) + ' gange'
    case 'indeks': return h.format(value)
    case 'kr': return d.format(value) + ' kr.'
    case 'beløb': return h.format(value) + (enhedstekst ? ' ' + kortEnhed(enhedstekst) : '')
    default: return d.format(value)
  }
}

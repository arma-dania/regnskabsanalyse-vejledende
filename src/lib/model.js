// Regnskabet i analyseform: de poster, der skal til for at beregne alle 28 nøgletal.
// En almindelig post får sin værdi fra de af regnskabets poster, den studerende
// har placeret på den. "derived" = beregnes automatisk ud fra de andre poster.

export const SECTIONS = [
  { id: 'resultat', title: 'Resultatopgørelse i analyseform' },
  { id: 'aktiver', title: 'Balance – aktiver (ultimo)' },
  { id: 'passiver', title: 'Balance – passiver (ultimo)' },
  { id: 'ovrigt', title: 'Pengestrøm og aktieoplysninger' }
]

export const FIELDS = [
  // --- Resultatopgørelse ---
  { key: 'omsaetning', label: 'Nettoomsætning', section: 'resultat' },
  { key: 'vareforbrug', label: 'Vareforbrug / produktionsomkostninger', section: 'resultat' },
  { key: 'bruttoresultat', label: 'Bruttoresultat (bruttofortjeneste)', section: 'resultat', derived: 'omsaetning - vareforbrug' },
  { key: 'personaleomkostninger', label: 'Personaleomkostninger', section: 'resultat' },
  { key: 'andreEksterne', label: 'Andre eksterne kapacitetsomkostninger', section: 'resultat' },
  { key: 'afskrivninger', label: 'Af- og nedskrivninger', section: 'resultat' },
  { key: 'kapacitetsomkostninger', label: 'Kapacitetsomkostninger i alt', section: 'resultat', derived: 'personale + andre eksterne + afskrivninger' },
  { key: 'resultatPrimaerDrift', label: 'Resultat af primær drift (EBIT)', section: 'resultat', derived: 'bruttoresultat - kapacitetsomkostninger' },
  { key: 'finansielleIndtaegter', label: 'Finansielle indtægter', section: 'resultat' },
  { key: 'finansielleOmkostninger', label: 'Finansielle omkostninger', section: 'resultat' },
  { key: 'resultatFoerSkat', label: 'Resultat før skat', section: 'resultat', derived: 'EBIT + fin. indtægter - fin. omkostninger' },
  { key: 'skat', label: 'Skat af årets resultat', section: 'resultat' },
  { key: 'aaretsResultat', label: 'Årets resultat', section: 'resultat', derived: 'resultat før skat - skat' },

  // --- Aktiver ---
  { key: 'immaterielleAnlaeg', label: 'Immaterielle anlægsaktiver', section: 'aktiver' },
  { key: 'materielleAnlaeg', label: 'Materielle anlægsaktiver', section: 'aktiver' },
  { key: 'finansielleAnlaeg', label: 'Finansielle anlægsaktiver', section: 'aktiver' },
  { key: 'anlaegsaktiver', label: 'Anlægsaktiver i alt', section: 'aktiver', derived: 'immaterielle + materielle + finansielle' },
  { key: 'varelager', label: 'Varebeholdninger', section: 'aktiver' },
  { key: 'varedebitorer', label: 'Tilgodehavender fra salg (varedebitorer)', section: 'aktiver' },
  { key: 'andreTilgodehavender', label: 'Andre tilgodehavender', section: 'aktiver' },
  { key: 'likvider', label: 'Likvide beholdninger', section: 'aktiver' },
  { key: 'omsaetningsaktiver', label: 'Omsætningsaktiver i alt', section: 'aktiver', derived: 'varelager + debitorer + andre tilgodeh. + likvider' },
  { key: 'aktiverIAlt', label: 'Aktiver i alt (balancesum)', section: 'aktiver', derived: 'anlægsaktiver + omsætningsaktiver' },

  // --- Passiver ---
  { key: 'egenkapital', label: 'Egenkapital', section: 'passiver' },
  { key: 'hensatteForpligtelser', label: 'Hensatte forpligtelser', section: 'passiver' },
  { key: 'langfristetGaeld', label: 'Langfristede gældsforpligtelser', section: 'passiver' },
  { key: 'leverandoergaeld', label: 'Leverandørgæld (varekreditorer)', section: 'passiver' },
  { key: 'andenKortfristetGaeld', label: 'Anden kortfristet gæld', section: 'passiver' },
  { key: 'kortfristetGaeld', label: 'Kortfristede gældsforpligtelser i alt', section: 'passiver', derived: 'leverandørgæld + anden kortfristet gæld' },
  { key: 'passiverIAlt', label: 'Passiver i alt', section: 'passiver', derived: 'egenkapital + hensatte + langfristet + kortfristet' },

  // --- Øvrigt ---
  { key: 'pengestroemPrimaerDrift', label: 'Pengestrøm fra primær drift', section: 'ovrigt' },
  { key: 'antalAktier', label: 'Antal aktier (stk.)', section: 'ovrigt', unit: 'stk' },
  { key: 'boerskurs', label: 'Børskurs (kr. pr. aktie)', section: 'ovrigt', unit: 'kr' }
]

export const FIELD_MAP = Object.fromEntries(FIELDS.map(f => [f.key, f]))

// Afsnittene i det indlæste regnskab, som det står.
export const REGNSKABSAFSNIT = [
  { id: 'resultat', title: 'Resultatopgørelse' },
  { id: 'aktiver', title: 'Balance – aktiver' },
  { id: 'passiver', title: 'Balance – passiver' },
  { id: 'pengestroem', title: 'Pengestrømsopgørelse' }
]

// Hele balancen kan have en primoværdi. Det ældste årsregnskabs
// sammenligningsår leverer den fjerde balancedato, som gennemsnitstallene
// i nøgletal 1, 3, 4, 5 og 6 skal bruge for det første analyseår.
export const PRIMO_FIELDS = FIELDS
  .filter(f => f.section === 'aktiver' || f.section === 'passiver')
  .map(f => f.key)

export function emptyYear (label = '') {
  const values = {}
  FIELDS.forEach(f => { values[f.key] = null })
  return { label, values, poster: {} }
}

export function emptyDataset () {
  return {
    virksomhed: '',
    enhed: '1.000 kr.',
    indeksBasisaar: 0,
    aar: [emptyYear('År 1'), emptyYear('År 2'), emptyYear('År 3')],
    primo: {},
    // Regnskabets egne poster ({ id, label, sektion, erSum }) i regnskabets
    // rækkefølge og deres tal pr. år (aar[i].poster) og i primo.
    poster: [],
    primoPoster: {},
    // Den studerendes omformning af resultatopgørelsen: postrækkefølgen og
    // sammenlægningerne ({ [id på posten, der blev trukket ind på]: { navn, dele: [id, …] } }).
    raekkefoelge: [],
    sammenlaegninger: {},
    flyttede: []
  }
}

// Tallene gemmes i regnskabets egen enhed (grundenhed, fx kr. fra XBRL) og
// omregnes kun, når de vises, til den enhed, der er valgt under "Beløb angivet i".
export function enhedFaktor (enhed = '') {
  if (/mio/i.test(enhed)) return 1e6
  if (/1\.?000|t\.?kr/i.test(enhed)) return 1000
  return 1
}
export const visningsfaktor = dataset => enhedFaktor(dataset.grundenhed ?? dataset.enhed) / enhedFaktor(dataset.enhed)

// Beløbsposter (ikke antal aktier og børskurs) omregnet til visningsenheden.
export function iVisningsenhed (dataset) {
  const f = visningsfaktor(dataset)
  if (f === 1) return dataset
  const omregn = values => Object.fromEntries(Object.entries(values || {}).map(([k, v]) => [k, v != null && !FIELD_MAP[k]?.unit ? v * f : v]))
  return { ...dataset, aar: dataset.aar.map(y => ({ ...y, values: omregn(y.values) })), primo: omregn(dataset.primo) }
}

// Hvilken post i analyseformen et regnskabsbegreb svarer til. Bruges kun i
// baggrunden til nøgletallene — den studerende ser regnskabets egne poster.
const ROLLER = {
  omsaetning: ['Revenue', 'SalesRevenue', 'RevenueFromContractsWithCustomers'],
  vareforbrug: ['CostOfSales', 'RawMaterialsAndConsumablesUsed', 'CostOfGoodsSold', 'ChangesInInventoriesOfFinishedGoodsWorkInProgressAndGoodsForResale'],
  personaleomkostninger: ['EmployeeBenefitsExpense', 'StaffCosts', 'WagesAndSalaries', 'Salaries', 'PensionCosts', 'PostemploymentBenefitExpense', 'OtherSocialSecurityContributions', 'SocialSecurityContributions', 'OtherEmployeeBenefitsExpense', 'OtherStaffCosts'],
  // Distributions- og administrationsomkostninger i en funktionsopdelt
  // resultatopgørelse er kapacitetsomkostninger.
  andreEksterne: ['OtherExternalExpenses', 'ExternalExpenses', 'DistributionCosts', 'AdministrativeExpenses', 'AdministrativeExpense'],
  afskrivninger: ['DepreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss', 'DepreciationAmortisationExpense', 'DepreciationAndAmortisation'],
  // Indtægter af kapitalandele (datterselskaber og associerede) står under
  // de finansielle poster i analyseformen – ellers falder de ud af årets
  // resultat, og egenkapitalens forrentning bliver for lav.
  finansielleIndtaegter: ['OtherFinanceIncome', 'FinanceIncome', 'FinancialIncome', 'IncomeFromInvestmentsInGroupEnterprises', 'IncomeFromInvestmentsInAssociates', 'ShareOfProfitLossOfAssociatesAndJointVenturesAccountedForUsingEquityMethod'],
  finansielleOmkostninger: ['OtherFinanceExpenses', 'FinanceCosts', 'FinancialExpenses'],
  skat: ['TaxExpenseOnOrdinaryActivities', 'TaxExpense', 'IncomeTaxExpenseContinuingOperations', 'IncomeTaxExpense'],
  immaterielleAnlaeg: ['IntangibleAssets'],
  materielleAnlaeg: ['PropertyPlantAndEquipment'],
  finansielleAnlaeg: ['LongtermInvestmentsAndReceivables', 'NoncurrentFinancialAssets'],
  varelager: ['Inventories'],
  varedebitorer: ['ShorttermTradeReceivables', 'TradeReceivables', 'CurrentTradeReceivables'],
  andreTilgodehavender: ['OtherShorttermReceivables', 'OtherCurrentReceivables'],
  likvider: ['CashAndCashEquivalents'],
  egenkapital: ['Equity'],
  hensatteForpligtelser: ['Provisions'],
  langfristetGaeld: ['LongtermLiabilitiesOtherThanProvisions', 'NoncurrentLiabilities'],
  leverandoergaeld: ['ShorttermTradePayables', 'TradePayables'],
  andenKortfristetGaeld: ['OtherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsShortterm'],
  pengestroemPrimaerDrift: ['CashFlowFromOperatingActivities', 'CashFlowsFromUsedInOperatingActivities'],

  // Regnskabets egne summer. I resultatopgørelsen bruges de kun, når
  // summen ikke kan regnes ud fra posterne (fx et klasse B-regnskab uden
  // nettoomsætning); i balancen, der ikke omformes, bruges de altid.
  bruttoresultat: ['GrossProfitLoss', 'GrossResult', 'GrossProfit'],
  resultatPrimaerDrift: ['ProfitLossFromOrdinaryOperatingActivities', 'ProfitLossFromOperatingActivities'],
  resultatFoerSkat: ['ProfitLossFromOrdinaryActivitiesBeforeTax', 'ProfitLossBeforeTax'],
  aaretsResultat: ['ProfitLoss'],
  anlaegsaktiver: ['NoncurrentAssets'],
  omsaetningsaktiver: ['CurrentAssets'],
  aktiverIAlt: ['Assets'],
  kortfristetGaeld: ['ShorttermLiabilitiesOtherThanProvisions', 'CurrentLiabilities'],
  passiverIAlt: ['LiabilitiesAndEquity', 'EquityAndLiabilities']
}
const ROLLE_FOR_BEGREB = new Map(Object.entries(ROLLER).flatMap(([key, begreber]) => begreber.map(b => [b.toLowerCase(), key])))
const RESULTAT_SUMMER = ['bruttoresultat', 'resultatPrimaerDrift', 'resultatFoerSkat', 'aaretsResultat']

// XBRL-posters id er "<afsnit>:<begreb>"; PDF-poster har i stedet et forslag.
const begrebFor = p => (p.id.startsWith('pdf:') ? null : p.id.slice(p.id.indexOf(':') + 1).toLowerCase())
const egenRolle = p => (begrebFor(p) ? ROLLE_FOR_BEGREB.get(begrebFor(p)) : p.forslag) || null

// Om en post er en indtægt eller en omkostning. Omkostninger står som
// positive tal, så lægges en indtægt sammen med en omkostning (fx andre
// driftsindtægter med andre eksterne omkostninger), skal den trækkes fra.
const ROLLE_ART = {
  omsaetning: 'indtaegt',
  finansielleIndtaegter: 'indtaegt',
  vareforbrug: 'omkostning',
  personaleomkostninger: 'omkostning',
  andreEksterne: 'omkostning',
  afskrivninger: 'omkostning',
  finansielleOmkostninger: 'omkostning',
  skat: 'omkostning'
}
const ART_FOR_BEGREB = new Map([
  ...['OtherOperatingIncome', 'ChangesInInventoriesOfFinishedGoodsWorkInProgressAndGoodsForResale', 'IncomeFromInvestmentsInGroupEnterprises', 'IncomeFromInvestmentsInAssociates', 'InterestIncomeFromGroupEnterprises', 'OtherInterestIncome'].map(b => [b.toLowerCase(), 'indtaegt']),
  ['otheroperatingexpenses', 'omkostning']
])
const KAPACITET_FUNKTION = ['distributioncosts', 'administrativeexpenses', 'administrativeexpense', 'otheroperatingexpenses']
const artFor = p => {
  if (!p) return null
  const b = begrebFor(p)
  return (b && ART_FOR_BEGREB.get(b)) || ROLLE_ART[egenRolle(p)] || null
}
const fortegn = (a, b) => (a && b && a !== b ? -1 : 1)

export const postMap = dataset => new Map((dataset.poster || []).map(p => [p.id, p]))

/** En posts rolle i nøgletallene: sin egen, ellers den første blandt de sammenlagte dele. */
export function rolle (dataset, p, map = postMap(dataset)) {
  const dele = dataset.sammenlaegninger?.[p.id]?.dele || []
  return egenRolle(p) || dele.map(id => map.get(id)).filter(Boolean).map(egenRolle).find(Boolean) || null
}

export const postNavn = (dataset, p) => dataset.sammenlaegninger?.[p.id]?.navn ?? p.label

/**
 * En posts tal i ét år (eller primo): dens eget plus de sammenlagte deles.
 * En del af den modsatte art (indtægt mod omkostning) trækkes fra.
 */
export function postTal (dataset, p, tal, map = postMap(dataset)) {
  const art = artFor(p)
  let sum = null
  ;[p.id, ...(dataset.sammenlaegninger?.[p.id]?.dele || [])].forEach(id => {
    const v = tal?.[id]
    if (v == null) return
    sum = (sum ?? 0) + v * (id === p.id ? 1 : fortegn(art, artFor(map.get(id))))
  })
  return sum
}

/** De poster, der vises i et afsnit — i resultatopgørelsen efter omformningen. */
export function synligePoster (dataset, sektion) {
  const map = postMap(dataset)
  if (sektion === 'resultat') return (dataset.raekkefoelge || []).map(id => map.get(id)).filter(Boolean)
  return (dataset.poster || []).filter(p => p.sektion === sektion)
}

/**
 * Nøgletallenes grundlag: hver synlig post lægges til sin rolle. Summerne i
 * resultatopgørelsen regnes ud fra posterne, så den studerendes omformning
 * slår igennem; kun hvor det ikke kan lade sig gøre, bruges regnskabets egen
 * sum. Balancen omformes ikke, så dens egne summer bruges direkte.
 */
export function beregnAnalyse (dataset) {
  const kopi = structuredClone(dataset)
  const map = postMap(kopi)
  const synlige = REGNSKABSAFSNIT.flatMap(a => synligePoster(kopi, a.id))
  const beregn = tal => {
    const values = {}
    FIELDS.forEach(f => { values[f.key] = null })
    const rapporteret = {}
    synlige.forEach(p => {
      const v = postTal(kopi, p, tal, map)
      const r = rolle(kopi, p, map)
      if (v == null || !r) return
      if (FIELD_MAP[r].derived) { if (rapporteret[r] == null) rapporteret[r] = v; return }
      values[r] = (values[r] ?? 0) + v * fortegn(ROLLE_ART[r], artFor(p))
    })
    Object.entries(rapporteret).forEach(([k, v]) => { if (!RESULTAT_SUMMER.includes(k)) values[k] = v })
    RESULTAT_SUMMER.forEach(k => {
      if (rapporteret[k] != null && withDerived(values)[k] == null) values[k] = rapporteret[k]
    })
    return values
  }
  kopi.aar.forEach(y => {
    y.values = beregn(y.poster)
    // Regnskabets egne resultattal til kontrol af omformningen (se validate).
    const r = beregnRapporteret(kopi, y.poster, synlige, map)
    if (Object.keys(r).length) y.rapporteret = r; else delete y.rapporteret
  })
  const primo = beregn(kopi.primoPoster)
  kopi.primo = Object.fromEntries(PRIMO_FIELDS.filter(k => primo[k] != null).map(k => [k, primo[k]]))
  return kopi
}

// Regnskabets egne summer for årets resultat og resultat før skat.
function beregnRapporteret (dataset, tal, synlige, map) {
  const ud = {}
  synlige.forEach(p => {
    const r = rolle(dataset, p, map)
    if (r !== 'aaretsResultat' && r !== 'resultatFoerSkat') return
    const v = postTal(dataset, p, tal, map)
    if (v != null && ud[r] == null) ud[r] = v
  })
  return ud
}

/** Trækker kilden ind på målet: tallene lægges sammen, og målet får det nye navn. */
export function laegSammen (dataset, kildeId, maalId, navn) {
  const sam = { ...(dataset.sammenlaegninger || {}) }
  const dele = [...(sam[maalId]?.dele || []), kildeId, ...(sam[kildeId]?.dele || [])]
  delete sam[kildeId]
  sam[maalId] = { navn, dele }
  return beregnAnalyse({
    ...dataset,
    sammenlaegninger: sam,
    raekkefoelge: dataset.raekkefoelge.filter(id => id !== kildeId),
    flyttede: (dataset.flyttede || []).filter(id => id !== kildeId)
  })
}

/** Skiller en sammenlagt post ad igen; delene sættes ind lige efter den. */
export function fortrydSammenlaegning (dataset, maalId) {
  const sam = { ...(dataset.sammenlaegninger || {}) }
  const dele = sam[maalId]?.dele || []
  delete sam[maalId]
  const raekkefoelge = [...dataset.raekkefoelge]
  raekkefoelge.splice(raekkefoelge.indexOf(maalId) + 1, 0, ...dele)
  return beregnAnalyse({ ...dataset, sammenlaegninger: sam, raekkefoelge })
}

/** Flytter en post i resultatopgørelsen til lige før eller efter en anden. */
export function flytPost (dataset, id, naboId, efter) {
  const raekkefoelge = dataset.raekkefoelge.filter(x => x !== id)
  const i = raekkefoelge.indexOf(naboId)
  raekkefoelge.splice(efter ? i + 1 : i, 0, id)
  if (raekkefoelge.join() === dataset.raekkefoelge.join()) return dataset
  return { ...dataset, raekkefoelge, flyttede: [...new Set([...(dataset.flyttede || []), id])] }
}

/** Sætter en flyttet post tilbage på sin plads i regnskabets egen rækkefølge. */
export function fortrydFlytning (dataset, id) {
  const orden = new Map((dataset.poster || []).map((p, i) => [p.id, i]))
  const flyttede = (dataset.flyttede || []).filter(x => x !== id)
  const raekkefoelge = dataset.raekkefoelge.filter(x => x !== id)
  const i = raekkefoelge.findIndex(x => !flyttede.includes(x) && orden.get(x) > orden.get(id))
  raekkefoelge.splice(i < 0 ? raekkefoelge.length : i, 0, id)
  return { ...dataset, raekkefoelge, flyttede }
}

const lilleBegyndelse = t => (/^\p{Lu}\p{Ll}/u.test(t) ? t[0].toLocaleLowerCase('da') + t.slice(1) : t)

/** Navneforslag til en sammenlagt post — det første er det bedste bud. */
export function navneforslag (dataset, kildeId, maalId) {
  const map = postMap(dataset)
  const maal = map.get(maalId)
  const kilde = map.get(kildeId)
  const mNavn = postNavn(dataset, maal)
  const kNavn = postNavn(dataset, kilde)
  const alle = [maal, kilde, ...[maalId, kildeId].flatMap(id => dataset.sammenlaegninger?.[id]?.dele || []).map(id => map.get(id))].filter(Boolean)
  const forslag = []
  if (alle.every(p => egenRolle(p) === 'personaleomkostninger')) forslag.push('Personaleomkostninger')
  if (alle.every(p => artFor(p) === 'omkostning') && alle.some(p => KAPACITET_FUNKTION.includes(begrebFor(p)))) forslag.push('Kapacitetsomkostninger')
  if (fortegn(artFor(maal), artFor(kilde)) === -1) {
    forslag.push(`${mNavn} fratrukket ${lilleBegyndelse(kNavn)}`)
    forslag.push(`${mNavn}, netto`)
  } else {
    forslag.push(`${mNavn} og ${lilleBegyndelse(kNavn)}`)
    forslag.push(`${mNavn} (inkl. ${lilleBegyndelse(kNavn)})`)
  }
  return [...new Set(forslag)]
}

/** Det omformede regnskab til eksport: afsnit med de poster, der vises, i visningsenheden. */
export function omformetRegnskab (dataset) {
  const f = visningsfaktor(dataset)
  return REGNSKABSAFSNIT
    .map(a => ({
      ...a,
      raekker: synligePoster(dataset, a.id).map(p => ({
        navn: postNavn(dataset, p),
        erSum: p.erSum,
        tal: dataset.aar.map(y => { const v = postTal(dataset, p, y.poster); return v == null ? null : v * f })
      })).filter(r => r.tal.some(v => v != null))
    }))
    .filter(a => a.raekker.length)
}

/** De flyttede poster, og hvor de står nu. */
export function flytningsoversigt (dataset) {
  const map = postMap(dataset)
  const r = dataset.raekkefoelge || []
  return (dataset.flyttede || [])
    .filter(id => r.includes(id))
    .map(id => {
      const foer = map.get(r[r.indexOf(id) - 1])
      return {
        id,
        navn: postNavn(dataset, map.get(id)),
        plads: foer ? `står nu efter ${postNavn(dataset, foer)}` : 'står nu øverst i resultatopgørelsen'
      }
    })
}

/**
 * Oversigten over sammenlægninger: det nye navn og de poster, det består af,
 * som et regnestykke (fx "Andre eksterne omkostninger − Andre driftsindtægter").
 */
export function sammenlaegningsoversigt (dataset) {
  const map = postMap(dataset)
  return (dataset.raekkefoelge || [])
    .filter(id => dataset.sammenlaegninger?.[id])
    .map(id => {
      const maal = map.get(id)
      const udtryk = dataset.sammenlaegninger[id].dele
        .map(d => map.get(d))
        .filter(Boolean)
        .reduce((t, q) => `${t} ${fortegn(artFor(maal), artFor(q)) === -1 ? '−' : '+'} ${q.label}`, maal?.label || '')
      return { id, navn: dataset.sammenlaegninger[id].navn, udtryk }
    })
}

/** Artsopdelt eller funktionsopdelt resultatopgørelse, ud fra regnskabets begreber. */
export function opstillingsform (dataset) {
  const begreber = (dataset.poster || []).filter(p => p.sektion === 'resultat').map(begrebFor)
  if (begreber.some(b => ['costofsales', 'distributioncosts', 'administrativeexpenses', 'administrativeexpense'].includes(b))) return 'funktion'
  if (begreber.some(b => ['otherexternalexpenses', 'employeebenefitsexpense', 'rawmaterialsandconsumablesused'].includes(b))) return 'arts'
  return null
}

// Afledte poster udfyldes kun, hvor der ikke allerede står et tal.
export function withDerived (values) {
  const v = { ...values }
  const har = k => v[k] !== null && v[k] !== undefined && !Number.isNaN(v[k])
  const udfyld = (k, fn) => {
    if (har(k)) return
    const r = fn()
    if (r !== null && r !== undefined && !Number.isNaN(r)) v[k] = r
  }
  const sum = (...keys) => {
    const fundne = keys.filter(har)
    if (!fundne.length) return null
    return fundne.reduce((a, k) => a + v[k], 0)
  }

  udfyld('bruttoresultat', () => (har('omsaetning') && har('vareforbrug') ? v.omsaetning - v.vareforbrug : null))
  udfyld('kapacitetsomkostninger', () => sum('personaleomkostninger', 'andreEksterne', 'afskrivninger'))
  udfyld('resultatPrimaerDrift', () => (har('bruttoresultat') && har('kapacitetsomkostninger') ? v.bruttoresultat - v.kapacitetsomkostninger : null))
  udfyld('anlaegsaktiver', () => sum('immaterielleAnlaeg', 'materielleAnlaeg', 'finansielleAnlaeg'))
  udfyld('omsaetningsaktiver', () => sum('varelager', 'varedebitorer', 'andreTilgodehavender', 'likvider'))
  udfyld('aktiverIAlt', () => (har('anlaegsaktiver') && har('omsaetningsaktiver') ? v.anlaegsaktiver + v.omsaetningsaktiver : null))
  udfyld('kortfristetGaeld', () => sum('leverandoergaeld', 'andenKortfristetGaeld'))
  udfyld('passiverIAlt', () => sum('egenkapital', 'hensatteForpligtelser', 'langfristetGaeld', 'kortfristetGaeld'))
  udfyld('resultatFoerSkat', () => (har('resultatPrimaerDrift')
    ? v.resultatPrimaerDrift + (v.finansielleIndtaegter || 0) - (v.finansielleOmkostninger || 0)
    : null))
  udfyld('aaretsResultat', () => (har('resultatFoerSkat') ? v.resultatFoerSkat - (v.skat || 0) : null))
  return v
}

// Slår en liste af årstal ("2023", "2024", "2025") sammen til "2023-2025",
// eller "2023 og 2024" / "2023, 2024 og 2025", når de ikke er årstal eller
// ikke er fortløbende — så samme besked for flere år ikke gentages ordret.
function formatAarListe (labels) {
  if (labels.length === 1) return labels[0]
  const erAarstal = labels.every(l => /^\d{4}$/.test(l))
  if (erAarstal) {
    const tal = labels.map(Number)
    const fortloebende = tal.every((t, i) => i === 0 || t === tal[i - 1] + 1)
    if (fortloebende) return `${tal[0]}-${tal[tal.length - 1]}`
  }
  return labels.slice(0, -1).join(', ') + ' og ' + labels[labels.length - 1]
}

// Kontroller, der fanger typiske fejl i omformningen.
// Samme besked for flere år (fx samme post mangler hvert år) slås sammen
// til én, i stedet for at gentages ordret for hvert enkelt år.
export function validate (dataset) {
  const raa = []
  dataset.aar.forEach((y, i) => {
    const v = withDerived(y.values)
    const label = y.label || `År ${i + 1}`
    const near = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(a) * 0.005)
    if (v.aktiverIAlt != null && v.passiverIAlt != null && !near(v.aktiverIAlt, v.passiverIAlt)) {
      raa.push({ level: 'error', year: label, text: `Balancen stemmer ikke: aktiver ${fmt(v.aktiverIAlt)} mod passiver ${fmt(v.passiverIAlt)}.` })
    }
    // Analyseformens resultat skal give regnskabets eget. Gør det ikke, er en
    // post i resultatopgørelsen uden plads i analyseformen – og så er
    // egenkapitalens forrentning og resultat pr. aktie forkerte.
    for (const [k, navn] of [['aaretsResultat', 'Årets resultat'], ['resultatFoerSkat', 'Resultat før skat']]) {
      const rap = y.rapporteret?.[k]
      if (rap == null || v[k] == null || near(rap, v[k])) continue
      raa.push({ level: 'error', year: label, text: `${navn} er ${fmt(rap)} kr. i regnskabet, men ${fmt(v[k])} kr. i analyseformen. En post i resultatopgørelsen (fx andre driftsindtægter eller indtægter af kapitalandele) har ikke fået en plads i analyseformen, så nøgletallene bliver forkerte. Læg posten sammen med den post, den hører til.` })
      break
    }
    if (v.kapacitetsomkostninger != null && v.kapacitetsomkostninger < 0) {
      raa.push({ level: 'warn', year: label, text: 'Kapacitetsomkostninger er negative. Kontrollér, at der ikke er placeret en indtægt blandt omkostningerne.' })
    }
  })

  const grupper = new Map()
  raa.forEach(n => {
    const key = n.level + '|' + n.text
    if (!grupper.has(key)) grupper.set(key, { level: n.level, text: n.text, years: [] })
    grupper.get(key).years.push(n.year)
  })
  return [...grupper.values()].map(g => ({ level: g.level, year: formatAarListe(g.years), text: g.text }))
}

function fmt (n) {
  return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(n)
}

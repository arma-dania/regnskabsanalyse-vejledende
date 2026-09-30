import { udtraekBeretning, beretningFraBegreber, udbytteFraFakta, udbytteFraRaekker, flet } from './beretning.js'

// Regnskabet indlæses, som det står: hver post i resultatopgørelse, balance
// og pengestrømsopgørelse bliver sin egen række med regnskabets eget navn,
// i regnskabets egen rækkefølge. Intet lægges sammen eller placeres i
// analyseformen — det gør de studerende selv i Omform.
//
// Et inline XBRL-dokument (iXBRL) indeholder selve opstillingen, så navne og
// rækkefølge læses direkte fra tabellerne. En ren XBRL-instans har hverken
// navne eller rækkefølge; der bruges listen nedenfor som reserve. Listen
// bruges også til at vise sumposter med fed, som i regnskabet.
const KENDTE_POSTER = [
  // Resultatopgørelse
  ['Revenue', 'Nettoomsætning', 'resultat'],
  ['OtherOperatingIncome', 'Andre driftsindtægter', 'resultat'],
  ['ChangesInInventoriesOfFinishedGoodsWorkInProgressAndGoodsForResale', 'Ændring i lagre af færdigvarer og varer under fremstilling', 'resultat'],
  ['CostOfSales', 'Produktionsomkostninger', 'resultat'],
  ['RawMaterialsAndConsumablesUsed', 'Omkostninger til råvarer og hjælpematerialer', 'resultat'],
  ['OtherExternalExpenses', 'Andre eksterne omkostninger', 'resultat'],
  ['GrossProfitLoss', 'Bruttofortjeneste', 'resultat', true],
  ['GrossResult', 'Bruttoresultat', 'resultat', true],
  ['GrossProfit', 'Bruttoresultat', 'resultat', true],
  ['DistributionCosts', 'Distributionsomkostninger', 'resultat'],
  ['AdministrativeExpenses', 'Administrationsomkostninger', 'resultat'],
  ['AdministrativeExpense', 'Administrationsomkostninger', 'resultat'],
  ['EmployeeBenefitsExpense', 'Personaleomkostninger', 'resultat'],
  ['DepreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss', 'Af- og nedskrivninger af immaterielle og materielle anlægsaktiver', 'resultat'],
  ['OtherOperatingExpenses', 'Andre driftsomkostninger', 'resultat'],
  ['ProfitLossFromOrdinaryOperatingActivities', 'Resultat af primær drift', 'resultat', true],
  ['ProfitLossFromOperatingActivities', 'Resultat af primær drift', 'resultat', true],
  ['IncomeFromInvestmentsInGroupEnterprises', 'Indtægter af kapitalandele i tilknyttede virksomheder', 'resultat'],
  ['IncomeFromInvestmentsInAssociates', 'Indtægter af kapitalandele i associerede virksomheder', 'resultat'],
  ['OtherFinanceIncome', 'Andre finansielle indtægter', 'resultat'],
  ['FinanceIncome', 'Finansielle indtægter', 'resultat'],
  ['OtherFinanceExpenses', 'Andre finansielle omkostninger', 'resultat'],
  ['FinanceCosts', 'Finansielle omkostninger', 'resultat'],
  ['ProfitLossFromOrdinaryActivitiesBeforeTax', 'Resultat før skat', 'resultat', true],
  ['ProfitLossBeforeTax', 'Resultat før skat', 'resultat', true],
  ['TaxExpenseOnOrdinaryActivities', 'Skat af årets resultat', 'resultat'],
  ['TaxExpense', 'Skat af årets resultat', 'resultat'],
  ['IncomeTaxExpenseContinuingOperations', 'Skat af årets resultat', 'resultat'],
  ['ProfitLoss', 'Årets resultat', 'resultat', true],

  // Aktiver
  ['CompletedDevelopmentProjects', 'Færdiggjorte udviklingsprojekter', 'aktiver'],
  ['AcquiredIntangibleAssets', 'Erhvervede immaterielle anlægsaktiver', 'aktiver'],
  ['Goodwill', 'Goodwill', 'aktiver'],
  ['IntangibleAssets', 'Immaterielle anlægsaktiver', 'aktiver', true],
  ['IntangibleAssetsOtherThanGoodwill', 'Immaterielle aktiver', 'aktiver'],
  ['LandAndBuildings', 'Grunde og bygninger', 'aktiver'],
  ['PlantAndMachinery', 'Produktionsanlæg og maskiner', 'aktiver'],
  ['FixturesFittingsToolsAndEquipment', 'Andre anlæg, driftsmateriel og inventar', 'aktiver'],
  ['LeaseholdImprovements', 'Indretning af lejede lokaler', 'aktiver'],
  ['PropertyPlantAndEquipmentInProgress', 'Materielle anlægsaktiver under udførelse', 'aktiver'],
  ['PropertyPlantAndEquipment', 'Materielle anlægsaktiver', 'aktiver', true],
  ['LongtermInvestmentsInGroupEnterprises', 'Kapitalandele i tilknyttede virksomheder', 'aktiver'],
  ['LongtermInvestmentsInAssociates', 'Kapitalandele i associerede virksomheder', 'aktiver'],
  ['OtherLongtermInvestments', 'Andre værdipapirer og kapitalandele', 'aktiver'],
  ['DepositsLongtermInvestmentsAndReceivables', 'Deposita', 'aktiver'],
  ['OtherLongtermReceivables', 'Andre tilgodehavender', 'aktiver'],
  ['LongtermInvestmentsAndReceivables', 'Finansielle anlægsaktiver', 'aktiver', true],
  ['NoncurrentAssets', 'Anlægsaktiver', 'aktiver', true],
  ['RawMaterialsAndConsumables', 'Råvarer og hjælpematerialer', 'aktiver'],
  ['ManufacturedGoodsAndGoodsForResale', 'Fremstillede varer og handelsvarer', 'aktiver'],
  ['PrepaymentsForGoods', 'Forudbetalinger for varer', 'aktiver'],
  ['Inventories', 'Varebeholdninger', 'aktiver', true],
  ['ShorttermTradeReceivables', 'Tilgodehavender fra salg og tjenesteydelser', 'aktiver'],
  ['TradeAndOtherCurrentReceivables', 'Tilgodehavender fra salg og andre tilgodehavender', 'aktiver'],
  ['ShorttermReceivablesFromGroupEnterprises', 'Tilgodehavender hos tilknyttede virksomheder', 'aktiver'],
  ['OtherShorttermReceivables', 'Andre tilgodehavender', 'aktiver'],
  ['CurrentDeferredTaxAssets', 'Udskudt skatteaktiv', 'aktiver'],
  ['ShorttermTaxReceivables', 'Tilgodehavende selskabsskat', 'aktiver'],
  ['DeferredIncomeAssets', 'Periodeafgrænsningsposter', 'aktiver'],
  ['ShorttermReceivables', 'Tilgodehavender', 'aktiver', true],
  ['CashAndCashEquivalents', 'Likvide beholdninger', 'aktiver'],
  ['CurrentAssets', 'Omsætningsaktiver', 'aktiver', true],
  ['Assets', 'Aktiver', 'aktiver', true],

  // Passiver
  ['ContributedCapital', 'Virksomhedskapital', 'passiver'],
  ['SharePremium', 'Overkurs ved emission', 'passiver'],
  ['ReserveForNetRevaluationAccordingToEquityMethod', 'Reserve for nettoopskrivning efter den indre værdis metode', 'passiver'],
  ['ReserveForDevelopmentExpenditure', 'Reserve for udviklingsomkostninger', 'passiver'],
  ['RetainedEarnings', 'Overført resultat', 'passiver'],
  ['ProposedDividendRecognisedInEquity', 'Foreslået udbytte', 'passiver'],
  ['Equity', 'Egenkapital', 'passiver', true],
  ['ProvisionsForDeferredTax', 'Hensættelse til udskudt skat', 'passiver'],
  ['OtherProvisions', 'Andre hensatte forpligtelser', 'passiver'],
  ['Provisions', 'Hensatte forpligtelser', 'passiver', true],
  ['NoncurrentProvisions', 'Hensatte forpligtelser', 'passiver'],
  ['LongtermMortgageDebt', 'Gæld til realkreditinstitutter', 'passiver'],
  ['OtherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsLongterm', 'Anden gæld', 'passiver'],
  ['LongtermLiabilitiesOtherThanProvisions', 'Langfristede gældsforpligtelser', 'passiver', true],
  ['NoncurrentLiabilities', 'Langfristede forpligtelser', 'passiver', true],
  ['ShorttermPartOfLongtermLiabilitiesOtherThanProvisions', 'Kortfristet del af langfristede gældsforpligtelser', 'passiver'],
  ['ShorttermDebtToOtherCreditInstitutions', 'Gæld til kreditinstitutter', 'passiver'],
  ['ShorttermDebtToBanks', 'Gæld til banker', 'passiver'],
  ['ShorttermPrepaymentsReceivedFromCustomers', 'Modtagne forudbetalinger fra kunder', 'passiver'],
  ['ShorttermTradePayables', 'Leverandører af varer og tjenesteydelser', 'passiver'],
  ['TradeAndOtherCurrentPayables', 'Leverandørgæld og anden gæld', 'passiver'],
  ['ShorttermPayablesToGroupEnterprises', 'Gæld til tilknyttede virksomheder', 'passiver'],
  ['ShorttermTaxPayablesToGroupEnterprises', 'Gæld til tilknyttede virksomheder vedrørende selskabsskat', 'passiver'],
  ['ShorttermTaxPayables', 'Selskabsskat', 'passiver'],
  ['OtherPayablesIncludingTaxPayablesLiabilitiesOtherThanProvisionsShortterm', 'Anden gæld', 'passiver'],
  ['DeferredIncome', 'Periodeafgrænsningsposter', 'passiver'],
  ['ShorttermLiabilitiesOtherThanProvisions', 'Kortfristede gældsforpligtelser', 'passiver', true],
  ['CurrentLiabilities', 'Kortfristede forpligtelser', 'passiver', true],
  ['LiabilitiesOtherThanProvisions', 'Gældsforpligtelser', 'passiver', true],
  ['LiabilitiesAndEquity', 'Passiver', 'passiver', true],
  ['EquityAndLiabilities', 'Passiver', 'passiver', true],

  // Pengestrømsopgørelse
  ['CashFlowFromOperatingActivities', 'Pengestrømme fra driftsaktivitet', 'pengestroem', true],
  ['CashFlowsFromUsedInOperatingActivities', 'Pengestrømme fra driftsaktivitet', 'pengestroem', true],
  ['CashFlowFromInvestingActivities', 'Pengestrømme fra investeringsaktivitet', 'pengestroem', true],
  ['CashFlowsFromUsedInInvestingActivities', 'Pengestrømme fra investeringsaktivitet', 'pengestroem', true],
  ['CashFlowFromFinancingActivities', 'Pengestrømme fra finansieringsaktivitet', 'pengestroem', true],
  ['CashFlowsFromUsedInFinancingActivities', 'Pengestrømme fra finansieringsaktivitet', 'pengestroem', true]
]

const KENDT = new Map(KENDTE_POSTER.map(([navn, label, sektion, erSum], i) => [navn.toLowerCase(), { label, sektion, erSum: !!erSum, orden: i }]))

// Real browsers strip et navnerumspræfiks fra localName ved rigtig
// XML-tolkning (fx "nonFraction" for <ix:nonFraction>), men beholder det ved
// HTML-faldback (fx "ix:nonfraction"). Den letvægts-DOM-tolker, serverfunktionen
// bruger til store dokumenter, splitter aldrig navnerum og giver altid
// præfikset med — der splittes derfor altid selv, hvilket giver samme
// resultat i begge tilfælde uanset hvilken DOM-tolker der bruges.
function localName (el) {
  const raa = el.localName || el.nodeName || ''
  return raa.split(':').pop().toLowerCase()
}

/**
 * Laeser et talformateret tekstindhold. iXBRL-elementer angiver selv,
 * hvilket talformat de bruger, via format-attributten (fra XBRL's
 * Transformation Registry), fx "ixt:numdotdecimal" for engelsk/amerikansk
 * format (punktum som decimaltegn, komma som tusindtalsseparator), som
 * bl.a. bruges i engelsksprogede IFRS-aarsrapporter. Uden angivet format,
 * eller ved dansk format ("ixt:numcommadecimal" m.fl.), antages dansk
 * notation: komma som decimaltegn, punktum som tusindtalsseparator. En ren
 * (ikke-inline) XBRL-instans bruger derimod altid kanonisk XML-decimalform:
 * punktum som decimaltegn og aldrig tusindtalsseparatorer.
 */
function taelTeksten (raw, { erInline = true, format = null } = {}) {
  const s = String(raw).trim()
  if (!erInline) {
    const n = parseFloat(s)
    return Number.isFinite(n) ? n : null
  }
  if (format && /dot[-_]?decimal/i.test(format)) {
    const n = parseFloat(s.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  if (format && /zerodash|fixed-?zero/i.test(format)) return 0
  const n = parseFloat(s.replace(/[.\s ]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function laesKontekster (doc) {
  const ud = {}
  const noder = [...doc.querySelectorAll('*')].filter(el => localName(el) === 'context')
  noder.forEach(el => {
    const id = el.getAttribute('id')
    if (!id) return
    const harDimension = [...el.querySelectorAll('*')].some(c => localName(c) === 'explicitmember' || localName(c) === 'typedmember')
    const find = navn => {
      const n = [...el.querySelectorAll('*')].find(c => localName(c) === navn)
      return n ? n.textContent.trim() : null
    }
    ud[id] = {
      harDimension,
      start: find('startdate'),
      slut: find('enddate'),
      instant: find('instant')
    }
  })
  return ud
}

const rensTekst = s => String(s || '').replace(/­/g, '').replace(/\s+/g, ' ').trim()

// Tekstfelter i iXBRL kan være delt over flere elementer (ix:continuation),
// fx et CVR-nummer skrevet som "25 44 20 24" i fire bidder.
function tekstMedFortsaettelse (doc, el) {
  let tekst = el.textContent
  let naeste = el.getAttribute('continuedAt')
  const set = new Set()
  while (naeste && !set.has(naeste)) {
    set.add(naeste)
    const fortsat = doc.querySelector(`[id="${naeste}"]`)
    if (!fortsat) break
    tekst += ' ' + fortsat.textContent
    naeste = fortsat.getAttribute('continuedAt')
  }
  return tekst
}

function findStamdata (doc, begreb) {
  const el = [...doc.querySelectorAll('*')].find(e =>
    (e.getAttribute('name') || e.nodeName).split(':').pop().toLowerCase() === begreb)
  return el ? rensTekst(tekstMedFortsaettelse(doc, el)) : null
}

// Titlen på et iXBRL-dokument fra Erhvervsstyrelsen følger typisk mønsteret
// "<CVR-nummer> <Virksomhedsnavn> <startdato> - <slutdato> årsrapport" eller
// "<Virksomhedsnavn> - Årsrapport for 2025" — kun selve navnet skal med.
function navnFraTitel (raaTitel) {
  let t = raaTitel.trim().replace(/^\d{8}\s+/, '')
  const datoStart = t.match(/\s+\d{1,2}\.\s+\p{L}+\s+\d{4}/u)
  if (datoStart) t = t.slice(0, datoStart.index)
  t = t.replace(/\s+[-–]\s+års(rapport|regnskab).*$/iu, '')
  return t.trim()
}

// Overskrifter, der afgør, hvilken opgørelse de efterfølgende tal hører til.
// "Balance" alene (fx en mellemrubrik i hoved- og nøgletal) tæller kun, når
// den står lige efter resultatopgørelsen eller har en dato ("Balance 31.
// december"); "Aktiver"/"Passiver" kun inde i balancen.
function opgoerelseFraOverskrift (tekst, nu) {
  const t = tekst.toLowerCase()
  if (/^resultatopgørelse(\s|$)/.test(t) || /^income statement(\s|$)/.test(t)) return 'resultat'
  if (/^balance(\s|$)/.test(t) && (nu === 'resultat' || /\d/.test(t))) return 'aktiver'
  if (/^aktiver$/.test(t) && (nu === 'aktiver' || nu === 'passiver')) return 'aktiver'
  if (/^(passiver|egenkapital og forpligtelser)$/.test(t) && (nu === 'aktiver' || nu === 'passiver')) return 'passiver'
  if (/^pengestrømsopgørelse(\s|$)/.test(t)) return 'pengestroem'
  if (/^(egenkapitalopgørelse|noter(\s|$)|anvendt regnskabspraksis|hoved- og nøgletal|hovedtal|ledelsesberetning|ledelsespåtegning|påtegninger|den uafhængige revisors|oplysninger om|selskabsoplysninger|indholdsfortegnelse)/.test(t)) return null
  return undefined
}

const gruppe = s => (s === 'aktiver' || s === 'passiver' ? 'balance' : s)

// Postens navn, som det står i regnskabet: første celle i tabelrækken.
function raekkenavn (el) {
  const raekke = el.closest && el.closest('tr')
  if (raekke) {
    const celler = [...raekke.children].filter(c => /^(td|th)$/i.test(localName(c)))
    for (const c of celler) {
      if ([...c.querySelectorAll('*')].some(e => localName(e) === 'nonfraction')) break
      const t = rensTekst(c.textContent).replace(/\s+\d+(\s*,\s*\d+)*$/, '')
      if (/\p{L}/u.test(t)) return t
    }
  }
  return null
}

/**
 * Læser både inline XBRL (XHTML) og en ren XBRL-instans.
 *
 * ParserClass er en injicerbar DOMParser-klasse (default: browserens egen),
 * så den samme tolkning kan genbruges i en serverfunktion — fx til store
 * dokumenter, browseren ikke selv kan hente pga. CORS — med en letvægts
 * DOM-implementering (linkedom) i stedet.
 */
export function parseXbrlDokument (tekst, kilde = '', ParserClass = globalThis.DOMParser) {
  const parser = new ParserClass()
  let doc = parser.parseFromString(tekst, 'application/xhtml+xml')
  if (doc.getElementsByTagName('parsererror').length) doc = parser.parseFromString(tekst, 'text/html')

  const kontekster = laesKontekster(doc)
  const diagnostik = { antalElementer: 0, antalMatchede: 0, antalUdelukketPgaDimension: 0 }

  const alle = [...doc.querySelectorAll('*')]
  const erInlineDok = alle.some(el => localName(el) === 'nonfraction')

  // Et fund = ét tal i én opgørelse: { begreb, sektion, label, dato, vaerdi }.
  const fund = []
  const laesFakta = el => {
    const erInline = localName(el) === 'nonfraction'
    const begreb = erInline
      ? (el.getAttribute('name') || '').split(':').pop()
      : (el.getAttribute('contextRef') && el.getAttribute('unitRef') ? el.nodeName.split(':').pop() : null)
    if (!begreb) return null
    diagnostik.antalElementer++
    const ctx = kontekster[el.getAttribute('contextRef')]
    if (!ctx) return null
    if (ctx.harDimension) { diagnostik.antalUdelukketPgaDimension++; return null }
    let v = taelTeksten(el.textContent, { erInline, format: el.getAttribute('format') })
    if (v == null) return null
    const scale = parseInt(el.getAttribute('scale') || '0', 10)
    if (Number.isFinite(scale) && scale) v *= Math.pow(10, scale)
    if ((el.getAttribute('sign') || '') === '-') v = -v
    const dato = ctx.slut || ctx.instant
    if (!dato) return null
    return { begreb, dato, vaerdi: v, scale: Number.isFinite(scale) ? scale : 0 }
  }

  if (erInlineDok) {
    // Gå dokumentet igennem i rækkefølge og hold styr på, hvilken opgørelse
    // man står i. Hver opgørelse læses kun én gang: kommer overskriften igen
    // senere (fx i anvendt regnskabspraksis), er det ikke selve opgørelsen.
    let nu = null
    const faerdige = new Set()
    const medTal = new Set()
    // Mangler rubrikken "Passiver", begynder passiverne efter "Aktiver i alt".
    let aktiverIAltSet = false
    for (const el of alle) {
      if (localName(el) === 'nonfraction') {
        if (!nu || faerdige.has(gruppe(nu))) { laesFakta(el); continue }
        const f = laesFakta(el)
        if (!f) continue
        medTal.add(gruppe(nu))
        if (nu === 'aktiver' && aktiverIAltSet && f.begreb !== 'Assets') nu = 'passiver'
        if (nu === 'aktiver' && f.begreb === 'Assets') aktiverIAltSet = true
        fund.push({ ...f, sektion: nu, label: raekkenavn(el) })
        continue
      }
      const egenTekst = rensTekst([...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' '))
      if (egenTekst.length < 3 || egenTekst.length > 90) continue
      const ny = opgoerelseFraOverskrift(egenTekst, nu)
      if (ny === undefined || ny === nu) continue
      if (nu && gruppe(ny) !== gruppe(nu) && medTal.has(gruppe(nu))) faerdige.add(gruppe(nu))
      nu = ny
    }
  }

  // Reserve: ingen opgørelser fundet i dokumentet (fx en ren XBRL-instans).
  // Så bruges kun de kendte begreber, med standardnavn og -rækkefølge.
  const ikkeGenkendteNavne = new Map()
  if (!fund.length) {
    alle.forEach(el => {
      const f = laesFakta(el)
      if (!f) return
      const kendt = KENDT.get(f.begreb.toLowerCase())
      if (!kendt) { ikkeGenkendteNavne.set(f.begreb, (ikkeGenkendteNavne.get(f.begreb) || 0) + 1); return }
      fund.push({ ...f, sektion: kendt.sektion, label: kendt.label, orden: kendt.orden })
    })
    fund.sort((a, b) => a.orden - b.orden)
  }
  diagnostik.antalMatchede = fund.length

  // Et årsregnskab har to kolonner: regnskabsåret og sammenligningsåret.
  // Øvrige datoer (fx 5-årsoversigten) hører ikke til opgørelserne.
  const datoerPrAar = new Map()
  fund.forEach(f => {
    const aar = f.dato.slice(0, 4)
    if (!datoerPrAar.has(aar) || datoerPrAar.get(aar) < f.dato) datoerPrAar.set(aar, f.dato)
  })
  const aarstal = [...datoerPrAar.keys()].sort((a, b) => Number(b) - Number(a)).slice(0, 2)

  const poster = []
  const postMap = new Map()
  const kolonner = aarstal.map(aar => ({ navn: aar, values: {} }))
  fund.forEach(f => {
    const aar = f.dato.slice(0, 4)
    const kol = kolonner.find(k => k.navn === aar)
    if (!kol || datoerPrAar.get(aar) !== f.dato) return
    const id = `${f.sektion}:${f.begreb}`
    if (!postMap.has(id)) {
      const kendt = KENDT.get(f.begreb.toLowerCase())
      const post = { id, label: f.label || kendt?.label || f.begreb, sektion: f.sektion, erSum: !!kendt?.erSum }
      postMap.set(id, post)
      poster.push(post)
    }
    if (kol.values[id] == null) kol.values[id] = f.vaerdi
  })

  // Den enhed, regnskabet selv er stillet op i (fx t.kr.), ses af tallenes
  // skalering i iXBRL; den bruges som udgangspunkt for visningen.
  const skalaer = new Map()
  fund.forEach(f => skalaer.set(f.scale, (skalaer.get(f.scale) || 0) + 1))
  const skala = [...skalaer.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const visEnhed = skala === 6 ? 'mio. kr.' : skala === 3 ? '1.000 kr.' : 'kr.'

  const titel = (doc.querySelector('title')?.textContent || '').slice(0, 200)
  const virksomhed = findStamdata(doc, 'nameofreportingentity') || navnFraTitel(titel)
  const cvrCifre = (findStamdata(doc, 'identificationnumbercvrofreportingentity') || '').replace(/\D/g, '')
  const cvr = cvrCifre.length === 8 ? cvrCifre : (titel.trim().match(/^(\d{8})\s/)?.[1] || null)

  // Ledelsesberetningen: afsnittet under overskriften, eller de mærkede
  // tekstafsnit, hvis beretningen ikke har sin egen overskrift.
  const tekstlinjer = alle
    .map(el => rensTekst([...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ')))
    .filter(t => t.length > 1)
  const tekstafsnit = alle
    .filter(el => localName(el) === 'nonnumeric')
    .map(el => ({ begreb: (el.getAttribute('name') || '').split(':').pop(), tekst: rensTekst(tekstMedFortsaettelse(doc, el)) }))
  const beretning = udtraekBeretning(tekstlinjer) || beretningFraBegreber(tekstafsnit)

  // Udbytte læses uanset opgørelse – det står typisk i egenkapitalen, i
  // resultatdisponeringen eller i pengestrømsopgørelsen.
  // Først ud fra XBRL-begrebet; derefter ud fra rækkens navn, så udbytte i
  // noterne (fx resultatdisponeringen) også findes, når begrebet ikke hedder
  // noget med "Dividend".
  const foer = { ...diagnostik }
  const udbytteFakta = alle
    .filter(el => /dividend/i.test(el.getAttribute('name') || el.nodeName))
    .map(laesFakta)
    .filter(Boolean)
  const udbytteRaekker = alle
    .filter(el => localName(el) === 'nonfraction' && /udbytte/i.test(raekkenavn(el) || ''))
    .map(el => { const f = laesFakta(el); return f ? { ...f, label: raekkenavn(el) } : null })
    .filter(Boolean)
  Object.assign(diagnostik, foer)
  const udbytte = flet(udbytteFraFakta(udbytteFakta), udbytteFraRaekker(udbytteRaekker))

  diagnostik.antalUnikkeIkkeGenkendte = ikkeGenkendteNavne.size
  diagnostik.ikkeGenkendteNavne = [...ikkeGenkendteNavne.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 50)
    .map(([navn, antal]) => ({ navn, antal }))

  return {
    kilde,
    virksomhed,
    cvr,
    enhed: 'kr.',
    visEnhed,
    diagnostik,
    beretning,
    udbytte,
    poster,
    kolonner: kolonner.filter(k => Object.keys(k.values).length > 0)
  }
}

/**
 * Forklarer på dansk, hvorfor et dokument ikke gav nogen talkolonner, ud fra
 * diagnostikken fra parseXbrlDokument — så brugeren ved, om dokumentet slet
 * ikke var XBRL, ikke indeholdt en genkendelig resultatopgørelse eller
 * balance, eller kun havde tallene opdelt på en dimension (fx segment eller
 * selskab i en koncern).
 */
export function diagnostikTekst (diagnostik) {
  if (!diagnostik || !diagnostik.antalElementer) {
    return 'Dokumentet ser ikke ud til at indeholde XBRL-mærkede tal. Kontrollér, at adressen peger på selve regnskabsdokumentet og ikke en visningsside.'
  }
  if (diagnostik.antalUdelukketPgaDimension >= diagnostik.antalElementer) {
    return 'Dokumentet indeholder tal, men de er alle opdelt på en dimension (fx segment eller selskab i en koncern) uden en samlet sum uden dimension. Prøv evt. et andet dokument fra samme regnskab (fx moderselskabstal i stedet for koncerntal).'
  }
  const navne = diagnostik.ikkeGenkendteNavne || []
  const eksempler = navne.map(n => n.navn).join(', ')
  return 'Dokumentet indeholder XBRL-mærkede tal, men hverken en resultatopgørelse eller en balance kunne findes i det.' +
    (eksempler ? ` Begreber fundet i dokumentet: ${eksempler}.` : '')
}

/**
 * Henter og tolker en iXBRL-adresse gennem serverfunktionen. Både hentning
 * og selve tolkningen sker på serveren (ikke kun proxyet råt igennem), fordi
 * Virk hverken sender CORS-headere eller svarer på kald uden
 * browserlignende headere — og fordi store selskabers årsrapporter kan være
 * adskillige MB store; ved kun at sende det tolkede resultat (nogle få
 * kolonner) tilbage til browseren undgås grænserne for, hvor meget data en
 * browserside kan hente i ét hug.
 */
export async function importerIxbrlLink (url) {
  const svar = await fetch('/.netlify/functions/ixbrl?url=' + encodeURIComponent(url))
  const data = await svar.json().catch(() => null)
  if (!svar.ok || !data) throw new Error(data?.fejl || `Kunne ikke hente dokumentet (${svar.status}).`)
  if (data.fejl) throw new Error(data.fejl)
  return data
}

/** Slår offentliggjorte årsrapporter op på CVR-nummer. */
export async function soegRegnskaber (cvr) {
  const svar = await fetch('/.netlify/functions/regnskaber?cvr=' + encodeURIComponent(cvr))
  const data = await svar.json().catch(() => ({ fejl: 'Uventet svar fra serveren.' }))
  if (!svar.ok || data.fejl) throw new Error(data.fejl || `Opslaget fejlede (${svar.status}).`)
  return data.regnskaber || []
}

export async function importerXbrlFil (file) {
  const tekst = await file.text()
  return parseXbrlDokument(tekst, file.name)
}

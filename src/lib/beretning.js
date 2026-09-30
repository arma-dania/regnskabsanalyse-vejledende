// Ledelsesberetningen og udbyttet, læst ud af det indlæste regnskab.
//
// Begge bruges i den vejledende besvarelse: beretningen er ledelsens egen
// forklaring på tallene (trin 2 og 4), og udbyttet forklarer, hvorfor
// egenkapitalen ikke vokser med hele overskuddet (soliditet og pengestrøm).

const START = /^(ledelsesberetning(en)?|management'?s? review)$/i
const SLUT = /^(resultatopgørelse|balance|egenkapitalopgørelse|pengestrømsopgørelse|noter|anvendt regnskabspraksis|årsregnskab(et)?|koncernregnskab(et)?|ledelsespåtegning|påtegninger|den uafhængige revisors|income statement|statement of|financial statements|consolidated financial)/i
const MAKS_TEGN = 20000

/**
 * Finder ledelsesberetningen i regnskabets tekstlinjer: fra overskriften
 * "Ledelsesberetning" til næste hovedafsnit. Indholdsfortegnelsen rammes
 * ikke, fordi den har sidetal efter overskriften; forekommer overskriften
 * flere gange, bruges det længste afsnit.
 */
export function udtraekBeretning (linjer) {
  const l = linjer.map(x => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  let bedst = ''
  l.forEach((linje, i) => {
    if (!START.test(linje)) return
    const dele = []
    for (let j = i + 1; j < l.length; j++) {
      if (l[j].length < 60 && SLUT.test(l[j])) break
      dele.push(l[j])
    }
    const tekst = dele.join('\n')
    if (tekst.length > bedst.length) bedst = tekst
  })
  return bedst.slice(0, MAKS_TEGN)
}

// XBRL-begreber for ledelsesberetningens tekstafsnit i den danske
// taksonomi. Bruges, når beretningen ikke har sin egen overskrift.
const BERETNINGSBEGREB = /^(DescriptionOf(PrimaryActivities|DevelopmentInActivities|SignificantEvents|ExpectedDevelopment|Uncertain|Unusual|Knowledge|Environment|Research|StatutoryReport)|InformationOn(Knowledge|Environment|ResearchAndDevelopment|ExpectedDevelopment|Events))/i

/** Samler de mærkede tekstafsnit (ix:nonNumeric) fra ledelsesberetningen. */
export function beretningFraBegreber (afsnit) {
  return afsnit
    .filter(a => BERETNINGSBEGREB.test(a.begreb) && a.tekst)
    .map(a => a.tekst.replace(/\s+/g, ' ').trim())
    .join('\n')
    .slice(0, MAKS_TEGN)
}

/* ---------------------- Udbytte ---------------------- */

// Udgaven af udbyttelæsningen. Regnskaber, der er indlæst med en ældre
// udgave, har måske et forkert udbytte gemt; det bruges ikke.
export const UDBYTTE_UDGAVE = 2

// Begreber med "Dividend" i navnet, der ikke er udbytte fra virksomheden
// (fx modtaget udbytte fra datterselskaber) eller udbytte pr. aktie.
const IKKE_UDBYTTE = /PerShare|Income|Received|Receivable|Payable|FromGroup|FromAssociat|FromInvest|Revenue/i

/**
 * Udbytte pr. år ud fra XBRL-fakta: { "2025": { foreslaaet, betalt } }.
 * Foreslået udbytte hører til regnskabsåret (udbetales året efter); betalt
 * udbytte er det, der gik ud af kassen i året.
 *
 * Begreberne har forskellig vægt:
 * - "…DistributedAfterEndOfReportingPeriod…" er udbytte besluttet efter
 *   årets udgang for dét år – altså foreslået, ikke betalt, selv om ordet
 *   "Distributed" indgår.
 * - "…RecognisedInEquity" er en saldo i egenkapitalen og bruges kun, når
 *   intet andet begreb siger noget om året; den er ofte fejlmærket.
 * - Ordinært og ekstraordinært udbytte lægges sammen. Et 0 tæller med, så
 *   et svagere begreb (eller en tabelrække) ikke overtager; analysen læser 0
 *   som intet udbytte.
 */
function udbytteArt (begreb) {
  if (/DistributedAfter|Proposed|Declared/i.test(begreb)) return { art: 'foreslaaet', vaegt: /RecognisedInEquity/i.test(begreb) ? 1 : 2 }
  if (/Paid|Distribut|Payment/i.test(begreb)) return { art: 'betalt', vaegt: 2 }
  return null
}

export function udbytteFraFakta (fakta) {
  // aar → art → { vaegt, begreber: Map(begreb → værdi) }
  const fund = {}
  for (const f of fakta) {
    if (!/Dividend/i.test(f.begreb) || IKKE_UDBYTTE.test(f.begreb)) continue
    const a = udbytteArt(f.begreb)
    if (!a) continue
    const aar = f.dato.slice(0, 4)
    fund[aar] ??= {}
    const nu = fund[aar][a.art]
    if (nu && nu.vaegt > a.vaegt) continue
    if (!nu || a.vaegt > nu.vaegt) fund[aar][a.art] = { vaegt: a.vaegt, begreber: new Map() }
    const b = fund[aar][a.art].begreber
    if (!b.has(f.begreb)) b.set(f.begreb, Math.abs(f.vaerdi))
  }
  const ud = {}
  for (const [aar, arter] of Object.entries(fund)) {
    for (const [art, { begreber }] of Object.entries(arter)) {
      const sum = [...begreber.values()].reduce((x, y) => x + y, 0)
      ud[aar] ??= {}
      ud[aar][art] = sum
    }
  }
  return ud
}

// Linjer i resultatdisponering, egenkapitalopgørelse, pengestrømsopgørelse
// og noter. "Udbytte" alene står typisk i resultatdisponeringen og er årets
// foreslåede udbytte; det bruges kun, hvis intet mere præcist er fundet.
const UDBYTTELINJE = [
  [/^(foreslået (ordinært |ekstraordinært )?udbytte|udbytte for (regnskabs)?året|forslag til udbytte|foreslås udbetalt)/i, 'foreslaaet'],
  [/^(betalt udbytte|udbetalt udbytte|udloddet udbytte|ekstraordinært udbytte|udbytte(,)? (betalt|udbetalt|udloddet))/i, 'betalt'],
  [/^udbytte$/i, 'foreslaaet', true]
]
const IKKE_UDBYTTELINJE = /pr\.?\s*aktie|per share|modtaget|fra (datter|tilknyttede|associerede|kapitalinteresser)/i

/**
 * Udbytte fra PDF-tekstlinjer. De to sidste tal i linjen er regnskabsåret og
 * sammenligningsåret; årstal og notenumre sorteres fra.
 */
export function udbytteFraLinjer (linjer, aarstal, laesTal) {
  const ud = {}
  const svage = []
  for (const linje of linjer) {
    const label = linje.replace(/\s+\(?-?[\d.,()\s]+$/, '').replace(/\s+\d+$/, '').trim()
    if (IKKE_UDBYTTELINJE.test(label)) continue
    const fund = UDBYTTELINJE.find(([re]) => re.test(label) || re.test(linje.trim()))
    if (!fund) continue
    if (fund[2]) { svage.push(linje); continue }
    const tal = (linje.match(/\(?-?\d[\d.]*(,\d+)?\)?/g) || [])
      .map(laesTal)
      .filter(n => n != null && Math.abs(n) > 0 && !(Number.isInteger(n) && n >= 1990 && n <= 2100))
    const brugbare = tal.length > 2 ? tal.slice(-2) : tal
    brugbare.forEach((v, i) => {
      const aar = aarstal[i]
      if (!aar) return
      ud[aar] ??= {}
      ud[aar][fund[1]] ??= Math.abs(v)
    })
  }
  if (svage.length) {
    const svagt = udbytteFraLinjer(svage.map(l => l.replace(/^udbytte/i, 'Foreslået udbytte')), aarstal, laesTal)
    for (const [aar, u] of Object.entries(svagt)) {
      ud[aar] ??= {}
      ud[aar].foreslaaet ??= u.foreslaaet
    }
  }
  return ud
}

/**
 * Udbytte fra rækkenavnene i et iXBRL-dokument – til noter, hvor tallet er
 * mærket med et begreb uden "Dividend" i navnet. rækker: [{ label, dato, vaerdi }].
 */
export function udbytteFraRaekker (raekker) {
  const ud = {}
  const svage = {}
  for (const r of raekker) {
    const label = String(r.label || '').trim()
    if (!/udbytte/i.test(label) || IKKE_UDBYTTELINJE.test(label)) continue
    const fund = UDBYTTELINJE.find(([re]) => re.test(label))
    if (!fund) continue
    const aar = r.dato.slice(0, 4)
    const maal = fund[2] ? svage : ud
    maal[aar] ??= {}
    maal[aar][fund[1]] ??= Math.abs(r.vaerdi)
  }
  for (const [aar, u] of Object.entries(svage)) {
    ud[aar] ??= {}
    ud[aar].foreslaaet ??= u.foreslaaet
  }
  return ud
}

/** Lægger udbytte fra flere kilder sammen; den første kilde vinder. */
export function flet (...kilder) {
  const ud = {}
  for (const k of kilder)
    for (const [aar, u] of Object.entries(k || {})) {
      ud[aar] ??= {}
      for (const [art, v] of Object.entries(u)) ud[aar][art] ??= v
    }
  return ud
}

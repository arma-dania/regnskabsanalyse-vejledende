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

// Begreber med "Dividend" i navnet, der ikke er udbytte fra virksomheden
// (fx modtaget udbytte fra datterselskaber) eller udbytte pr. aktie.
const IKKE_UDBYTTE = /PerShare|Income|Received|Receivable|Payable|FromGroup|FromAssociat|FromInvest|Revenue/i

/**
 * Udbytte pr. år ud fra XBRL-fakta: { "2025": { foreslaaet, betalt } }.
 * Foreslået udbytte hører til regnskabsåret (udbetales året efter); betalt
 * udbytte er det, der gik ud af kassen i året.
 */
export function udbytteFraFakta (fakta) {
  const ud = {}
  for (const f of fakta) {
    if (!/Dividend/i.test(f.begreb) || IKKE_UDBYTTE.test(f.begreb)) continue
    // Foreslået først: IFRS-begrebet for foreslået udbytte indeholder også
    // "Distribution" (…NotRecognisedAsDistributionToOwners).
    const art = /Proposed|Declared/i.test(f.begreb) ? 'foreslaaet' : /Paid|Distribut|Payment/i.test(f.begreb) ? 'betalt' : null
    if (!art) continue
    const aar = f.dato.slice(0, 4)
    ud[aar] ??= {}
    ud[aar][art] ??= Math.abs(f.vaerdi)
  }
  return ud
}

const UDBYTTELINJE = [
  [/^(foreslået udbytte|udbytte for regnskabsåret|foreslået ordinært udbytte)/i, 'foreslaaet'],
  [/^(betalt udbytte|udbetalt udbytte|udloddet udbytte)/i, 'betalt']
]

/**
 * Udbytte fra PDF-tekstlinjer. De to sidste tal i linjen er regnskabsåret og
 * sammenligningsåret; årstal og notenumre sorteres fra.
 */
export function udbytteFraLinjer (linjer, aarstal, laesTal) {
  const ud = {}
  for (const linje of linjer) {
    const fund = UDBYTTELINJE.find(([re]) => re.test(linje.trim()))
    if (!fund) continue
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
  return ud
}

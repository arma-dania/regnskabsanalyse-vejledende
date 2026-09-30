// Samme enhed i alle år.
//
// Hvert regnskab kan være opstillet i sin egen enhed (kr., 1.000 kr. eller
// mio. kr.), og en PDF's enhed er et gæt. Før årene fordeles, regnes hvert
// regnskab derfor om til kroner. Derefter holdes de år, der står i to
// regnskaber (fx 2024 som regnskabsår i det ene og sammenligningsår i det
// andet), op mod hinanden: afviger de med en faktor 1.000 eller 1.000.000,
// er enheden gættet forkert, og regnskabet rettes.

import { enhedFaktor } from './model.js'

/** Et regnskab med alle beløb i kroner. Den oprindelige enhed huskes. */
export function tilKroner (doc) {
  const f = enhedFaktor(doc.enhed || 'kr.')
  if (f === 1) return { ...doc, enhed: 'kr.', oprindeligEnhed: doc.oprindeligEnhed || doc.enhed || 'kr.' }
  return skaler({ ...doc, enhed: 'kr.', oprindeligEnhed: doc.enhed, visEnhed: doc.visEnhed || doc.enhed }, f)
}

function skaler (doc, f) {
  return {
    ...doc,
    kolonner: (doc.kolonner || []).map(k => ({
      ...k,
      values: Object.fromEntries(Object.entries(k.values || {}).map(([id, v]) => [id, v == null ? v : v * f]))
    })),
    udbytte: Object.fromEntries(Object.entries(doc.udbytte || {}).map(([aar, u]) => [aar, Object.fromEntries(Object.entries(u).map(([art, v]) => [art, v == null ? v : v * f]))]))
  }
}

// Store, stabile poster, der findes i alle regnskaber og er lette at kende.
const NOEGLEPOSTER = [
  { navn: 'balancesummen', id: /:(Assets)$/i, label: /^(aktiver i alt|aktiver|balancesum)$/i },
  { navn: 'omsætningen', id: /:(Revenue)$/i, label: /^(nettoomsætning|omsætning)$/i },
  { navn: 'egenkapitalen', id: /:(Equity)$/i, label: /^egenkapital( i alt)?$/i }
]

function noeglevaerdi (doc, kol, n) {
  const post = (doc.poster || []).find(p => n.id.test(p.id) || n.label.test(String(p.label || '').trim()))
  const v = post ? kol.values?.[post.id] : null
  return v == null || v === 0 ? null : v
}

const erPdf = doc => (doc.poster || []).some(p => String(p.id).startsWith('pdf:'))
const hovedaar = doc => Number(doc.kolonner?.[0]?.navn) || 0
const navn = doc => doc.kilde ? String(doc.kilde).split('/').pop() : `regnskabet for ${hovedaar(doc)}`
const tal = v => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(v)

/**
 * Tjekker, at de indlæste regnskaber står i samme enhed, og retter dem, der
 * afviger med en faktor 1.000 eller 1.000.000. Et XBRL-regnskab regnes for
 * sikkert (enheden står i dokumentet); ellers rettes det ældste regnskab til
 * det nyeste. Returnerer regnskaberne og beskeder til brugeren.
 */
export function kontrollerEnheder (docs) {
  let ud = docs.map(tilKroner)
  const beskeder = []
  const rettet = new Set()
  for (let i = 0; i < ud.length; i++) {
    for (let j = i + 1; j < ud.length; j++) {
      const a = ud[i], b = ud[j]
      for (const ka of a.kolonner || []) {
        const kb = (b.kolonner || []).find(k => String(k.navn) === String(ka.navn))
        if (!kb) continue
        for (const n of NOEGLEPOSTER) {
          const va = noeglevaerdi(a, ka, n), vb = noeglevaerdi(b, kb, n)
          if (va == null || vb == null) continue
          const eksponent = Math.log10(Math.abs(va / vb))
          const tier = Math.round(eksponent / 3) * 3
          if (tier !== 0 && Math.abs(eksponent - tier) < 0.05) {
            // Hvilket regnskab rettes? XBRL frem for PDF; ellers det ældste.
            const retA = erPdf(a) && !erPdf(b) ? true : erPdf(b) && !erPdf(a) ? false : hovedaar(a) < hovedaar(b)
            const idx = retA ? i : j
            if (rettet.has(idx)) break
            const faktor = retA ? Math.pow(10, -tier) : Math.pow(10, tier)
            ud[idx] = skaler(ud[idx], faktor)
            rettet.add(idx)
            beskeder.push({
              type: 'advarsel',
              tekst: `${navn(ud[idx])} stod i en anden enhed end ${navn(retA ? b : a)}: ${n.navn} for ${ka.navn} afveg med en faktor ${tal(Math.pow(10, Math.abs(tier)))}. Tallene er rettet, så alle år står i samme enhed – kontrollér dem i tabellen.`
            })
          } else if (tier === 0 && Math.abs(va / vb - 1) > 0.02 && n.navn === 'balancesummen') {
            beskeder.push({
              type: 'info',
              tekst: `Balancesummen for ${ka.navn} er ${tal(Math.abs(va))} kr. i ${navn(a)}, men ${tal(Math.abs(vb))} kr. i ${navn(b)}. Det kan være en tilpasning af sammenligningstallene – kontrollér, hvilket tal der skal bruges.`
            })
          }
          break
        }
      }
    }
  }
  return { docs: ud, beskeder }
}

// Enheden gættes ud fra, hvor ofte hver enhed nævnes. En linje som
// "Beløb i t.kr." eller en kolonneoverskrift med kun enheden tæller mest; en
// enkelt "80 mio. kr." i ledelsesberetningen må ikke afgøre det alene.
const ENHEDSMOENSTRE = [
  ['mio. kr.', /\bmio\.?\s*kr\.?|\bDKK\s*m(io|illion)?\b|\bDKKm\b|\bmDKK\b/i],
  ['1.000 kr.', /\bt\.?\s*kr\.?|\btkr\.?|1\.000\s*kr|tusinde kr|\bDKK\s*'?000|\bTDKK\b|\bDKK\s*thousand/i]
]
export function gaetEnhed (tekst) {
  const point = { 'mio. kr.': 0, '1.000 kr.': 0 }
  for (const linje of String(tekst).split('\n')) {
    for (const [enhed, re] of ENHEDSMOENSTRE) {
      if (!re.test(linje)) continue
      const kort = linje.trim().length < 25
      const overskrift = /(beløb|tal|alle beløb|amounts?)\s.*\bi\b|in\s+(DKK|thousand|million)/i.test(linje)
      point[enhed] += overskrift ? 10 : kort ? 3 : 1
    }
  }
  const [bedst, p] = Object.entries(point).sort((a, b) => b[1] - a[1])[0]
  return p > 0 ? bedst : 'kr.'
}

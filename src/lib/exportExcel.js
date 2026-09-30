import * as XLSX from 'xlsx'
import { omformetRegnskab, sammenlaegningsoversigt, flytningsoversigt } from './model.js'
import { nogletalFor, OMRAADER, beregnAlle, procentvisAendring } from './nogletal.js'

const r2 = v => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100)

export function byggeArbejdsbog (dataset) {
  const wb = XLSX.utils.book_new()
  const aarNavne = dataset.aar.map((y, i) => y.label || `År ${i + 1}`)
  const resultater = beregnAlle(dataset)

  // Ark 1: regnskabet i analyseform
  const analyse = [[`${dataset.virksomhed || 'Virksomhed'} – regnskab i analyseform`], [`Beløb i ${dataset.enhed}`], []]
  analyse.push(['Post', ...aarNavne])
  omformetRegnskab(dataset).forEach(afs => {
    analyse.push([afs.title.toUpperCase()])
    afs.raekker.forEach(r => analyse.push([r.navn, ...r.tal]))
    analyse.push([])
  })
  const oversigt = sammenlaegningsoversigt(dataset)
  if (oversigt.length) {
    analyse.push(['SAMMENLAGTE POSTER'])
    oversigt.forEach(o => analyse.push([o.navn, o.udtryk]))
  }
  const flytninger = flytningsoversigt(dataset)
  if (flytninger.length) {
    analyse.push([], ['FLYTTEDE POSTER'])
    flytninger.forEach(f => analyse.push([f.navn, f.plads]))
  }
  const ws1 = XLSX.utils.aoa_to_sheet(analyse)
  ws1['!cols'] = [{ wch: 46 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Analyseform')

  // Ark 2: alle 28 nøgletal
  const nt = [['Nr.', 'Nøgletal', 'Enhed', ...aarNavne, 'Udvikling', 'Ændring i %'], []]
  nt.splice(1, 1)
  OMRAADER.forEach(o => {
    nt.push([o.title.toUpperCase()])
    nogletalFor(dataset).filter(n => n.omraade === o.id).forEach(n => {
      const vaerdier = resultater.map(r => r2(r[n.nr].value))
      const foerste = vaerdier[0]
      const sidste = vaerdier[vaerdier.length - 1]
      const udvikling = foerste != null && sidste != null ? r2(sidste - foerste) : null
      nt.push([n.nr, n.navn, n.enhed, ...vaerdier, udvikling, r2(procentvisAendring(resultater, n.nr))])
    })
    nt.push([])
  })
  const ws2 = XLSX.utils.aoa_to_sheet(nt)
  ws2['!cols'] = [{ wch: 5 }, { wch: 44 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Nøgletal')

  // Ark 3: tæller og nævner bag hvert tal
  const grundlag = [['Nr.', 'Nøgletal', 'Formel', ...aarNavne.flatMap(a => [`${a} tæller`, `${a} nævner`, `${a} resultat`])]]
  nogletalFor(dataset).forEach(n => {
    const celler = []
    resultater.forEach(r => {
      celler.push(r2(r[n.nr].num), r2(r[n.nr].den), r2(r[n.nr].value))
    })
    grundlag.push([n.nr, n.navn, `${n.taeller} / ${n.naevner}`, ...celler])
  })
  const ws3 = XLSX.utils.aoa_to_sheet(grundlag)
  ws3['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 52 }, ...Array(9).fill({ wch: 14 })]
  XLSX.utils.book_append_sheet(wb, ws3, 'Beregningsgrundlag')

  // Ark 4: definitioner til opslag
  const def = [['Nr.', 'Område', 'Nøgletal', 'Tæller', 'Nævner', 'Hvad tallet viser']]
  nogletalFor(dataset).forEach(n => {
    const omr = OMRAADER.find(o => o.id === n.omraade)
    def.push([n.nr, omr.title, n.navn, n.taeller, n.naevner, n.forklaring])
  })
  const ws4 = XLSX.utils.aoa_to_sheet(def)
  ws4['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 40 }, { wch: 34 }, { wch: 34 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(wb, ws4, 'Definitioner')

  return wb
}

export function hentExcel (dataset) {
  const wb = byggeArbejdsbog(dataset)
  const navn = filnavn(dataset, 'xlsx')
  XLSX.writeFile(wb, navn, { compression: true })
  return navn
}

export function filnavn (dataset, ext) {
  const base = (dataset.virksomhed || 'regnskabsanalyse')
    .replace(/[^\wæøåÆØÅ -]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
  return `${base || 'regnskabsanalyse'}-noegletal.${ext}`
}

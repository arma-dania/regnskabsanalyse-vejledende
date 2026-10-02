import * as pdfjsLib from 'pdfjs-dist'
import { linjerFraSide, posterFraLinjer, regnskabsaar, parseDanskTal } from './pdfLinjer.js'
import { udtraekBeretning, udbytteFraLinjer, UDBYTTE_UDGAVE } from './beretning.js'
import { gaetEnhed } from './enheder.js'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

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

  const { kolonner, poster } = posterFraLinjer(alleLinjer)

  const aarstal = regnskabsaar(alleLinjer)
  const beretning = udtraekBeretning(alleLinjer)
  const udbytte = udbytteFraLinjer(alleLinjer, aarstal.map(String), parseDanskTal)
  const navn = (alleLinjer.find(l => /(A\/S|ApS|I\/S|K\/S|IVS)\s*$/.test(l)) || '').trim()
  const cvrCifre = (helTekst.match(/CVR[\s.-]*(?:nr|nummer)?[\s.:-]*((?:\d\s?){8})/i)?.[1] || '').replace(/\s/g, '')

  return {
    kilde: file.name,
    virksomhed: navn,
    cvr: cvrCifre.length === 8 ? cvrCifre : null,
    enhed: gaetEnhed(helTekst),
    beretning,
    udbytte,
    udbytteUdgave: UDBYTTE_UDGAVE,
    poster,
    kolonner: [
      { navn: aarstal[0] ? String(aarstal[0]) : 'Regnskabsår', values: kolonner[0] },
      { navn: aarstal[1] ? String(aarstal[1]) : 'Sammenligningsår', values: kolonner[1] }
    ].filter(k => Object.keys(k.values).length > 0)
  }
}

// Ét Word-dokument med de dele, brugeren har krydset af: nøgletal og grafer,
// den vejledende besvarelse (analysen) og underviservejledningen. Hver del
// er sin egen sektion og begynder på en ny side.

import { Document, Packer } from 'docx'
import { saveAs } from 'file-saver'
import { noegletalBoern, STILE, MARGEN } from './exportWord.js'
import { hentAlleGrafer } from './chartImage.js'
import { besvarelseBoern, vejledningBoern } from '../analyse/word.js'

export const DELE = [
  { id: 'noegletal', navn: 'Nøgletal og grafer' },
  { id: 'analyse', navn: 'Analyse' },
  { id: 'vejledning', navn: 'Underviservejledning' }
]

export async function hentSamletWord ({ dataset, analyse, prosa, valgt }) {
  const sektioner = []
  if (valgt.noegletal) sektioner.push(noegletalBoern(dataset, await hentAlleGrafer()))
  if (valgt.analyse && analyse) sektioner.push(besvarelseBoern(analyse, prosa))
  if (valgt.vejledning && analyse) sektioner.push(vejledningBoern(analyse, prosa))
  if (!sektioner.length) throw new Error('Vælg mindst én del.')
  const virksomhed = (dataset.virksomhed || analyse?.navn || 'Regnskabsanalyse').replace(/[\\/:*?"<>|]/g, '')
  const doc = new Document({
    creator: 'Regnskabsanalyse – vejledende',
    title: virksomhed,
    styles: STILE,
    sections: sektioner.map(children => ({ properties: { page: { margin: MARGEN } }, children }))
  })
  const navn = `${virksomhed} – ${DELE.filter(d => valgt[d.id]).map(d => d.navn.toLowerCase()).join(', ')}.docx`
  saveAs(await Packer.toBlob(doc), navn)
  return navn
}

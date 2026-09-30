import { useState } from 'react'
import Omformningsvejledning from './Omformningsvejledning.jsx'
import { REGNSKABSAFSNIT, validate, synligePoster, postNavn, postTal, laegSammen, fortrydSammenlaegning, flytPost, fortrydFlytning, navneforslag, sammenlaegningsoversigt, flytningsoversigt, visningsfaktor, opstillingsform } from '../lib/model.js'

const fmt = (n, enhed) => (n == null ? '–' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: /mio/.test(enhed || '') ? 1 : 0 }).format(n))

export default function DataGrid ({ dataset, setDataset }) {
  const [traekker, setTraekker] = useState(null)
  const [maal, setMaal] = useState(null)
  const [forslag, setForslag] = useState(null)
  const noter = validate(dataset)

  const poster = dataset.poster || []
  const foersteAar = Number(dataset.aar[0]?.label)
  const kolonner = [
    { label: foersteAar ? `Primo ${foersteAar - 1}` : 'Primo', tal: dataset.primoPoster || {} },
    ...dataset.aar.map((y, i) => ({ label: y.label || `År ${i + 1}`, tal: y.poster || {} }))
  ]
  const harTal = p => kolonner.some(k => postTal(dataset, p, k.tal) != null)
  const oversigt = sammenlaegningsoversigt(dataset)
  const flytninger = flytningsoversigt(dataset)
  const faktor = visningsfaktor(dataset)
  const vis = v => fmt(v == null ? null : v * faktor, dataset.enhed)
  const erSum = id => poster.find(p => p.id === id)?.erSum

  // Øverste og nederste del af en række flytter posten dertil; midten lægger
  // posterne sammen. Regnskabets egne summer kan kun flyttes, ikke lægges sammen.
  const position = (e, p) => {
    const r = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientY - r.top) / r.height
    if (rel > 0.3 && rel < 0.7 && !p.erSum && !erSum(traekker)) return 'sammen'
    return rel < 0.5 ? 'foer' : 'efter'
  }

  const traekProps = p => ({
    draggable: true,
    onDragStart: e => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setTraekker(p.id) },
    onDragEnd: () => { setTraekker(null); setMaal(null) },
    onDragOver: e => {
      if (!traekker || traekker === p.id) return
      e.preventDefault()
      const pos = position(e, p)
      if (maal?.id !== p.id || maal?.pos !== pos) setMaal({ id: p.id, pos })
    },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setMaal(m => (m?.id === p.id ? null : m)) },
    onDrop: e => {
      e.preventDefault()
      const kilde = traekker || e.dataTransfer.getData('text/plain')
      const pos = position(e, p)
      setTraekker(null); setMaal(null)
      if (!kilde || kilde === p.id) return
      if (pos === 'sammen') {
        const navne = navneforslag(dataset, kilde, p.id)
        setForslag({ kildeId: kilde, maalId: p.id, navn: navne[0], navne })
      } else {
        setDataset(d => flytPost(d, kilde, p.id, pos === 'efter'))
      }
    }
  })

  const bekraeft = () => {
    const navn = forslag.navn.trim() || forslag.navne[0]
    setDataset(d => laegSammen(d, forslag.kildeId, forslag.maalId, navn))
    setForslag(null)
  }

  const navnPaa = id => {
    const p = poster.find(q => q.id === id)
    return p ? postNavn(dataset, p) : ''
  }

  return (
    <>
      <h2 className="sektion-titel">Regnskabet i analyseform</h2>
      <Omformningsvejledning opstilling={opstillingsform(dataset)} />
      <p className="sektion-intro">
        Her står regnskabet præcis, som det er indlæst. Omform resultatopgørelsen ved at lægge
        poster sammen (træk en post ind over en anden) og flytte dem (slip i kanten af en anden
        post). Nederst på siden kan du se og fortryde det, du har gjort. Balancen omformes ikke.
      </p>

      <div className="kort">
        <div className="gitter-2">
          <div>
            <label className="felt" htmlFor="virksomhed">Virksomhed</label>
            <input id="virksomhed" type="text" value={dataset.virksomhed}
              onChange={e => setDataset(d => ({ ...d, virksomhed: e.target.value }))}
              placeholder="Fx Novo Nordisk A/S" />
          </div>
          <div>
            <label className="felt" htmlFor="enhed">Beløb angivet i</label>
            <select id="enhed" value={dataset.enhed} onChange={e => setDataset(d => ({ ...d, grundenhed: d.grundenhed ?? d.enhed, enhed: e.target.value }))}>
              <option>kr.</option>
              <option>1.000 kr.</option>
              <option>mio. kr.</option>
            </select>
            <p className="hjaelp" style={{ margin: '6px 0 0' }}>Omregner alle beløb i regnskabet, nøgletallene og eksporten.</p>
          </div>
        </div>
      </div>

      {noter.map((n, i) => (
        <div key={i} className={'besked ' + (n.level === 'error' ? 'fejl' : 'advarsel')}>
          <strong>{n.year}:</strong> {n.text}
        </div>
      ))}

      {!poster.length && (
        <div className="besked advarsel">Der er ikke indlæst nogen regnskaber endnu. Indlæs dem under "Indlæs regnskaber".</div>
      )}

      {forslag && (
        <div className="kort sammenlaegning-flydende">
          <h3>Læg poster sammen?</h3>
          <p className="hjaelp">
            "{navnPaa(forslag.kildeId)}" lægges sammen med "{navnPaa(forslag.maalId)}" i alle år.
          </p>
          <label className="felt" htmlFor="nyt-postnavn">Navn på den sammenlagte post</label>
          <input
            id="nyt-postnavn" type="text" value={forslag.navn} autoFocus
            onChange={e => setForslag(f => ({ ...f, navn: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') bekraeft(); if (e.key === 'Escape') setForslag(null) }}
          />
          {forslag.navne.length > 1 && (
            <div className="navneforslag">
              <span>Forslag:</span>
              {forslag.navne.map(n => (
                <button key={n} className={'forslag-knap' + (n === forslag.navn ? ' valgt' : '')} onClick={() => setForslag(f => ({ ...f, navn: n }))}>{n}</button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="knap primaer" onClick={bekraeft}>Læg sammen</button>
            <button className="knap lys" onClick={() => setForslag(null)}>Annullér</button>
          </div>
        </div>
      )}

      {poster.length > 0 && (
        <div className="kort">
          <div className="tabel-omslag">
            <table className="data">
              <thead>
                <tr>
                  <th>Post</th>
                  {kolonner.map((k, i) => <th key={i} className="num">{k.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {REGNSKABSAFSNIT.map(afs => {
                  const raekker = synligePoster(dataset, afs.id).filter(harTal)
                  if (!raekker.length) return null
                  const kanOmformes = afs.id === 'resultat'
                  return (
                    <Fragmenter key={afs.id}>
                      <tr className="gruppe"><td colSpan={1 + kolonner.length}>{afs.title}</td></tr>
                      {raekker.map(p => (
                        <tr
                          key={p.id}
                          className={[
                            p.erSum ? 'sum' : '',
                            kanOmformes ? 'traekbar-raekke' : '',
                            traekker === p.id ? 'traekkes' : '',
                            maal?.id === p.id ? (maal.pos === 'sammen' ? 'traek-over' : 'drop-' + maal.pos) : ''
                          ].join(' ')}
                          {...(kanOmformes ? traekProps(p) : {})}
                        >
                          <td>{postNavn(dataset, p)}</td>
                          {kolonner.map((k, i) => <td key={i} className="num">{vis(postTal(dataset, p, k.tal))}</td>)}
                        </tr>
                      ))}
                    </Fragmenter>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {poster.length > 0 && (
        <div className="kort">
          <h3>Sammenlagte og flyttede poster</h3>
          {oversigt.length === 0 && flytninger.length === 0 && (
            <p className="hjaelp" style={{ margin: 0 }}>Ingen poster er lagt sammen eller flyttet endnu.</p>
          )}
          {oversigt.length > 0 && (
            <>
              <div className="oversigt-titel">Sammenlagt</div>
              <ul className="sammenlaegninger">
                {oversigt.map(o => (
                  <li key={o.id}>
                    <span><strong>{o.navn}</strong> = {o.udtryk}</span>
                    <button className="knap lys lille" onClick={() => setDataset(d => fortrydSammenlaegning(d, o.id))}>Fortryd</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {flytninger.length > 0 && (
            <>
              <div className="oversigt-titel">Flyttet</div>
              <ul className="sammenlaegninger">
                {flytninger.map(f => (
                  <li key={f.id}>
                    <span><strong>{f.navn}</strong> {f.plads}</span>
                    <button className="knap lys lille" onClick={() => setDataset(d => fortrydFlytning(d, f.id))}>Fortryd</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  )
}

// Lille hjælper, så tabelrækker kan grupperes uden ekstra DOM-element.
function Fragmenter ({ children }) { return <>{children}</> }

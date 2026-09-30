import { useState, useRef, useMemo, useEffect } from 'react'
import { importerPdf } from '../lib/pdfImport.js'
import { importerIxbrlLink, importerXbrlFil, soegRegnskaber, diagnostikTekst } from '../lib/ixbrlImport.js'
import { fordelKolonner, anvendFordeling } from '../lib/fordeling.js'
import { REGNSKABSAFSNIT, emptyDataset, visningsfaktor } from '../lib/model.js'
import { kontrollerEnheder } from '../lib/enheder.js'

const fmt = (n, enhed) => (n == null ? '–' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: /mio/.test(enhed || '') ? 1 : 0 }).format(n))

const normaliserNavn = navn => (navn || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

// CVR-nummeret afgør, når begge dokumenter har et; ellers navnet. Kan ingen
// af delene sammenlignes, regnes de for samme virksomhed.
function sammeVirksomhed (a, b) {
  if (a.cvr && b.cvr) return a.cvr === b.cvr
  const na = normaliserNavn(a.virksomhed)
  const nb = normaliserNavn(b.virksomhed)
  return !na || !nb || na === nb
}

// Sentinel til at kende forskel på "endnu ikke set nogen fordeling" og en
// reel fordeling (som kan være null, når intet er indlæst endnu).
const IKKE_SAT = Symbol('ikke-sat')

export default function ImportPanel ({ dataset, setDataset, gaaTilTrin, fund, setFund, cvr, setCvr, traf, setTraf }) {
  const [status, setStatus] = useState(null)
  const [arbejder, setArbejder] = useState(false)
  const [link, setLink] = useState('')
  const [over, setOver] = useState(false)
  const filInput = useRef(null)

  const fordeling = useMemo(() => (fund.length ? fordelKolonner(fund) : null), [fund])

  // Udgangspunktet i Omform skal altid være identisk med tabellen her —
  // lægges automatisk i skemaet, så snart fordelingen ændrer sig, i stedet
  // for at kræve et separat "anvend"-klik, der kan glemmes eller komme til
  // at gælde en forældet fordeling. Den fordeling, der forelå ved
  // opstart (fx genindlæst fra en tidligere session, hvor både fund og
  // dataset gemmes i localStorage), regnes for allerede anvendt — ellers
  // ville en almindelig genindlæsning af siden nulstille manuelle
  // rettelser, brugeren har lavet i Omform siden sidst.
  const sidstAnvendt = useRef(IKKE_SAT)
  useEffect(() => {
    if (sidstAnvendt.current === IKKE_SAT) { sidstAnvendt.current = fordeling; return }
    if (fordeling && fordeling !== sidstAnvendt.current) {
      sidstAnvendt.current = fordeling
      setDataset(d => anvendFordeling(d, fordeling))
    }
  }, [fordeling, setDataset])

  // Nye dokumenter lægges til de allerede indlæste, så længe de er fra samme
  // virksomhed — ellers ville tallene fra to selskaber blive flettet sammen
  // år for år, og det første selskabs navn blive hængende. Er de fra en
  // anden virksomhed (eller bedt om at erstatte), startes der forfra.
  //
  // Alle regnskaber regnes om til kroner og tjekkes for, at årene står i
  // samme enhed (se lib/enheder.js), før de lægges sammen.
  function modtag (nye, { erstat = false } = {}) {
    const andenVirksomhed = !erstat && fund.some(gammel => nye.some(ny => !sammeVirksomhed(gammel, ny)))
    const navn = nye.find(n => n.virksomhed)?.virksomhed || ''
    const forfra = erstat || andenVirksomhed || fund.length === 0
    const { docs, beskeder } = kontrollerEnheder(forfra ? nye : [...fund, ...nye])
    setFund(docs)
    if (forfra) {
      const tom = emptyDataset()
      const visEnhed = nye.find(n => n.visEnhed)?.visEnhed || nye.find(n => n.enhed)?.enhed || tom.enhed
      setDataset({ ...tom, virksomhed: navn, grundenhed: 'kr.', enhed: visEnhed })
    } else {
      setDataset(d => ({ ...d, virksomhed: d.virksomhed || navn, grundenhed: 'kr.' }))
    }
    const noter = [
      andenVirksomhed ? `De tidligere indlæste regnskaber${dataset.virksomhed ? ` for ${dataset.virksomhed}` : ''} er fjernet, fordi de nye er fra en anden virksomhed${navn ? ` (${navn})` : ''}.` : null,
      ...beskeder.map(b => b.tekst)
    ].filter(Boolean)
    return noter.length ? noter.join(' ') : null
  }

  async function haandterFiler (filer) {
    setArbejder(true)
    setStatus(null)
    const nye = []
    let besked = null
    for (const f of filer) {
      try {
        const erXbrl = /\.(xml|xhtml|html?)$/i.test(f.name)
        const r = erXbrl ? await importerXbrlFil(f) : await importerPdf(f)
        if (!r.kolonner.length) {
          const forklaring = erXbrl ? diagnostikTekst(r.diagnostik) : 'Prøv en iXBRL-adresse i stedet.'
          besked = { type: 'advarsel', tekst: `${f.name}: ingen regnskabsposter blev genkendt. ${forklaring}` }
        }
        nye.push(r)
      } catch (e) {
        besked = { type: 'fejl', tekst: `${f.name} kunne ikke læses: ${e.message}` }
      }
    }
    const note = nye.length ? modtag(nye) : null
    setStatus(besked ? { ...besked, tekst: [note, besked.tekst].filter(Boolean).join(' ') } : note ? { type: 'info', tekst: note } : null)
    setArbejder(false)
  }

  async function haandterLink (e) {
    e.preventDefault()
    if (!link.trim()) return
    setArbejder(true); setStatus(null)
    try {
      const r = await importerIxbrlLink(link.trim())
      if (!r.kolonner.length) {
        setStatus({ type: 'advarsel', tekst: `Dokumentet blev hentet, men indeholdt ingen genkendte XBRL-poster. ${diagnostikTekst(r.diagnostik)}` })
      } else {
        const note = modtag([r])
        if (note) setStatus({ type: 'info', tekst: note })
        setLink('')
      }
    } catch (e) {
      setStatus({ type: 'fejl', tekst: e.message })
    }
    setArbejder(false)
  }

  async function soeg (e) {
    e.preventDefault()
    const rent = cvr.replace(/\D/g, '')
    if (rent.length !== 8) { setStatus({ type: 'fejl', tekst: 'Et CVR-nummer er otte cifre.' }); return }
    setArbejder(true); setStatus(null); setTraf(null)
    try {
      const liste = await soegRegnskaber(rent)
      if (!liste.length) setStatus({ type: 'advarsel', tekst: 'Der blev ikke fundet offentliggjorte regnskaber på det CVR-nummer.' })
      setTraf(liste.map(r => ({ ...r, cvr: rent })))
    } catch (e) {
      setStatus({ type: 'fejl', tekst: e.message })
    }
    setArbejder(false)
  }

  async function hentFraTraef (liste, { erstat = false } = {}) {
    setArbejder(true); setStatus(null)
    const nye = []
    const advarsler = []
    for (const r of liste) {
      // Store selskaber indsender ofte flere separate XBRL-dokumenter under
      // samme årsrapport (fx ét med stamdata/revisionspåtegning og ét med
      // selve regnskabstallene) — alle hentes, så det rigtige ikke overses.
      const urls = (r.xbrlAlle?.length ? r.xbrlAlle : [r.xbrl]).filter(Boolean)
      if (!urls.length) continue
      const dokumenter = []
      const fejl = []
      for (const url of urls) {
        try {
          dokumenter.push(await importerIxbrlLink(url))
        } catch (e) {
          fejl.push(e.message)
        }
      }
      const flerTal = urls.length > 1
      dokumenter.forEach((d, i) => {
        nye.push({ ...d, cvr: d.cvr || r.cvr || null, kilde: `Årsrapport ${r.aar}` + (flerTal ? ` (dokument ${i + 1} af ${urls.length})` : '') })
      })
      const kolonneAntal = dokumenter.reduce((sum, d) => sum + d.kolonner.length, 0)
      if (dokumenter.length && !kolonneAntal) {
        const forklaringer = dokumenter.map(d => diagnostikTekst(d.diagnostik))
        advarsler.push(`Årsrapport ${r.aar}: ingen regnskabsposter blev genkendt${flerTal ? ` i nogen af de ${urls.length} dokumenter` : ''}. ${forklaringer.join(' ')}`)
      }
      fejl.forEach(m => advarsler.push(`Årsrapport ${r.aar}: ${m}`))
    }
    const note = nye.length ? modtag(nye, { erstat }) : null
    if (advarsler.length) {
      setStatus({ type: nye.length ? 'advarsel' : 'fejl', tekst: [note, ...advarsler].filter(Boolean).join(' ') })
    } else if (note) {
      setStatus({ type: 'info', tekst: note })
    }
    setArbejder(false)
  }

  return (
    <>
      <h2 className="sektion-titel">Indlæs tre årsregnskaber</h2>
      <p className="sektion-intro">
        Hvert årsregnskab indeholder to år, så tre regnskaber giver fire balancedatoer.
        De tre nyeste bliver analyseår; det ældste sammenligningsår bliver primobalance og
        indgår kun i gennemsnitstallene. Læg regnskaberne ind som PDF, eller hent dem som
        iXBRL fra Erhvervsstyrelsens offentliggørelser.
      </p>

      <div className="gitter-2">
        <div className="kort">
          <h3>PDF eller XBRL-fil</h3>
          <p className="hjaelp">Træk filerne herned, eller vælg dem. Alle tre på én gang er i orden.</p>
          <div
            className={'filfelt' + (over ? ' over' : '')}
            onDragOver={e => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); haandterFiler([...e.dataTransfer.files]) }}
          >
            <button className="knap lys" onClick={() => filInput.current.click()} disabled={arbejder}>
              {arbejder ? 'Læser …' : 'Vælg filer'}
            </button>
            <p>PDF, XHTML eller XML · op til ca. 30 MB pr. fil</p>
            <input
              ref={filInput} type="file" multiple accept=".pdf,.xml,.xhtml,.html" hidden
              onChange={e => { haandterFiler([...e.target.files]); e.target.value = '' }}
            />
          </div>
        </div>

        <div className="kort">
          <h3>Slå op på CVR-nummer</h3>
          <p className="hjaelp">Den nemmeste vej: appen finder selv de offentliggjorte årsrapporter og deres XBRL-dokumenter.</p>
          <form onSubmit={soeg}>
            <label className="felt" htmlFor="cvr">CVR-nummer</label>
            <input id="cvr" type="text" inputMode="numeric" value={cvr} placeholder="12345678"
              onChange={e => setCvr(e.target.value)} />
            <div style={{ marginTop: 12 }}>
              <button className="knap primaer" type="submit" disabled={arbejder}>
                {arbejder ? 'Søger …' : 'Find årsrapporter'}
              </button>
            </div>
          </form>

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--daempet)' }}>Eller indsæt en dokumentadresse direkte</summary>
            <form onSubmit={haandterLink} style={{ marginTop: 10 }}>
              <input type="url" value={link} placeholder="http://regnskaber.virk.dk/12345678/….xml"
                onChange={e => setLink(e.target.value)} />
              <p className="hjaelp" style={{ marginTop: 6 }}>
                Adressen skal pege på selve XBRL-dokumentet — typisk en .xml-fil, fx
                http://regnskaber.virk.dk/12345678/….xml. Et link kopieret fra en "download"-knap på
                datacvr.virk.dk (adresser med /gateway/) virker ikke her — brug CVR-opslaget ovenfor i stedet.
              </p>
              <button className="knap lys" type="submit" disabled={arbejder || !link.trim()} style={{ marginTop: 8 }}>Hent regnskab</button>
            </form>
          </details>
        </div>
      </div>

      {status && <div className={'besked ' + (status.type === 'info' ? '' : status.type)}>{status.tekst}</div>}

      {traf && traf.length > 0 && (
        <div className="kort">
          <div className="kort-top">
            <div>
              <h3>Offentliggjorte årsrapporter</h3>
              <p className="hjaelp">Vælg de tre nyeste, eller hent en enkelt.</p>
            </div>
            <button className="knap primaer" disabled={arbejder}
              onClick={() => hentFraTraef(traf.filter(r => r.xbrl).slice(0, 3), { erstat: true })}>
              Hent de tre nyeste med XBRL
            </button>
          </div>
          <div className="tabel-omslag">
            <table className="data">
              <thead>
                <tr><th>Regnskabsår</th><th>Periode</th><th>Offentliggjort</th><th>Format</th><th /></tr>
              </thead>
              <tbody>
                {traf.map((r, i) => (
                  <tr key={i}>
                    <td className="tal">{r.aar || '–'}</td>
                    <td style={{ fontSize: 13 }}>{r.start && r.slut ? `${r.start} → ${r.slut}` : '–'}</td>
                    <td style={{ fontSize: 13 }}>{(r.offentliggjort || '').slice(0, 10)}</td>
                    <td style={{ fontSize: 12 }}>
                      {(r.xbrlAlle?.length ? r.xbrlAlle : [r.xbrl].filter(Boolean)).map((url, j, arr) => (
                        <span key={j}>
                          {j > 0 && ' · '}
                          <a href={url} target="_blank" rel="noreferrer">XBRL{arr.length > 1 ? ` ${j + 1}` : ''}</a>
                        </span>
                      ))}
                      {r.pdf && (r.xbrl || r.xbrlAlle?.length) ? ' · ' : ''}
                      {r.pdf && <a href={r.pdf} target="_blank" rel="noreferrer">PDF</a>}
                    </td>
                    <td className="num">
                      <button className="knap lys" style={{ padding: '4px 10px', fontSize: 12 }}
                        disabled={!r.xbrl || arbejder} onClick={() => hentFraTraef([r])}>Hent</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fordeling && <Fordelingskort fordeling={fordeling} gaaTilTrin={gaaTilTrin} faktor={visningsfaktor(dataset)} enhed={dataset.enhed} />}

      {fund.length > 0 && !fordeling && (
        <div className="besked advarsel">
          Ingen af de {fund.length} indlæste dokumenter indeholdt regnskabsposter, der kunne
          genkendes, så der kan endnu ikke vises en samlet tabel. Prøv et andet dokument eller
          en iXBRL-adresse i stedet.
        </div>
      )}
    </>
  )
}

function Fordelingskort ({ fordeling, gaaTilTrin, faktor, enhed }) {
  const { poster, aar, primoAar, primo, advarsler } = fordeling
  const antalPrimo = Object.keys(primo || {}).length

  const kolonner = [
    { label: primoAar ? `Primo ${primoAar}` : 'Primo', values: primo || {} },
    ...aar.map(a => ({ label: a.label, values: a.values }))
  ]

  return (
    <div className="kort" style={{ borderColor: 'var(--petrol)' }}>
      <h3>Sådan fordeles årene</h3>
      <p className="hjaelp">Regnskabernes poster og tal, præcis som de står i regnskaberne. Beløb i {enhed.replace(/\.$/, '')}. I Analyseform omformer du selv resultatopgørelsen til analysebrug.</p>

      <div className="tidslinje">
        {primoAar
          ? (
            <div className="tidslinje-punkt primo">
              <span className="aarstal">{primoAar}</span>
              <span className="rolle">Primobalance</span>
              <span className="detalje">{antalPrimo} poster · kun til gennemsnit</span>
            </div>
            )
          : (
            <div className="tidslinje-punkt tom">
              <span className="aarstal">?</span>
              <span className="rolle">Primobalance mangler</span>
              <span className="detalje">Gennemsnitstal bliver skøn</span>
            </div>
            )}
        {aar.map((a, i) => (
          <div className="tidslinje-punkt" key={i}>
            <span className="aarstal">{a.label}</span>
            <span className="rolle">Analyseår {i + 1}</span>
            <span className="detalje">{Object.keys(a.values).length} poster · {a.kilder.length > 1 ? `${a.kilder.length} kilder` : 'én kilde'}</span>
          </div>
        ))}
      </div>

      <div className="tabel-omslag" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Post</th>
              {kolonner.map((k, i) => <th key={i} className="num">{k.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {REGNSKABSAFSNIT.map(afs => {
              const raekker = poster.filter(p => p.sektion === afs.id && kolonner.some(k => k.values[p.id] != null))
              if (!raekker.length) return null
              return (
                <Fragmenter key={afs.id}>
                  <tr className="gruppe"><td colSpan={1 + kolonner.length}>{afs.title}</td></tr>
                  {raekker.map(p => (
                    <tr key={p.id} className={p.erSum ? 'sum' : ''}>
                      <td>{p.label}</td>
                      {kolonner.map((k, i) => <td key={i} className="num">{fmt(k.values[p.id] == null ? null : k.values[p.id] * faktor, enhed)}</td>)}
                    </tr>
                  ))}
                </Fragmenter>
              )
            })}
          </tbody>
        </table>
      </div>

      {advarsler.map((a, i) => <div className="besked advarsel" key={i}>{a}</div>)}

      <button className="knap primaer" onClick={() => gaaTilTrin(2)} style={{ marginTop: 16 }}>
        Gå til analyseformen
      </button>
    </div>
  )
}

// Lille hjælper, så tabelrækker kan grupperes uden ekstra DOM-element.
function Fragmenter ({ children }) { return <>{children}</> }

import { useEffect, useMemo, useRef, useState } from 'react'
import ImportPanel from './components/ImportPanel.jsx'
import DataGrid from './components/DataGrid.jsx'
import NogletalKort from './components/NogletalKort.jsx'
import { emptyDataset, FIELDS, SECTIONS } from './lib/model.js'
import { nogletalFor, manglerOmsaetning, OMRAADER, beregnAlle, byggIndeksNogletal, formatVaerdi, procentvisAendring, formatAendring, aendringsretning } from './lib/nogletal.js'
import { hentExcel } from './lib/exportExcel.js'
import AnalyseTrin from './components/AnalyseTrin.jsx'
import VejledningTrin from './components/VejledningTrin.jsx'
import { analyser } from './analyse/analyse.js'
import { fraDataset, klarTilAnalyse } from './analyse/fraDataset.js'

// v4: omformningen gemmes som postrækkefølge og sammenlægninger af
// regnskabets egne poster. Data gemt i et ældre format ignoreres ved at
// skifte nøgle, så ingen starter med et skema i det gamle.
const NOEGLE = 'regnskabsanalyse-data-v4'
const NOEGLE_FUND = 'regnskabsanalyse-fund-v4'
// Claudes prosa til den vejledende besvarelse. Kun i denne browser.
const NOEGLE_PROSA = 'regnskabsanalyse-prosa-v1'

const TRIN = [
  { id: 0, navn: 'Velkommen' },
  { id: 1, navn: 'Indlæs regnskaber' },
  { id: 2, navn: 'Analyseform' },
  { id: 3, navn: 'Nøgletal og grafer' },
  { id: 4, navn: 'Vejledende besvarelse' },
  { id: 5, navn: 'Underviseroverblik' }
]

export default function App () {
  const [dataset, setDataset] = useState(() => {
    try {
      const gemt = localStorage.getItem(NOEGLE)
      if (gemt) return { ...emptyDataset(), ...JSON.parse(gemt) }
    } catch { /* faldbagud til tomt skema */ }
    return emptyDataset()
  })
  const [trin, setTrin] = useState(0)
  const [travl, setTravl] = useState(null)
  const [kvittering, setKvittering] = useState(null)
  // Ligger her (og ikke i ImportPanel) så de indlæste regnskaber, det indtastede
  // CVR-nummer og søgeresultatet ikke forsvinder, hvis man går videre til et
  // andet trin og siden vender tilbage for at rette i dem. Gemmes også i
  // localStorage: uden det ville "Sådan fordeles årene" forsvinde ved en
  // genindlæsning af siden, selvom de anvendte tal i Omform (dataset) består —
  // og så ville Omforms tal ikke længere kunne eftervises mod den tabel, de
  // stammer fra.
  const [fund, setFund] = useState(() => {
    try {
      const gemt = localStorage.getItem(NOEGLE_FUND)
      if (gemt) return JSON.parse(gemt)
    } catch { /* faldbagud til ingen indlæste regnskaber */ }
    return []
  })
  const [cvr, setCvr] = useState('')
  const [traf, setTraf] = useState(null)

  // Er der gemt regnskaber fra et tidligere besøg, fortsætter man med dem —
  // men det skal være tydeligt, så ingen tror, det er et nyt, tomt skema.
  const startFund = useRef(fund)
  const [genoptaget, setGenoptaget] = useState(() => fund.length > 0)
  useEffect(() => { if (fund !== startFund.current) setGenoptaget(false) }, [fund])

  useEffect(() => {
    try { localStorage.setItem(NOEGLE, JSON.stringify(dataset)) } catch { /* fx privat browsing */ }
  }, [dataset])

  useEffect(() => { window.scrollTo(0, 0) }, [trin])

  // En kvittering (fx "Skemaet er tømt.") gælder kun den handling, den
  // kvitterer for — den forsvinder, når der indlæses nye regnskaber, eller
  // når man selv skifter trin.
  useEffect(() => { if (fund.length) setKvittering(null) }, [fund])
  const skiftTrin = t => { setKvittering(null); setTrin(t) }

  useEffect(() => {
    try { localStorage.setItem(NOEGLE_FUND, JSON.stringify(fund)) } catch { /* fx privat browsing */ }
  }, [fund])

  const ekstraNogletal = useMemo(() => byggIndeksNogletal(dataset), [dataset.indeksFelter, dataset.indeksFelt])
  const resultater = useMemo(() => beregnAlle(dataset, ekstraNogletal), [dataset, ekstraNogletal])
  const aarNavne = dataset.aar.map((y, i) => y.label || `År ${i + 1}`)

  // Analysen skrives ud fra de samme nøgletal, som står i trin 3.
  const klar = useMemo(() => klarTilAnalyse(dataset), [dataset])
  // Ledelsesberetningen og udbyttet hentes fra de indlæste dokumenter (fund).
  const analyseGrundlag = useMemo(() => (klar ? fraDataset(dataset, fund) : null), [dataset, fund, klar])
  const analyse = useMemo(() => {
    if (!analyseGrundlag) return null
    try { return analyser(analyseGrundlag.kase, analyseGrundlag.noegletal) } catch (e) { console.error(e); return null }
  }, [analyseGrundlag])
  const [prosa, setProsa] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NOEGLE_PROSA) || '{}') } catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem(NOEGLE_PROSA, JSON.stringify(prosa)) } catch { /* fx privat browsing */ }
  }, [prosa])
  // Ændres tallene eller målestokkene, passer Claudes tekst ikke længere.
  const fingeraftryk = useMemo(() => JSON.stringify(analyseGrundlag), [analyseGrundlag])
  const prosaForaeldet = !!prosa._fingeraftryk && prosa._fingeraftryk !== fingeraftryk
  const gyldigProsa = prosaForaeldet ? {} : prosa

  async function hentAnalyseWord (hvad) {
    setTravl(hvad); setKvittering(null)
    try {
      // Hentes først ved klik, så resten af appen ikke venter på det.
      const { besvarelseDocx, vejledningDocx } = await import('./analyse/word.js')
      const blob = hvad === 'besvarelse' ? await besvarelseDocx(analyse, gyldigProsa) : await vejledningDocx(analyse, gyldigProsa)
      const navn = `${hvad === 'besvarelse' ? 'Vejledende besvarelse' : 'Underviseroverblik'} – ${analyse.navn.replace(/[\\/:*?"<>|]/g, '')}.docx`
      const { saveAs } = await import('file-saver')
      saveAs(blob, navn)
      setKvittering(`${navn} er hentet.`)
    } catch (e) {
      setKvittering('Word-dokumentet kunne ikke dannes: ' + e.message)
    }
    setTravl(null)
  }
  const harData = dataset.aar.some(y => FIELDS.some(f => y.values[f.key] != null))

  // "Hent Word": brugeren krydser af, hvad dokumentet skal indeholde.
  const [wordValg, setWordValg] = useState(null) // null = boksen er lukket
  const [ventWord, setVentWord] = useState(null) // valg, der venter på graferne
  const aabnWord = () => setWordValg(v => (v ? null : { noegletal: true, analyse: !!analyse, vejledning: !!analyse }))
  async function danWord (valgt) {
    setWordValg(null); setTravl('word'); setKvittering(null)
    try {
      const { hentSamletWord } = await import('./lib/samletWord.js')
      const navn = await hentSamletWord({ dataset, analyse, prosa: gyldigProsa, valgt })
      setKvittering(`${navn} er hentet.`)
    } catch (e) {
      setKvittering('Word-dokumentet kunne ikke dannes: ' + e.message)
    }
    setTravl(null)
  }
  function eksporterWord (valgt) {
    // Graferne lægges i Word fra trin 3, hvor de er tegnet.
    if (valgt.noegletal && trin !== 3) { setWordValg(null); setVentWord({ valgt, fra: trin }); setTrin(3); return }
    danWord(valgt)
  }
  useEffect(() => {
    if (!ventWord || trin !== 3) return
    const t = setTimeout(async () => {
      const { valgt, fra } = ventWord
      setVentWord(null)
      await danWord(valgt)
      setTrin(fra)
    }, 800)
    return () => clearTimeout(t)
  }, [ventWord, trin])

  function eksporterExcel () {
    setTravl('excel'); setKvittering(null)
    try {
      const navn = hentExcel(dataset)
      setKvittering(`${navn} er hentet.`)
    } catch (e) {
      setKvittering('Excel-filen kunne ikke dannes: ' + e.message)
    }
    setTravl(null)
  }

  function nulstil () {
    if (!confirm('Alle indtastede tal slettes. Fortsæt?')) return
    setGenoptaget(false)
    setDataset(emptyDataset())
    setFund([])
    setProsa({})
    setCvr('')
    setTraf(null)
    setTrin(1)
    setKvittering('Skemaet er tømt.')
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-indhold">
          <h1>Regnskabsanalyse</h1>
          <span className="undertekst">28 nøgletal · 5 analyseområder · 3 år · vejledende besvarelse</span>
          <div className="topbar-handlinger">
            <button className="knap" onClick={nulstil}>Tøm skema</button>
            <button className="knap" onClick={eksporterExcel} disabled={!harData || travl === 'excel'}>
              {travl === 'excel' ? 'Danner …' : 'Hent Excel'}
            </button>
            <span className="word-valg-holder">
              <button className="knap primaer" onClick={aabnWord} disabled={!harData || travl === 'word' || !!ventWord} aria-expanded={!!wordValg}>
                {travl === 'word' || ventWord ? 'Danner …' : 'Hent Word'}
              </button>
              {wordValg && (
                <div className="word-valg" role="dialog" aria-label="Indhold i Word-dokumentet">
                  <strong>Word-dokumentet skal indeholde</strong>
                  {[['noegletal', 'Nøgletal og grafer', true], ['analyse', 'Analyse (vejledende besvarelse)', !!analyse], ['vejledning', 'Underviseroverblik', !!analyse]].map(([id, navn, mulig]) => (
                    <label key={id} className={'afkryds' + (mulig ? '' : ' slukket')}>
                      <input type="checkbox" disabled={!mulig} checked={mulig && !!wordValg[id]} onChange={e => setWordValg(v => ({ ...v, [id]: e.target.checked }))} />
                      {' '}{navn}
                    </label>
                  ))}
                  {!analyse && <p className="hjaelp">Analysen kan først dannes, når der er tal nok til den.</p>}
                  <div className="knap-raekke">
                    <button className="knap primaer lille" disabled={!['noegletal', 'analyse', 'vejledning'].some(k => wordValg[k])} onClick={() => eksporterWord(wordValg)}>Hent</button>
                    <button className="knap lys lille" onClick={() => setWordValg(null)}>Annullér</button>
                  </div>
                </div>
              )}
            </span>
          </div>
        </div>
        <nav className="trin-navigation" aria-label="Trin">
          {TRIN.map(t => (
            <button
              key={t.id} className="trin-knap" aria-current={trin === t.id}
              onClick={() => skiftTrin(t.id)}
            >
              <span className="nummer">{t.id}</span>{t.navn}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {genoptaget && (
          <div className="besked genoptaget">
            <span>
              Du fortsætter med <strong>{dataset.virksomhed || 'de tidligere indlæste regnskaber'}</strong>, som
              blev indlæst sidst. Dine sammenlægninger og flytninger er gemt.
            </span>
            <span className="genoptaget-knapper">
              <button className="knap lys lille" onClick={() => setGenoptaget(false)}>Fortsæt</button>
              <button className="knap primaer lille" onClick={nulstil}>Start forfra</button>
            </span>
          </div>
        )}
        {kvittering && <div className="besked">{kvittering}</div>}

        {trin === 0 && <Velkomstside gaaTilTrin={skiftTrin} />}

        {trin === 1 && (
          <ImportPanel
            dataset={dataset} setDataset={setDataset} gaaTilTrin={skiftTrin}
            fund={fund} setFund={setFund} cvr={cvr} setCvr={setCvr} traf={traf} setTraf={setTraf}
          />
        )}
        {trin === 2 && (
          <>
            <DataGrid dataset={dataset} setDataset={setDataset} />
            <button className="knap lys" onClick={() => skiftTrin(3)}>Se nøgletallene</button>
          </>
        )}
        {trin === 3 && (
          <>
            <h2 className="sektion-titel">{dataset.virksomhed || 'Nøgletal'}</h2>
            <p className="sektion-intro">
              Beløb i {dataset.enhed.replace(/\.$/, '')}. Grafen under hvert nøgletal viser {aarNavne.join(', ')}.
              Word-dokumentet indeholder de samme grafer plus et tomt kommentarfelt til hvert nøgletal.
            </p>

            {manglerOmsaetning(dataset) && (
              <div className="kort brutto-valg">
                <h3>Regnskabet oplyser ikke nettoomsætning</h3>
                <p className="hjaelp">
                  Virksomheder i regnskabsklasse B må vise bruttofortjeneste i stedet for omsætning.
                  Nøgletal, der bruger omsætningen, kan derfor ikke beregnes som normalt. Nogle af dem
                  kan i stedet beregnes på bruttofortjenesten — de får så et eget navn, fx
                  "Overskudsgrad (af bruttofortjeneste)".
                </p>
                <label className="brutto-afkryds">
                  <input
                    type="checkbox" checked={!!dataset.bruttoBasis}
                    onChange={e => setDataset(d => ({ ...d, bruttoBasis: e.target.checked }))}
                  />
                  Beregn på bruttofortjeneste i stedet
                </label>
                {dataset.bruttoBasis && (
                  <p className="hjaelp" style={{ margin: '10px 0 0' }}>
                    Bruttofortjenesten påvirkes både af, hvor meget der sælges, og af, hvor meget der
                    tjenes pr. salg (og af de eksterne omkostninger). Et fald kan altså dække over et
                    stigende salg med lavere avance. Brug derfor tallene til at følge udviklingen i
                    virksomheden selv — ikke til at sammenligne med branchetal eller virksomheder, der
                    oplyser omsætning.
                  </p>
                )}
              </div>
            )}

            {OMRAADER.map(o => {
              const gruppeNogletal = nogletalFor(dataset).filter(n => n.omraade === o.id)
              return (
                <section key={o.id}>
                  <div className="omraade-overskrift">
                    <h2>{o.title}</h2>
                    <span className="antal">nøgletal {o.nrs[0]}–{o.nrs[o.nrs.length - 1]}</span>
                  </div>
                  <NogletalTabel nogletal={gruppeNogletal} resultater={resultater} aarNavne={aarNavne} enhed={dataset.enhed} />
                  <div className="nogletal-gitter" style={{ '--nt-kolonner': optimalKolonner(gruppeNogletal.length) }}>
                    {gruppeNogletal.map(n => (
                      <NogletalKort
                        key={n.nr} nogletal={n} resultater={resultater}
                        aarNavne={aarNavne} enhed={dataset.enhed}
                      />
                    ))}
                  </div>
                </section>
              )
            })}

            <div className="kort udskriv-skjul">
              <label className="felt">Indekstal (nøgletal 8) beregnes på</label>
              <p className="hjaelp" style={{ marginTop: -6 }}>Vælg én eller flere poster. Der beregnes et eget indekstal for hver post — de vises nedenfor.</p>
              <div className="indeks-poster">
                {SECTIONS.filter(sec => sec.id !== 'ovrigt').map(sec => (
                  <div className="indeks-gruppe" key={sec.id}>
                    <div className="indeks-gruppe-titel">{sec.title}</div>
                    <div className="indeks-gruppe-felter">
                      {FIELDS.filter(f => f.section === sec.id).map(f => {
                        const valgte = Array.isArray(dataset.indeksFelter) ? dataset.indeksFelter : [dataset.indeksFelt || 'omsaetning']
                        const valgt = valgte.includes(f.key)
                        return (
                          <label key={f.key} className="indeks-post">
                            <input
                              type="checkbox" checked={valgt}
                              onChange={e => setDataset(d => {
                                const nuvaerende = Array.isArray(d.indeksFelter) ? d.indeksFelter : [d.indeksFelt || 'omsaetning']
                                const nye = e.target.checked ? [...nuvaerende, f.key] : nuvaerende.filter(k => k !== f.key)
                                return { ...d, indeksFelter: nye }
                              })}
                            />
                            {f.label}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <select
                style={{ marginTop: 12 }}
                value={dataset.indeksBasisaar ?? 0}
                onChange={e => setDataset(d => ({ ...d, indeksBasisaar: Number(e.target.value) }))}
                aria-label="Basisår for indekstal"
              >
                {aarNavne.map((a, i) => <option key={i} value={i}>Basisår: {a}</option>)}
              </select>
            </div>

            {ekstraNogletal.length > 0 && (
              <section>
                <div className="omraade-overskrift">
                  <h2>Indekstal</h2>
                  <span className="antal">nøgletal 8</span>
                </div>
                <NogletalTabel nogletal={ekstraNogletal} resultater={resultater} aarNavne={aarNavne} enhed={dataset.enhed} />
                <div className="nogletal-gitter" style={{ '--nt-kolonner': optimalKolonner(ekstraNogletal.length) }}>
                  {ekstraNogletal.map(n => (
                    <NogletalKort
                      key={n.nr} nogletal={n} resultater={resultater}
                      aarNavne={aarNavne} enhed={dataset.enhed}
                    />
                  ))}
                </div>
              </section>
            )}

            <button className="knap primaer" onClick={() => skiftTrin(4)} disabled={!klar}>Til den vejledende besvarelse</button>

            <p className="fodnote" style={{ marginTop: 30 }}>
              Nøgletal markeret som skøn er beregnet på ultimotal, fordi primobalancen mangler.
              Med tre årsregnskaber leverer det ældste sammenligningsår den fjerde balancedato,
              og så er gennemsnittene rigtige hele vejen igennem.
            </p>
          </>
        )}

        {trin >= 4 && !analyse && (
          <div className="kort">
            <h3>Der mangler tal</h3>
            <p className="hjaelp">
              Analysen skrives ud fra nøgletallene. Indlæs mindst to års regnskaber med omsætning (eller bruttoresultat)
              og balance, og omform resultatopgørelsen, før du går videre.
            </p>
            <button className="knap primaer" onClick={() => skiftTrin(1)}>Indlæs regnskaber</button>
          </div>
        )}
        {trin === 4 && analyse && (
          <AnalyseTrin
            dataset={dataset} setDataset={setDataset} analyse={analyse} indlaest={analyseGrundlag.indlaest}
            prosa={prosa} setProsa={setProsa} fingeraftryk={fingeraftryk} foraeldet={prosaForaeldet}
            hentWord={hentAnalyseWord} travl={travl}
          />
        )}
        {trin === 5 && analyse && (
          <VejledningTrin analyse={analyse} prosa={gyldigProsa} hentWord={hentAnalyseWord} travl={travl} />
        )}
      </main>
    </>
  )
}

const VELKOMST_TRIN = [
  {
    navn: 'Indlæs regnskaber',
    tekst: 'Hent tre års årsregnskaber som PDF, eller slå virksomheden op på CVR-nummer og lad appen finde og hente dem selv.'
  },
  {
    navn: 'Analyseform',
    tekst: 'Se regnskabet, præcis som det er indlæst, og omform resultatopgørelsen til analysebrug: flyt poster eller læg dem sammen, hvor du finder det nødvendigt. Appen foreslår et navn til de sammenlagte poster.'
  },
  {
    navn: 'Nøgletal og grafer',
    tekst: 'Se alle 28 nøgletal, fordelt på 5 analyseområder, med grafer for udviklingen hen over de tre år.'
  },
  {
    navn: 'Vejledende besvarelse',
    tekst: 'Hvert nøgletal – eller hver gruppe af nøgletal, der hører sammen – skrives op ad formuleringstrappen: konstatering, forklaring og vurdering mod sidste år, markedsrente, tommelfingerregler og forretningsmodel. Til sidst en samlet konklusion.'
  },
  {
    navn: 'Underviseroverblik',
    tekst: 'Hvad holdet skal finde, hvor netop dette regnskab inviterer til de typiske fejl, og hvilke spørgsmål der hjælper dem videre – klar til gennemgangen.'
  }
]

function Velkomstside ({ gaaTilTrin }) {
  return (
    <>
      <h2 className="sektion-titel">Velkommen</h2>
      <p className="sektion-intro" style={{ maxWidth: '70ch' }}>
        Regnskabsanalyse henter tre års offentliggjorte årsregnskaber, præcis som de står.
        Du omformer regnskabet til analyseform, og appen beregner 28 nøgletal fordelt på
        5 analyseområder. Ud fra nøgletallene skriver appen derefter en vejledende besvarelse
        op ad formuleringstrappen og et underviseroverblik til gennemgangen med holdet.
      </p>

      <div className="velkomst-trin">
        {VELKOMST_TRIN.map((t, i) => (
          <div className="velkomst-trin-kort" key={t.navn}>
            <span className="nummer-stor">{i + 1}</span>
            <h3>{t.navn}</h3>
            <p>{t.tekst}</p>
          </div>
        ))}
      </div>

      <p className="sektion-intro" style={{ maxWidth: '70ch' }}>
        Nøgletallene hentes som Excel-fil med knappen øverst. "Hent Word" samler det, du krydser
        af – nøgletal og grafer, analysen og underviseroverblikket – i ét dokument. Besvarelsen og
        vejledningen kan også hentes hver for sig under trin 4 og 5.
      </p>

      <button className="knap primaer" onClick={() => gaaTilTrin(1)}>Kom i gang</button>
    </>
  )
}

// Vælger det bedste antal kolonner (højst 3), så graferne fordeler sig så
// jævnt som muligt: tre i bredden, medmindre gruppens antal går bedre op
// med to (fx 4 grafer bliver 2+2 i stedet for 3+1 med en ensom sidste graf).
function optimalKolonner (antal, maks = 3) {
  if (antal <= maks) return Math.max(antal, 1)
  for (let k = maks; k >= 2; k--) {
    const rest = antal % k
    if (rest === 0 || rest >= 2) return k
  }
  return maks
}

// Sammendrag af en gruppes nøgletal for alle år, vist over graferne, så
// tallene kan aflæses samlet, før man kigger på udviklingen i den enkelte graf.
function NogletalTabel ({ nogletal, resultater, aarNavne, enhed }) {
  const harSkoen = nogletal.some(n => resultater.some(r => r[n.nr].skoen))
  return (
    <div className="tabel-omslag">
      <table className="data">
        <thead>
          <tr>
            <th>Nøgletal</th>
            {aarNavne.map((a, i) => <th key={i} className="num">{a}</th>)}
            <th className="num aendring-kolonne" title="Procentvis ændring fra det første til det sidste år med et tal">Ændring i %</th>
          </tr>
        </thead>
        <tbody>
          {nogletal.map(n => {
            const aendring = procentvisAendring(resultater, n.nr)
            return (
              <tr key={n.nr}>
                <td>{typeof n.nr === 'number' && `${n.visNr ?? n.nr}. `}{n.navn}</td>
                {resultater.map((r, i) => (
                  <td key={i} className="num">
                    {formatVaerdi(n, r[n.nr].value, enhed)}
                    {r[n.nr].skoen && <span className="skoen-mærke" title="Beregnet på ultimotal, fordi primobalancen mangler">*</span>}
                  </td>
                ))}
                <td className={'num aendring-kolonne aendring ' + aendringsretning(n, aendring)}>{formatAendring(aendring)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {harSkoen && <p className="hjaelp" style={{ marginTop: 6 }}>* Skøn — beregnet på ultimotal, fordi primobalancen mangler.</p>}
    </div>
  )
}

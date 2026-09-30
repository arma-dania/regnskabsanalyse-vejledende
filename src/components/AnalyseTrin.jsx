import { useMemo, useState } from 'react'
import { OMRAADER, NT, formatNt } from '../analyse/beregning.js'
import { PROFILER, PROFILNOEGLE, TOMMELFINGERREGLER, MARKEDSRENTE_FORSLAG, MARKEDSRENTE_NAVN, findProfil, modProfil } from '../analyse/maalestok.js'
import { TRIN } from '../analyse/temaer.js'
import { tomAnalyse } from '../analyse/fraDataset.js'
import { talIAnalysen, tjekTal } from '../analyse/tjek.js'
import { hentKode, gemKode, tjekKode, alleGrupper, skrivGruppe, skrivOmraade, skrivKonklusion } from '../analyse/api.js'

const komma = x => String(x).replace('.', ',')

/**
 * Trin 4: målestokkene og den vejledende besvarelse, skrevet ud fra
 * nøgletallene fra trin 3.
 */
export default function AnalyseTrin ({ dataset, setDataset, analyse, indlaest, prosa, setProsa, fingeraftryk, foraeldet, hentWord, travl }) {
  return (
    <>
      <h2 className="sektion-titel">Vejledende besvarelse – {analyse.navn}</h2>
      <p className="sektion-intro">
        Analysen er skrevet ud fra nøgletallene i trin 3 og følger formuleringstrappen: trin 1-3 for hvert
        nøgletal og hver gruppe af nøgletal, en delkonklusion for hvert analyseområde og trin 4 i den samlede konklusion. Motoren regner; Claude kan omskrive
        til prosa.
      </p>
      <Maalestokke dataset={dataset} setDataset={setDataset} analyse={analyse} />
      <Beretning dataset={dataset} setDataset={setDataset} analyse={analyse} indlaest={indlaest} />
      <div className="knap-raekke">
        <button className="knap primaer" disabled={!!travl} onClick={() => hentWord('besvarelse')}>
          {travl === 'besvarelse' ? 'Danner …' : 'Hent vejledende besvarelse (Word)'}
        </button>
      </div>
      <Besvarelse analyse={analyse} prosa={prosa} setProsa={setProsa} fingeraftryk={fingeraftryk} foraeldet={foraeldet} />
    </>
  )
}

/* ====================== Målestokke ====================== */

function Maalestokke ({ dataset, setDataset, analyse }) {
  const a = { ...tomAnalyse(), ...(dataset.analyse || {}) }
  const saet = aendring => setDataset(d => ({ ...d, analyse: { ...tomAnalyse(), ...(d.analyse || {}), ...aendring } }))
  const saetRente = (i, x) => {
    const r = [...a.markedsrente]
    const t = Number(String(x).replace(',', '.'))
    r[i] = x === '' || !Number.isFinite(t) ? null : t
    saet({ markedsrente: r })
  }
  const profil = findProfil(a.profil)
  const [aaben, setAaben] = useState(!a.profil)

  return (
    <div className="kort">
      <div className="kort-top">
        <h3>Målestokke til trin 3</h3>
        <button className="knap lys lille" onClick={() => setAaben(!aaben)}>{aaben ? 'Skjul' : 'Vis og ret'}</button>
      </div>
      {!aaben && (
        <p className="hjaelp">
          Markedsrente: {analyse.aar.map((y, i) => `${y} ${komma(analyse.rente[i])} %`).join(', ')}.
          Forretningsmodel: {profil ? profil.navn.toLowerCase() : 'ikke valgt'}. Tommelfingerregler for soliditet og likviditet.
        </p>
      )}
      {aaben && (
        <>
          <label className="felt">Markedsrenten – {MARKEDSRENTE_NAVN}</label>
          <p className="hjaelp">
            Omkring 24. september 2026 lå den på ca. {komma(MARKEDSRENTE_FORSLAG)} %. Brug helst årets gennemsnit for de
            ældre år. Et tomt felt giver {komma(MARKEDSRENTE_FORSLAG)} %.
          </p>
          <div className="rente-felter">
            {analyse.aar.map((y, i) => (
              <label key={i}>{y}{' '}
                <input
                  type="text" inputMode="decimal" size={5} placeholder={komma(MARKEDSRENTE_FORSLAG)}
                  defaultValue={a.markedsrente[i] == null ? '' : komma(a.markedsrente[i])}
                  onBlur={e => saetRente(i, e.target.value)}
                /> %
              </label>
            ))}
          </div>

          <label className="felt" style={{ marginTop: 16 }}>Forretningsmodellen – typisk profil</label>
          <select value={a.profil} onChange={e => saet({ profil: e.target.value })}>
            <option value="">– vælg –</option>
            {PROFILER.map(p => <option key={p.id} value={p.id}>{p.navn}</option>)}
          </select>
          {profil && <p className="hjaelp">{profil.kendetegn}</p>}
          {profil && (
            <div className="tabel-omslag">
              <table className="data smal">
                <thead><tr><th>Nøgletal</th><th className="num">Typisk</th><th className="num">{analyse.aar[2]}</th><th /></tr></thead>
                <tbody>
                  {Object.entries(PROFILNOEGLE).map(([k, nr]) => {
                    const v = analyse.beregnet[2].n[nr]
                    const d = modProfil(v, profil.v[k])
                    return (
                      <tr key={k}>
                        <td>{NT[nr].navn}</td>
                        <td className="num">{profil.v[k] == null ? 'intet lager' : formatNt(nr, profil.v[k])}</td>
                        <td className="num">{formatNt(nr, v)}</td>
                        <td className={d && d !== 'på linje' ? 'afvig' : ''}>{d || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <label className="felt" style={{ marginTop: 16 }}>Virksomhedens forretningsmodel (bruges i trin 4)</label>
          <textarea
            rows={4} defaultValue={a.forretningsmodel} onBlur={e => saet({ forretningsmodel: e.target.value })}
            placeholder="Hvordan tjener virksomheden penge? Kunder, produkter, kanaler og strategi – gerne med ledelsesberetningens egne ord."
          />

          <label className="felt" style={{ marginTop: 16 }}>Tommelfingerregler</label>
          <ul className="hjaelp">
            {Object.entries(TOMMELFINGERREGLER).map(([nr, r]) => <li key={nr}><strong>{r.tekst}</strong> {r.hvorfor}</li>)}
          </ul>
        </>
      )}
    </div>
  )
}

/* ====================== Ledelsesberetning ====================== */

function Beretning ({ dataset, setDataset, analyse, indlaest }) {
  const a = { ...tomAnalyse(), ...(dataset.analyse || {}) }
  const saet = aendring => setDataset(d => ({ ...d, analyse: { ...tomAnalyse(), ...(d.analyse || {}), ...aendring } }))
  const [aaben, setAaben] = useState(false)
  const tekst = analyse.beretning || ''
  return (
    <div className="kort">
      <div className="kort-top">
        <h3>Ledelsesberetning</h3>
        <button className="knap lys lille" onClick={() => setAaben(!aaben)}>{aaben ? 'Skjul' : 'Vis og ret'}</button>
      </div>
      <p className="hjaelp">
        {tekst ? `Ledelsesberetningen er indlæst (${tekst.length.toLocaleString('da-DK')} tegn).` : 'Der blev ikke fundet en ledelsesberetning i det indlæste regnskab. Indsæt den selv under "Vis og ret".'}
      </p>
      <label className="afkryds">
        <input type="checkbox" checked={a.brugCitater !== false} onChange={e => saet({ brugCitater: e.target.checked })} disabled={!tekst} />
        {' '}Brug citater fra ledelsesberetningen i analysen
        <span className="hjaelp"> – ved hvert nøgletal (trin 2), i Claudes prosa og i konklusionen. Slå det fra, hvis beretningen ikke siger noget brugbart om tallene.</span>
      </label>
      {aaben && (
        <>
          <label className="felt">Ledelsesberetningen</label>
          <textarea
            rows={10} key={a.beretning == null ? 'indlaest' : 'rettet'}
            defaultValue={tekst} onBlur={e => saet({ beretning: e.target.value === (indlaest?.beretning || '') ? null : e.target.value })}
            placeholder="Indsæt ledelsesberetningen her, hvis den ikke blev fundet ved indlæsningen."
          />
          {a.beretning != null && <button className="knap lys lille" onClick={() => saet({ beretning: null })}>Brug den indlæste beretning</button>}
        </>
      )}
    </div>
  )
}

/* ====================== Besvarelsen ====================== */

function Besvarelse ({ analyse, prosa, setProsa, fingeraftryk, foraeldet }) {
  const [kode, setKode] = useState(hentKode())
  const [forbundet, setForbundet] = useState(false)
  const [travl, setTravl] = useState('')
  const [fejl, setFejl] = useState('')
  const saet = useMemo(() => talIAnalysen(analyse), [analyse])
  const brug = foraeldet ? {} : prosa

  async function forbind (e) {
    e.preventDefault()
    setFejl('')
    try { await tjekKode(kode); gemKode(kode); setForbundet(true) } catch (x) { setFejl(x.message) }
  }
  // Én trappe ad gangen, så hvert kald er kort og holder sig under
  // Netlifys tidsgrænse.
  async function skrivGrp (oid, g, p) {
    setTravl(g.id)
    const svar = await skrivGruppe(analyse, oid, g, kode)
    return { ...p, grupper: { ...(p.grupper || {}), [g.id]: svar }, _fingeraftryk: fingeraftryk }
  }
  async function skrivOmr (oid, p) {
    setTravl(oid)
    const svar = await skrivOmraade(analyse, oid, p, kode)
    return { ...p, omraader: { ...(p.omraader || {}), [oid]: svar }, _fingeraftryk: fingeraftryk }
  }
  async function skrivKonk (p) {
    setTravl('konklusion')
    return { ...p, konklusion: await skrivKonklusion(analyse, p, kode), _fingeraftryk: fingeraftryk }
  }
  async function koer (fn) {
    setFejl('')
    try { await fn() } catch (x) { setFejl(x.message) } finally { setTravl('') }
  }
  const skrivAlt = () => koer(async () => {
    let p = { ...brug }
    for (const o of OMRAADER) {
      if (analyse.omraader[o.id].ikkeRelevant) continue
      for (const { gruppe } of alleGrupper(analyse).filter(x => x.omraade === o.id)) {
        p = await skrivGrp(o.id, gruppe, p)
        setProsa(p)
      }
      p = await skrivOmr(o.id, p)
      setProsa(p)
    }
    setProsa(await skrivKonk(p))
  })
  const skrivEn = (oid, g) => koer(async () => setProsa(await skrivGrp(oid, g, brug)))
  const skrivDelkonklusion = oid => koer(async () => setProsa(await skrivOmr(oid, brug)))
  const skrivKonklusionen = () => koer(async () => setProsa(await skrivKonk(brug)))
  const travlNavn = travl === 'konklusion' ? 'konklusionen' : analyse.omraader[travl] ? `delkonklusionen for ${analyse.omraader[travl].navn.toLowerCase()}` : alleGrupper(analyse).find(x => x.gruppe.id === travl)?.gruppe.titel.toLowerCase()

  return (
    <>
      <div className="kort claude-kort">
        <h3>Motorens tekst eller Claudes prosa</h3>
        <p className="hjaelp">
          Nedenfor står motorens analyse: alt er regnet ud fra nøgletallene, intet er gættet. Claude kan omskrive den til
          sammenhængende prosa og skrive trin 4. Claude må kun bruge tallene fra analysen – hvert tal tjekkes, og ukendte
          tal markeres med gult.
        </p>
        {!forbundet
          ? (
            <form className="knap-raekke" onSubmit={forbind}>
              <label>Adgangskode <input type="password" value={kode} onChange={e => setKode(e.target.value)} /></label>
              <button className="knap primaer">Forbind</button>
            </form>
            )
          : (
            <div className="knap-raekke">
              <button className="knap primaer" disabled={!!travl} onClick={skrivAlt}>
                {travl ? `Skriver ${travlNavn} …` : 'Skriv hele besvarelsen som prosa'}
              </button>
              {Object.keys(brug).length > 0 && <button className="knap lys" disabled={!!travl} onClick={() => setProsa({})}>Tilbage til motorens tekst</button>}
            </div>
            )}
        {foraeldet && <div className="besked advarsel">Nøgletallene eller målestokkene er ændret, siden Claude skrev prosaen. Den bruges ikke, før den er skrevet igen.</div>}
        {fejl && <div className="besked fejl">{fejl}</div>}
      </div>

      {OMRAADER.map(o => (
        <Omraade
          key={o.id} a={analyse} id={o.id} prosa={brug.grupper || {}} dk={brug.omraader?.[o.id]?.delkonklusion} saet={saet}
          kanSkrive={forbundet && !travl} skriv={g => skrivEn(o.id, g)} skrivDk={() => skrivDelkonklusion(o.id)}
        />
      ))}

      <section className="kort">
        <h3>Samlet konklusion</h3>
        <p className="hjaelp">På tværs af de fem analyseområder, målt mod sidste år, markedsrenten og tommelfingerreglerne.</p>
        {brug.konklusion?.samlet
          ? <Prosa tekst={brug.konklusion.samlet} saet={saet} a={analyse} />
          : analyse.konklusion.samlet.map((s, i) => <p key={i}>{s}</p>)}
      </section>

      <section className="kort">
        <h3>Trin 4 – Forretningsmodellen</h3>
        <p className="trin-spm">{TRIN[3].spoergsmaal}</p>
        {brug.konklusion
          ? <Prosa tekst={brug.konklusion.trin4} saet={saet} a={analyse} />
          : (
            <>
              <p className="hjaelp">Motorens udkast – skriv selv, eller lad Claude skrive konklusionen.</p>
              {analyse.konklusion.udkast.map((s, i) => <p key={i}>{s}</p>)}
            </>
            )}
        <div className="to-spalter">
          <div><h4>Styrker</h4><ul>{analyse.konklusion.styrker.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          <div><h4>Svagheder</h4><ul>{analyse.konklusion.svagheder.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        </div>
        {forbundet && <button className="knap lys" disabled={!!travl} onClick={skrivKonklusionen}>{travl === 'konklusion' ? 'Skriver …' : 'Skriv trin 4 med Claude'}</button>}
      </section>
    </>
  )
}

function Omraade ({ a, id, prosa, dk, saet, kanSkrive, skriv, skrivDk }) {
  const o = a.omraader[id]
  return (
    <section className="kort">
      <h3>{o.navn}</h3>
      {o.indledning && <p className="indledning">{o.indledning}</p>}
      {o.ikkeRelevant
        ? <p className="hjaelp">Der er ikke oplyst antal aktier og børskurs, så de børsrelaterede nøgletal kan ikke beregnes. Er virksomheden ikke børsnoteret, springes området over.</p>
        : o.grupper.map(g => (
          <div key={g.id} className="noegletal-trappe">
            <div className="kort-top">
              <h4>{g.titel}</h4>
              {kanSkrive && <button className="knap lys lille" onClick={() => skriv(g)}>{prosa[g.id] ? 'Skriv igen' : 'Skriv som prosa'}</button>}
            </div>
            <table className="data smal">
              <thead><tr><th>Nøgletal</th>{a.aar.map(y => <th key={y} className="num">{y}</th>)}<th className="num">Ændring i %</th></tr></thead>
              <tbody>
                {o.tabel.filter(r => g.nrs.includes(r.nr)).map(r => (
                  <tr key={r.nr}><td>{r.nr}. {r.navn}</td>{r.tekst.map((t, i) => <td key={i} className="num">{t}</td>)}<td className="num">{r.pct}</td></tr>
                ))}
              </tbody>
            </table>
            {TRIN.slice(0, 3).map(t => (
              <div key={t.nr} className="trin-blok">
                <h5><span className="trin-nr">{t.nr}</span> {t.navn} <span className="trin-spm">{t.spoergsmaal}</span></h5>
                {prosa[g.id]
                  ? <Prosa tekst={prosa[g.id][`trin${t.nr}`]} saet={saet} a={a} />
                  : g[`trin${t.nr}`].map((x, i) => <p key={i}>{x}</p>)}
                {t.nr === 2 && g.beretning?.length > 0 && (
                  <blockquote className="citat">
                    <span className="citat-kilde">Ledelsesberetningen:</span>
                    {g.beretning.map((c, i) => <span key={i}> »{c}«</span>)}
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        ))}
      {!o.ikkeRelevant && (dk || o.delkonklusion) && (
        <div className="delkonklusion">
          <div className="kort-top">
            <span className="delkonklusion-titel">Delkonklusion – {o.navn.toLowerCase()}</span>
            {kanSkrive && <button className="knap lys lille" onClick={skrivDk}>{dk ? 'Skriv igen' : 'Skriv som prosa'}</button>}
          </div>
          {dk ? <Prosa tekst={dk} saet={saet} a={a} /> : <p>{o.delkonklusion}</p>}
        </div>
      )}
    </section>
  )
}

/** Claudes tekst med ukendte tal markeret. */
function Prosa ({ tekst, saet, a }) {
  const ukendte = tjekTal(tekst, a, saet)
  const re = ukendte.length ? new RegExp(`(${ukendte.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g') : null
  const marker = afs => (re ? afs.split(re).map((d, i) => (ukendte.includes(d) ? <mark key={i} title="Tallet findes ikke i analysen">{d}</mark> : d)) : afs)
  return (
    <div className="prosa">
      {String(tekst || '').split(/\n+/).filter(x => x.trim()).map((afs, i) => <p key={i}>{marker(afs)}</p>)}
      {ukendte.length > 0 && <div className="besked advarsel">Tal, der ikke findes i analysen: {ukendte.join(', ')}. Ret eller skriv igen.</div>}
    </div>
  )
}

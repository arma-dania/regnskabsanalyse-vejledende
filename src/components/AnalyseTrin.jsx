import { useMemo, useState } from 'react'
import { OMRAADER, NT, formatNt, fmtPct, fmtPp, fmtX } from '../analyse/beregning.js'
import { PROFILER, PROFILNOEGLE, TOMMELFINGERREGLER, MARKEDSRENTE_FORSLAG, MARKEDSRENTE_NAVN, findProfil, modProfil } from '../analyse/maalestok.js'
import { TRIN } from '../analyse/temaer.js'
import { tomAnalyse } from '../analyse/fraDataset.js'
import { talIAnalysen, tjekTal } from '../analyse/tjek.js'
import { hentKode, gemKode, tjekKode, skrivOmraade, skrivKonklusion } from '../analyse/api.js'

const komma = x => String(x).replace('.', ',')

/**
 * Trin 4: målestokkene og den vejledende besvarelse, skrevet ud fra
 * nøgletallene fra trin 3.
 */
export default function AnalyseTrin ({ dataset, setDataset, analyse, prosa, setProsa, fingeraftryk, foraeldet, hentWord, travl }) {
  return (
    <>
      <h2 className="sektion-titel">Vejledende besvarelse – {analyse.navn}</h2>
      <p className="sektion-intro">
        Analysen er skrevet ud fra nøgletallene i trin 3 og følger formuleringstrappen: trin 1-3 for hvert
        analyseområde og trin 4 i den samlede konklusion. Motoren regner; Claude kan omskrive til prosa.
      </p>
      <Maalestokke dataset={dataset} setDataset={setDataset} analyse={analyse} />
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
  async function skrivEt (id, p) {
    setTravl(id)
    const svar = id === 'konklusion' ? await skrivKonklusion(analyse, p, kode) : await skrivOmraade(analyse, id, kode)
    return { ...p, [id]: svar, _fingeraftryk: fingeraftryk }
  }
  async function skrivAlt () {
    setFejl('')
    let p = { ...brug }
    try {
      for (const o of OMRAADER) {
        if (analyse.omraader[o.id].ikkeRelevant) continue
        p = await skrivEt(o.id, p)
        setProsa(p)
      }
      setProsa(await skrivEt('konklusion', p))
    } catch (x) { setFejl(x.message) } finally { setTravl('') }
  }
  async function skrivEn (id) {
    setFejl('')
    try { setProsa(await skrivEt(id, brug)) } catch (x) { setFejl(x.message) } finally { setTravl('') }
  }

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
                {travl ? `Skriver ${travl === 'konklusion' ? 'konklusionen' : analyse.omraader[travl]?.navn.toLowerCase()} …` : 'Skriv hele besvarelsen som prosa'}
              </button>
              {Object.keys(brug).length > 0 && <button className="knap lys" disabled={!!travl} onClick={() => setProsa({})}>Tilbage til motorens tekst</button>}
            </div>
            )}
        {foraeldet && <div className="besked advarsel">Nøgletallene eller målestokkene er ændret, siden Claude skrev prosaen. Den bruges ikke, før den er skrevet igen.</div>}
        {fejl && <div className="besked fejl">{fejl}</div>}
      </div>

      {OMRAADER.map(o => (
        <Omraade
          key={o.id} a={analyse} id={o.id} prosa={brug[o.id]} saet={saet}
          kanSkrive={forbundet && !travl && !analyse.omraader[o.id].ikkeRelevant} skriv={() => skrivEn(o.id)}
        />
      ))}

      <section className="kort">
        <h3>Samlet konklusion – Trin 4 Forretningsmodellen</h3>
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
        {forbundet && <button className="knap lys" disabled={!!travl} onClick={() => skrivEn('konklusion')}>{travl === 'konklusion' ? 'Skriver …' : 'Skriv trin 4 med Claude'}</button>}
      </section>
    </>
  )
}

function Omraade ({ a, id, prosa, saet, kanSkrive, skriv }) {
  const o = a.omraader[id]
  return (
    <section className="kort">
      <div className="kort-top">
        <h3>{o.navn}</h3>
        {kanSkrive && <button className="knap lys lille" onClick={skriv}>{prosa ? 'Skriv igen' : 'Skriv som prosa'}</button>}
      </div>
      {id === 'rentabilitet' && <DuPont a={a} />}
      {id === 'rentabilitet' && <EkfTabel a={a} />}
      {o.ikkeRelevant
        ? <p>{o.trin1[0]}</p>
        : TRIN.slice(0, 3).map(t => (
          <div key={t.nr} className="trin-blok">
            <h4><span className="trin-nr">{t.nr}</span> {t.navn} <span className="trin-spm">{t.spoergsmaal}</span></h4>
            {prosa
              ? <Prosa tekst={prosa[`trin${t.nr}`]} saet={saet} a={a} />
              : <ul>{o[`trin${t.nr}`].map((s, i) => <li key={i}>{s}</li>)}</ul>}
          </div>
        ))}
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

export function DuPont ({ a }) {
  const b = a.beregnet
  const s = f => b.map(x => f(x)).join(' · ')
  const boks = (titel, vaerdi, klasse = '') => <div className={`dp-boks ${klasse}`}><div className="dp-titel">{titel}</div><div className="dp-tal">{vaerdi}</div></div>
  const d = a.dupont.filter(Boolean)
  return (
    <div className="dupont">
      <div className="hjaelp">DuPont med virksomhedens egne tal ({a.aar.join(' · ')})</div>
      <div className="dp-niveau">{boks('Afkastningsgrad', s(x => fmtPct(x.n[1])), 'top')}</div>
      <div className="dp-grene">
        <div className="dp-gren">
          {boks('Overskudsgrad', s(x => fmtPct(x.n[2])))}
          <div className="dp-niveau">
            {boks('Bruttomargin', s(x => fmtPct(x.n[7])), 'lav')}
            <div className="dp-tegn">−</div>
            {boks('Kap.omk. i % af oms.', s(x => fmtPct(x.mellem.koAndel)), 'lav')}
          </div>
          <div className="hjaelp">forklares under indtjeningsevne</div>
        </div>
        <div className="dp-tegn stor">×</div>
        <div className="dp-gren">
          {boks('Aktivernes oms.hastighed', s(x => fmtX(x.n[3])))}
          <div className="dp-niveau">
            {boks('Anlæg', s(x => fmtX(x.mellem.binding.anlaeg, 0)), 'lav')}
            {boks('Lager', s(x => fmtX(x.mellem.binding.varelager, 0)), 'lav')}
            {boks('Debitorer', s(x => fmtX(x.mellem.binding.debitorer, 0)), 'lav')}
          </div>
          <div className="hjaelp">kr. bundet pr. 100 kr. omsætning (ultimo) – forklares under kapitaltilpasning</div>
        </div>
      </div>
      {d.length > 0 && (
        <table className="data smal">
          <thead><tr><th>Ændring i AG</th>{d.map(x => <th key={x.til} className="num">{x.til}</th>)}</tr></thead>
          <tbody>
            <tr><td>fra overskudsgraden</td>{d.map(x => <td key={x.til} className="num">{fmtPp(x.ogEffekt)}</td>)}</tr>
            <tr><td>fra omsætningshastigheden</td>{d.map(x => <td key={x.til} className="num">{fmtPp(x.aohEffekt)}</td>)}</tr>
            <tr className="sum"><td>i alt</td>{d.map(x => <td key={x.til} className="num">{fmtPp(x.dAG)}</td>)}</tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

export function EkfTabel ({ a }) {
  const e = a.ekf.afstemning
  if (!e.every(x => x?.efterSkat != null)) return null
  const r = (t, f, klasse) => <tr className={klasse}><td>{t}</td>{e.map((x, i) => <td key={i} className="num">{f(x)}</td>)}</tr>
  return (
    <div className="tabel-omslag">
      <table className="data smal">
        <thead><tr><th>EKF-formlen og afstemningen</th>{a.aar.map(y => <th key={y} className="num">{y}</th>)}</tr></thead>
        <tbody>
          {r('AG', x => fmtPct(x.ag))}
          {r('r', x => fmtPct(x.r))}
          {r('FK/EK', x => fmtX(x.g))}
          {r('+ (AG − r) · FK/EK', x => fmtPp(x.gearingsbidrag))}
          {r('= EKF før skat, formlen', x => fmtPct(x.formel), 'sum')}
          {r('+ øvrige finansielle poster', x => fmtPp(x.rest))}
          {r('− skat', x => fmtPp(x.skat))}
          {r('= EKF efter skat (nr. 4)', x => fmtPct(x.efterSkat), 'sum')}
        </tbody>
      </table>
    </div>
  )
}

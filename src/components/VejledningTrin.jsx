import { OMRAADER } from '../analyse/beregning.js'
import { TRIN } from '../analyse/temaer.js'

const FORLOEB = [
  ['0–10', 'Formuleringstrappen på tavlen – de fire spørgsmål er ryggraden i gennemgangen.'],
  ['10–25', 'Det store billede og sammenhængskæden: hvad er sket med AG, og hvilket led i kæden forklarer det?'],
  ['25–50', 'Indtjeningsevne og kapitaltilpasning: grupperne forklarer hver sin faktor (OG eller AOH). Brug sammenhængene og faldgruberne.'],
  ['50–65', 'Soliditet og likviditet: tommelfingerreglerne – og hvad resultat, udbytte og arbejdskapital betyder for dem.'],
  ['65–85', 'Trin 4 i grupper: holder forretningsmodellen? Én anbefaling pr. gruppe, der følger af tallene.'],
  ['85–90', 'Opsamling: hvilke faldgruber ramte vi, og hvilket trin var sværest?']
]

// Kædens led er alle bedre, når de stiger.
const farve = b => (b === 'forbedret' ? 'op' : b === 'forringet' ? 'ned' : '')

/** Trin 5: underviservejledningen – pointer og sammenhænge område for område. */
export default function VejledningTrin ({ analyse: a, prosa, hentWord, travl }) {
  const k = a.konklusion
  const kaede = a.pointer?.kaede || []
  const samlet = (prosa.konklusion?.samlet || k.samlet.join('\n') || k.udkast[0] || '').split(/\n+/).filter(x => x.trim())
  return (
    <>
      <h2 className="sektion-titel">Underviservejledning – {a.navn}</h2>
      <p className="sektion-intro">
        De vigtigste pointer og sammenhænge til gennemgangen med holdet. Den fulde trappe for hvert nøgletal står i den
        vejledende besvarelse.
      </p>
      <div className="knap-raekke">
        <button className="knap primaer" disabled={!!travl} onClick={() => hentWord('vejledning')}>
          {travl === 'vejledning' ? 'Danner …' : 'Hent underviservejledning (Word)'}
        </button>
      </div>

      <section className="kort">
        <h3>Det store billede</h3>
        {kaede.length > 0 && (
          <>
            <p className="hjaelp" style={{ marginTop: 0 }}><strong>Sammenhængskæden:</strong> AG = OG × AOH → EKF (gearing) → soliditet → likviditet. Følg kæden, og spørg ved hvert led: hvorfor?</p>
            <div className="kaede">
              {kaede.map((x, i) => (
                <div key={x.nr} className="kaede-led-holder">
                  {i > 0 && <span className="kaede-pil">{x.nr === 3 ? '×' : '→'}</span>}
                  <div className={'kaede-led ' + farve(x.bevaegelse)}>
                    <span className="kaede-navn">{x.navn}</span>
                    <span className="kaede-tal">{x.fra} {x.pil} {x.til}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {samlet.map((x, i) => <p key={i}>{x}</p>)}
        <div className="to-spalter">
          <div><h4>Styrker</h4><ul>{k.styrker.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          <div><h4>Svagheder</h4><ul>{k.svagheder.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        </div>
      </section>

      {OMRAADER.map(o => {
        const om = a.omraader[o.id]
        if (om.ikkeRelevant) return null
        const dk = prosa.omraader?.[o.id]?.delkonklusion || om.delkonklusion
        const sam = a.pointer?.sammenhaenge?.[o.id] || []
        const fg = a.faldgruber.filter(f => f.omraade === o.id)
        return (
          <section className="kort" key={o.id}>
            <h3>{om.navn}</h3>
            {dk && (
              <div className="delkonklusion">
                <span className="delkonklusion-titel">Hovedpointe</span>
                <p>{dk}</p>
              </div>
            )}
            <table className="data smal">
              <thead><tr><th>Nøgletal</th>{a.aar.map(y => <th key={y} className="num">{y}</th>)}<th className="num">Ændring i %</th></tr></thead>
              <tbody>
                {om.tabel.filter(r => r.vaerdier.some(x => x != null)).map(r => (
                  <tr key={r.nr}><td>{r.nr}. {r.navn}</td>{r.tekst.map((t, i) => <td key={i} className="num">{t}</td>)}<td className="num">{r.pct}</td></tr>
                ))}
              </tbody>
            </table>
            {sam.length > 0 && (
              <>
                <h4>Sammenhænge, holdet skal se</h4>
                <ul>{sam.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </>
            )}
            {fg.length > 0 && (
              <>
                <h4>Faldgruber at tage fat i</h4>
                {fg.map((f, i) => <Faldgrube key={i} f={f} />)}
              </>
            )}
            <details>
              <summary>Hele trappen for området</summary>
              {om.grupper.map(g => (
                <div key={g.id} className="noegletal-trappe">
                  <h5>{g.titel}</h5>
                  <ul>{[...g.trin2, ...g.trin3].map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              ))}
            </details>
          </section>
        )
      })}

      <section className="kort">
        <h3>Trin 4 – forretningsmodellen</h3>
        {a.profil && <p><strong>Typisk {a.profil.navn.toLowerCase()}:</strong> {a.profil.kendetegn}</p>}
        {k.afvigelser.length > 0 && <><h4>Afvigelser fra profilen</h4><ul>{k.afvigelser.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
        {k.anbefalinger.length > 0 && <><h4>Anbefalinger, der følger af tallene</h4><ul>{k.anbefalinger.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
        {a.faldgruber.filter(f => f.omraade === 'konklusion').map((f, i) => <Faldgrube key={i} f={f} />)}
      </section>

      <section className="kort">
        <h3>Forslag til forløb (90 minutter)</h3>
        <table className="data">
          <tbody>{FORLOEB.map(([t, x]) => <tr key={t}><td className="num" style={{ width: 70 }}>{t}</td><td>{x}</td></tr>)}</tbody>
        </table>
        <h4>Tjekliste: hvornår er et trin nået?</h4>
        <table className="data">
          <tbody>{TRIN.map(t => <tr key={t.nr}><td style={{ width: 170 }}><strong>{t.nr} {t.navn}</strong></td><td>{t.krav}</td></tr>)}</tbody>
        </table>
      </section>
    </>
  )
}

function Faldgrube ({ f }) {
  return (
    <div className="faldgrube">
      <div className="faldgrube-tema">{f.temaNavn}</div>
      <p><strong>Forventet:</strong> {f.forventet}</p>
      <p><strong>Spørg:</strong> {f.spoergsmaal}</p>
      <p><strong>Svaret:</strong> {f.svar}</p>
    </div>
  )
}

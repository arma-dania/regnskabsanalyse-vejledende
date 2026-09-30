import { OMRAADER } from '../analyse/beregning.js'
import { TRIN } from '../analyse/temaer.js'

const FORLOEB = [
  ['0–10', 'Formuleringstrappen på tavlen – de fire spørgsmål er ryggraden i gennemgangen.'],
  ['10–35', 'Rentabilitet: tag afkastningsgraden op ad trappen sammen med holdet – konstatering, forklaring med overskudsgrad og omsætningshastighed, vurdering mod markedsrenten.'],
  ['35–50', 'Indtjeningsevne og kapitaltilpasning: lad grupperne skrive hver sin trappe for et nøgletal eller en nøgletalsgruppe. Stil spørgsmålene under faldgruberne.'],
  ['50–65', 'Soliditet og likviditet: tommelfingerreglerne – og hvornår forretningsmodellen er den bedre målestok.'],
  ['65–85', 'Trin 4 i grupper: holder forretningsmodellen? Én anbefaling pr. gruppe, der følger af tallene.'],
  ['85–90', 'Opsamling: hvilke faldgruber ramte vi, og hvilket trin var sværest?']
]

/** Trin 5: underviservejledningen til gennemgangen med holdet. */
export default function VejledningTrin ({ analyse: a, prosa, hentWord, travl }) {
  const k = a.konklusion
  return (
    <>
      <h2 className="sektion-titel">Underviservejledning – {a.navn}</h2>
      <p className="sektion-intro">
        Til gennemgangen af analysen med holdet: hvad de skal finde, hvor netop dette regnskab inviterer til de typiske
        fejl, og hvilke spørgsmål der hjælper dem videre op ad trappen.
      </p>
      <div className="knap-raekke">
        <button className="knap primaer" disabled={!!travl} onClick={() => hentWord('vejledning')}>
          {travl === 'vejledning' ? 'Danner …' : 'Hent underviservejledning (Word)'}
        </button>
      </div>

      <section className="kort">
        <h3>Det store billede</h3>
        <p>{prosa.konklusion?.fortaelling || k.udkast[0]}</p>
        <div className="to-spalter">
          <div><h4>Styrker</h4><ul>{k.styrker.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          <div><h4>Svagheder</h4><ul>{k.svagheder.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        </div>
      </section>

      <section className="kort">
        <h3>Forslag til forløb (90 minutter)</h3>
        <table className="data">
          <tbody>{FORLOEB.map(([t, x]) => <tr key={t}><td className="num" style={{ width: 70 }}>{t}</td><td>{x}</td></tr>)}</tbody>
        </table>
      </section>

      {OMRAADER.map(o => {
        const om = a.omraader[o.id]
        if (om.ikkeRelevant) return null
        return (
          <section className="kort" key={o.id}>
            <h3>{om.navn}</h3>
            {om.grupper.map(g => {
              const fg = a.faldgruber.filter(f => f.gruppe === g.id)
              return (
                <div key={g.id} className="noegletal-trappe">
                  <h4>{g.titel}</h4>
                  <p className="hjaelp"><strong>Det skal de finde:</strong> {g.noegle.join(' · ')}</p>
                  {g.delkonklusion && <p><strong>Delkonklusion:</strong> {prosa.grupper?.[g.id]?.delkonklusion || g.delkonklusion}</p>}
                  <details>
                    <summary>Forklaring og målestok (trin 2 og 3)</summary>
                    <ul>{[...g.trin2, ...g.trin3].map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </details>
                  {fg.map((f, i) => <Faldgrube key={i} f={f} />)}
                </div>
              )
            })}
          </section>
        )
      })}

      <section className="kort">
        <h3>Trin 4 – forretningsmodellen</h3>
        {a.profil && <p><strong>Typisk {a.profil.navn.toLowerCase()}:</strong> {a.profil.kendetegn}</p>}
        {k.afvigelser.length > 0 && <><h4>Afvigelser fra profilen</h4><ul>{k.afvigelser.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
        {k.anbefalinger.length > 0 && <><h4>Anbefalinger, der følger af tallene</h4><ul>{k.anbefalinger.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
        {a.faldgruber.filter(f => f.gruppe === 'konklusion').map((f, i) => <Faldgrube key={i} f={f} />)}
      </section>

      <section className="kort">
        <h3>Tjekliste: hvornår er et trin nået?</h3>
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

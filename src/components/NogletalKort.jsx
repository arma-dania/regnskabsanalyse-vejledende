import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid
} from 'recharts'
import { formatVaerdi } from '../lib/nogletal.js'

const PETROL = '#1f5c6e'
const OKKER = '#9a6a16'
const NED = '#9c3a2b'

export default function NogletalKort ({ nogletal: n, resultater, aarNavne, enhed }) {
  const [visForklaring, setVisForklaring] = useState(false)

  const data = resultater.map((r, i) => ({
    aar: aarNavne[i],
    vaerdi: r[n.nr].value == null || !Number.isFinite(r[n.nr].value) ? null : Math.round(r[n.nr].value * 100) / 100
  }))

  const gyldige = data.filter(d => d.vaerdi != null)
  const foerste = gyldige[0]?.vaerdi
  const sidste = gyldige[gyldige.length - 1]?.vaerdi
  const aendring = foerste != null && sidste != null && gyldige.length > 1 ? sidste - foerste : null
  const retning = aendring == null || Math.abs(aendring) < 0.05
    ? 'neutral'
    : ((aendring > 0) === (n.bedre !== 'ned') ? 'op' : 'ned')

  const harTal = gyldige.length > 0

  return (
    <article className="nt-kort">
      <div className="nt-hoved">
        <span className="nt-nr">{n.visNr ?? n.nr}</span>
        <div style={{ minWidth: 0 }}>
          <div className="nt-navn">{n.navn}</div>
        </div>
        <div className="nt-vaerdi">
          <div className="stor">{formatVaerdi(n, resultater[resultater.length - 1][n.nr].value, enhed)}</div>
          {aendring != null && (
            <div className={'aendring ' + (n.bedre === 'neutral' ? 'neutral' : retning)}>
              {aendring > 0 ? '+' : ''}{new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(aendring)} over perioden
            </div>
          )}
        </div>
      </div>

      <div className="nt-graf" data-graf-nr={n.nr}>
        {harTal
          ? (
            <ResponsiveContainer width="100%" height={96}>
              <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e8ebe7" vertical={false} />
                <XAxis dataKey="aar" tick={{ fontSize: 10, fill: '#5f6b72' }} axisLine={{ stroke: '#d7ddd7' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#5f6b72' }} axisLine={false} tickLine={false} width={38} />
                <Tooltip
                  formatter={v => formatVaerdi(n, v, enhed)}
                  contentStyle={{ fontSize: 12, borderRadius: 3, border: '1px solid #d7ddd7' }}
                />
                <ReferenceLine y={0} stroke="#14202e" />
                {n.enhed === '%' && n.nr === 23 && <ReferenceLine y={100} stroke={OKKER} strokeDasharray="4 3" />}
                <Line
                  type="monotone" dataKey="vaerdi" stroke={PETROL} strokeWidth={2}
                  isAnimationActive={false} connectNulls activeDot={{ r: 5 }}
                  dot={({ cx, cy, index, payload }) => {
                    if (payload.vaerdi == null) return null
                    const sidste = index === data.length - 1
                    const farve = payload.vaerdi < 0 ? NED : (sidste ? PETROL : '#9db6bc')
                    return <circle key={index} cx={cx} cy={cy} r={sidste ? 4 : 3} fill={farve} stroke="#fff" strokeWidth={1} />
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
            )
          : (
            <p className="forklaring" style={{ padding: '22px 0' }}>
              {n.ikkeBeregnet || resultater.find(r => r[n.nr]?.grund)?.[n.nr].grund || <>Kan ikke beregnes med de indtastede tal. {manglerTekst(n)}</>}
            </p>
            )}
      </div>

      {visForklaring && <p className="forklaring">{n.forklaring}</p>}

      <div className="nt-fod">
        <button onClick={() => setVisForklaring(v => !v)}>{visForklaring ? 'Skjul forklaring' : 'Hvad viser tallet?'}</button>
      </div>
    </article>
  )
}

function manglerTekst (n) {
  if (n.omraade === 'boers') return 'Udfyld antal aktier og børskurs under "Pengestrøm og aktieoplysninger".'
  if (n.nr === 19) return 'Udfyld pengestrøm fra primær drift.'
  return 'Tjek at både tæller og nævner er udfyldt i analyseformen.'
}

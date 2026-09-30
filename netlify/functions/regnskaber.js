// Slår offentliggjorte årsrapporter op på CVR-nummer i Erhvervsstyrelsens
// distributionsindeks og returnerer dokumentadresserne. Så slipper man for selv
// at finde det rigtige link — og for at gætte på, hvad der er en dokumentadresse,
// og hvad der bare er en visningsside.
//
// Kræver indekset legitimation, sættes VIRK_BRUGER og VIRK_KODE som
// miljøvariabler i Netlify.
const INDEKS = 'http://distribution.virk.dk/offentliggoerelser/_search'

export default async (request) => {
  const cvr = (new URL(request.url).searchParams.get('cvr') || '').replace(/\D/g, '')
  if (cvr.length !== 8) return svar({ fejl: 'Angiv et CVR-nummer på otte cifre.' }, 400)

  const forespoergsel = {
    size: 30,
    query: { bool: { must: [{ term: { cvrNummer: Number(cvr) } }] } },
    sort: [{ offentliggoerelsesTidspunkt: 'desc' }]
  }

  const headers = { 'Content-Type': 'application/json' }
  if (process.env.VIRK_BRUGER && process.env.VIRK_KODE) {
    headers.Authorization = 'Basic ' + Buffer.from(`${process.env.VIRK_BRUGER}:${process.env.VIRK_KODE}`).toString('base64')
  }

  try {
    const r = await fetch(INDEKS, { method: 'POST', headers, body: JSON.stringify(forespoergsel) })
    if (!r.ok) {
      const uddrag = (await r.text()).slice(0, 300)
      return svar({
        fejl: `Distributionsindekset svarede ${r.status}.` +
          (r.status === 401 || r.status === 403
            ? ' Indekset kræver legitimation. Skriv til Erhvervsstyrelsen på 35 29 10 00 og sæt VIRK_BRUGER og VIRK_KODE i Netlify.'
            : ''),
        teknisk: uddrag
      }, 502)
    }

    const data = await r.json()
    const traef = (data?.hits?.hits || []).map(h => h._source).filter(Boolean)

    const regnskaber = traef
      // Kun regnskaber — distributionsindekset rummer også andre
      // offentliggørelsestyper (fx vedtægtsændringer), som ikke har en
      // regnskabsperiode og alligevel ville blive filtreret fra nedenfor,
      // men det er billigt at være eksplicit.
      .filter(s => s.offentliggoerelsestype === 'regnskab')
      .map(s => {
        const periode = s.regnskab?.regnskabsperiode || {}
        const dok = (s.dokumenter || []).map(d => ({
          url: d.dokumentUrl,
          type: d.dokumentType,
          mime: d.dokumentMimeType
        }))
        const varighedDage = periode.startDato && periode.slutDato
          ? Math.round((new Date(periode.slutDato) - new Date(periode.startDato)) / 86400000)
          : null
        // Store/børsnoterede selskaber indsender ofte flere separate
        // XBRL-instanser under samme offentliggørelse — fx én med
        // stamdata/revisionspåtegning og én med selve regnskabstallene.
        // Alle XML-dokumenter hentes derfor med, ikke kun det første, så
        // ingen af dem overses ved indlæsning.
        const xbrlDok = dok.filter(d => /xml|xbrl/i.test(d.mime || '') || /\.xml$/i.test(d.url || ''))
        return {
          offentliggjort: s.offentliggoerelsesTidspunkt,
          start: periode.startDato,
          slut: periode.slutDato,
          aar: periode.slutDato ? String(periode.slutDato).slice(0, 4) : null,
          type: s.offentliggoerelsestype,
          varighedDage,
          xbrl: xbrlDok[0]?.url || null,
          xbrlAlle: xbrlDok.map(d => d.url),
          pdf: dok.find(d => /pdf/i.test(d.mime || ''))?.url || null,
          dokumenter: dok
        }
      })
      // Kvartals- og halvårsregnskaber (kort regnskabsperiode) udelukkes —
      // kun regnskaber, der dækker (tæt på) et helt år, skal vises. Et
      // forlænget første regnskabsår kan vare op til 18 måneder, så der
      // filtreres kun på for kort periode, ikke for lang.
      .filter(r2 => r2.varighedDage == null || r2.varighedDage >= 300)

    // Kun ét regnskab pr. regnskabsår — det senest offentliggjorte vinder,
    // så en omgørelse ikke ligger side om side med den oprindelige rapport.
    const perAar = new Map()
    regnskaber.forEach(r2 => {
      if (!r2.aar) return
      if (!perAar.has(r2.aar)) perAar.set(r2.aar, r2)
    })
    const seneste = [...perAar.values()].sort((a, b) => Number(b.aar) - Number(a.aar))

    return svar({ cvr, antal: seneste.length, regnskaber: seneste }, 200)
  } catch (e) {
    return svar({ fejl: 'Opslaget mislykkedes: ' + e.message }, 502)
  }
}

function svar (objekt, status) {
  return new Response(JSON.stringify(objekt), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  })
}

export const config = { path: '/.netlify/functions/regnskaber' }

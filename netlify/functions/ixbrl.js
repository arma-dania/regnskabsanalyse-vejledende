// Henter og tolker iXBRL- og XBRL-dokumenter på serveren.
// Browseren må ikke hente dem direkte, fordi Virk ikke sender CORS-headere.
//
// Store selskabers årsrapporter (fx børsnoterede selskaber) kan være adskillige
// MB store. Derfor sker både hentning og selve talgenkendelsen her på serveren,
// og kun det tolkede resultat — nogle få kolonner med tal — sendes til browseren.
// Det undgår både at skulle sende hele dokumentet til browseren (som har sine
// egne grænser for, hvor meget en enkelt browserside kan hente) og at bruge
// unødig tid på at transportere data, der alligevel bliver kasseret efter
// tolkningen.
//
// Selve svaret sendes som en "streaming"-funktion (kroppen er en ReadableStream),
// hvilket Netlify giver et udvidet tidsbudget på 60 sekunder i stedet for en
// almindelig funktions ca. 10 sekunder — nødvendigt, fordi hentningen af et
// stort dokument fra en offentlig myndigheds server kan tage længere end det.
//
// Virks WAF afviser kald uden browserlignende headere med 403. Derfor sendes
// en almindelig browser-User-Agent, og ved afvisning prøves et par varianter,
// før der gives op.
import { DOMParser } from 'linkedom'
import { parseXbrlDokument } from '../../src/lib/ixbrlImport.js'

const TILLADTE_VAERTER = [
  'regnskaber.virk.dk',
  'datacvr.virk.dk',
  'distribution.virk.dk',
  'erst.dk',
  'virk.dk'
]

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/xhtml+xml,text/html,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
  Referer: 'https://datacvr.virk.dk/',
  'Upgrade-Insecure-Requests': '1'
}

export default async (request) => {
  const params = new URL(request.url).searchParams
  const url = params.get('url')
  const debug = params.get('debug') === '1'
  if (!url) return jsonsvar({ fejl: 'Angiv en adresse i url-parameteren.' }, 400)

  let maal
  try { maal = new URL(url.trim()) } catch { return jsonsvar({ fejl: 'Adressen kan ikke læses.' }, 400) }
  if (!['http:', 'https:'].includes(maal.protocol)) return jsonsvar({ fejl: 'Kun http og https er tilladt.' }, 400)

  const frit = process.env.TILLAD_ALLE_VAERTER === 'true'
  const kendt = TILLADTE_VAERTER.some(v => maal.hostname === v || maal.hostname.endsWith('.' + v))
  if (!frit && !kendt) {
    return jsonsvar({ fejl: `Værten ${maal.hostname} er ikke på listen. Tilføj den i netlify/functions/ixbrl.js, eller sæt TILLAD_ALLE_VAERTER=true.` }, 403)
  }

  // datacvr.virk.dk/gateway/… er ikke en dokumentadresse, men et internt API,
  // der kun svarer inde fra en rigtig browsersession på datacvr.virk.dk (med
  // cookies og session-token). Det kan aldrig besvares fra en serverfunktion,
  // uanset hvilke headere der sendes, så det er meningsløst at prøve.
  if (maal.hostname.endsWith('virk.dk') && maal.pathname.includes('/gateway/')) {
    return jsonsvar({
      fejl: 'Denne adresse er et gateway-kald (datacvr.virk.dk/gateway/…), som kun virker inde fra en ' +
        'browsersession på Virks egen side — det kan ikke hentes gennem en serverfunktion. ' +
        'Brug "Find årsrapporter" med CVR-nummeret i stedet; den finder de direkte dokumentadresser ' +
        '(regnskaber.virk.dk/<cvr>/<fil>.xml), som proxyen kan hente.'
    }, 400)
  }

  // Dokumenterne på regnskaber.virk.dk udstilles over http. Nogle netværk
  // afviser det, andre afviser https — derfor prøves begge.
  const forsoeg = [maal.href]
  if (maal.protocol === 'https:') forsoeg.push(maal.href.replace(/^https:/, 'http:'))
  else forsoeg.push(maal.href.replace(/^http:/, 'https:'))

  // Fra her af sendes svarets hoved, før hentningen er færdig (det er selve
  // pointen med streaming — det er det, der giver det udvidede tidsbudget).
  // HTTP-statussen kan derfor ikke ændres undervejs, uanset om hentningen
  // lykkes: fejl signaleres altid som status 200 med et {fejl: "…"}-felt
  // (debug=1: almindelig tekst) i selve svaret i stedet.
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start (controller) {
      const send = tekst => { controller.enqueue(enc.encode(tekst)); controller.close() }
      const log = []
      for (const adresse of forsoeg) {
        try {
          const r = await fetch(adresse, { headers: BROWSER_HEADERS, redirect: 'follow' })
          const type = r.headers.get('content-type') || ''
          if (r.ok) {
            const tekst = await r.text()
            if (debug) {
              // content-length viser, hvad Virk selv hævder at sende — er den langt
              // større end tekst.length, er svaret skåret af undervejs; matcher den,
              // sender Virk selv et kortere svar, end det rigtige dokument er. Halen
              // (de sidste tegn af det modtagne) viser, om afskæringen sker midt i en
              // tag/attribut (tyder på en afbrudt overførsel) eller ser velformet ud
              // (tyder på, at Virk selv afslutter svaret der).
              const contentLength = r.headers.get('content-length') || '(ikke angivet)'
              return send(
                `OK ${r.status} · ${type} · content-length: ${contentLength} · ${tekst.length} tegn modtaget\n\n` +
                `--- FØRSTE 800 TEGN ---\n${tekst.slice(0, 800)}\n\n` +
                `--- SIDSTE 800 TEGN ---\n${tekst.slice(-800)}`
              )
            }
            if (/text\/html/i.test(type) && !/<ix:|xmlns:ix=/i.test(tekst.slice(0, 4000))) {
              return send(JSON.stringify({
                fejl: 'Adressen gav en almindelig webside uden XBRL-opmærkning. Det er sandsynligvis ' +
                  'en visningsside og ikke selve dokumentet. Find dokumentlinket, der ender på .xml eller .xhtml.'
              }))
            }
            try {
              const resultat = parseXbrlDokument(tekst, url, DOMParser)
              return send(JSON.stringify(resultat))
            } catch (e) {
              return send(JSON.stringify({ fejl: 'Dokumentet kunne ikke tolkes: ' + e.message }))
            }
          }
          const uddrag = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
          log.push(`${adresse} → ${r.status} ${type} ${uddrag}`)
        } catch (e) {
          log.push(`${adresse} → ${e.message}`)
        }
      }
      send(debug ? forklarFejl(log) : JSON.stringify({ fejl: forklarFejl(log) }))
    }
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': debug ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

function forklarFejl (log) {
  const detaljer = log.join('\n')
  if (/403/.test(detaljer)) {
    return 'Virk afviste kaldet (403). Det sker typisk af to grunde:\n' +
      '1) Adressen peger på en visningsside i stedet for selve dokumentet. ' +
      'Dokumentadresser ser sådan ud: http://regnskaber.virk.dk/12345678/<lang-kode>.xml\n' +
      '2) Adressen er tidsbegrænset eller kræver et opslag først. Prøv at søge ' +
      'regnskabet frem på CVR-nummer i stedet.\n\nTeknisk:\n' + detaljer
  }
  if (/404/.test(detaljer)) return 'Dokumentet findes ikke på adressen (404).\n\nTeknisk:\n' + detaljer
  return 'Dokumentet kunne ikke hentes.\n\nTeknisk:\n' + detaljer
}

function jsonsvar (objekt, status) {
  return new Response(JSON.stringify(objekt), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  })
}

export const config = { path: '/.netlify/functions/ixbrl' }

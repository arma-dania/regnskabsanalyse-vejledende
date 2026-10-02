// Forbindelsen til serverfunktionen, der lader Claude formulere teksten.

import { OMRAADER } from "./beregning.js";

const KODENOEGLE = "rv-adgangskode";
export const hentKode = () => { try { return sessionStorage.getItem(KODENOEGLE) || ""; } catch { return ""; } };
export const gemKode = k => { try { sessionStorage.setItem(KODENOEGLE, k); } catch { /* privat vindue */ } };

async function kald(del, data, kode) {
  const svar = await fetch("/.netlify/functions/skriv", {
    method: "POST",
    headers: { "content-type": "application/json", "x-adgangskode": kode },
    body: JSON.stringify({ del, data }),
  });
  const tekst = await svar.text();
  let krop = null;
  try { krop = JSON.parse(tekst); } catch { /* ikke JSON */ }
  if (!svar.ok) throw new Error(krop?.fejl || fejlUdenFunktion(svar.status, tekst));
  return krop;
}

/** Svaret kom ikke fra serverfunktionen – forklar, hvor det så kom fra. */
function fejlUdenFunktion(status, tekst) {
  if (status === 504 || status === 502 && /timeout/i.test(tekst || ""))
    return "Claude nåede ikke at svare inden for Netlifys tidsgrænse. Prøv igen – teksten skrives i mindre bidder, så det plejer at lykkes anden gang.";
  if (status === 404) return "Serverfunktionen findes ikke her. Kør appen med 'netlify dev' eller på Netlify.";
  if (status === 401 || status === 403)
    return `Netlify afviste kaldet (${status}), før det nåede serverfunktionen – adgangskoden er ikke prøvet endnu. ` +
      "Det skyldes som regel adgangsbeskyttelse på sitet eller på forhåndsvisningen (Netlify: Site configuration → Access & security → Visitor access / Deploy Preview protection). " +
      "Brug sitets almindelige adresse, eller slå beskyttelsen fra for serverfunktionen.";
  const uddrag = String(tekst || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return `Serveren svarede ${status}${uddrag ? `: ${uddrag}` : "."}`;
}

export const tjekKode = kode => kald("tjek", {}, kode);

const tabelTekst = (a, o, nrs) => o.tabel.filter(r => nrs.includes(r.nr))
  .map(r => `${r.nr}. ${r.navn}: ${a.aar.map((y, i) => `${y} ${r.tekst[i]}`).join(", ")}`).join("\n");

/** Alle nøgletal og grupper i den rækkefølge, de skrives: [{ omraade, gruppe }]. */
export const alleGrupper = a => OMRAADER.flatMap(o => a.omraader[o.id].grupper.map(g => ({ omraade: o.id, gruppe: g })));

export function skrivGruppe(a, oid, g, kode) {
  const o = a.omraader[oid];
  return kald("gruppe", {
    virksomhed: a.navn,
    brutto: !!a.brutto,
    omraade: o.navn,
    titel: g.titel,
    tabel: tabelTekst(a, o, g.nrs),
    trin1: g.trin1.join("\n"),
    trin2: g.trin2.join("\n"),
    trin3: g.trin3.join("\n"),
    beretning: (g.beretning || []).join("\n"),
  }, kode);
}

/** Delkonklusionen for et analyseområde, bygget på trapperne i området. */
export function skrivOmraade(a, oid, prosa, kode) {
  const o = a.omraader[oid];
  return kald("omraade", {
    virksomhed: a.navn,
    brutto: !!a.brutto,
    omraade: o.navn,
    indledning: o.indledning || "",
    tabel: tabelTekst(a, o, o.tabel.map(r => r.nr)),
    trapper: o.grupper.map(g => {
      const x = prosa.grupper?.[g.id];
      return `${g.titel}:\n` + [1, 2, 3].map(nr => `Trin ${nr}: ${x?.[`trin${nr}`] || g[`trin${nr}`].join(" ")}`).join("\n");
    }).join("\n\n"),
    delkonklusion: o.delkonklusion,
  }, kode);
}

/** Den samlede konklusion og trin 4 – i to kald, så hvert når svar i tide. */
export async function skrivKonklusion(a, prosa, kode) {
  const k = a.konklusion;
  const { samlet } = await kald("samlet", {
    virksomhed: a.navn,
    brutto: !!a.brutto,
    omraader: OMRAADER.filter(o => !a.omraader[o.id].ikkeRelevant).map(o => {
      const om = a.omraader[o.id];
      return `${om.navn} – delkonklusion: ${prosa.omraader?.[o.id]?.delkonklusion || om.delkonklusion}`;
    }).join("\n\n"),
    styrker: k.styrker.join("\n"),
    svagheder: k.svagheder.join("\n"),
    samlet: k.samlet.join("\n"),
    beretning: a.brugCitater ? a.beretning || "" : "",
  }, kode);
  const { trin4 } = await kald("trin4", {
    virksomhed: a.navn,
    brutto: !!a.brutto,
    forretningsmodel: a.forretningsmodel,
    profil: a.profil ? `${a.profil.navn}: ${a.profil.kendetegn}` : "",
    samlet,
    styrker: k.styrker.join("\n"),
    svagheder: k.svagheder.join("\n"),
    anbefalinger: k.anbefalinger.join("\n"),
    afvigelser: k.afvigelser.join("\n"),
    udkast: k.udkast.join(" "),
  }, kode);
  return { samlet, trin4 };
}

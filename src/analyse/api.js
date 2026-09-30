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
  let krop = null;
  try { krop = await svar.json(); } catch { /* ikke JSON */ }
  if (!svar.ok) throw new Error(krop?.fejl || (svar.status === 404 ? "Serverfunktionen findes ikke her. Kør appen med 'netlify dev' eller på Netlify." : `Serveren svarede ${svar.status}.`));
  return krop;
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

export function skrivKonklusion(a, prosa, kode) {
  const k = a.konklusion;
  return kald("konklusion", {
    virksomhed: a.navn,
    forretningsmodel: a.forretningsmodel,
    profil: a.profil ? `${a.profil.navn}: ${a.profil.kendetegn}` : "",
    omraader: OMRAADER.filter(o => !a.omraader[o.id].ikkeRelevant).map(o => {
      const om = a.omraader[o.id];
      return `${om.navn} – delkonklusion: ${prosa.omraader?.[o.id]?.delkonklusion || om.delkonklusion}`;
    }).join("\n\n"),
    styrker: k.styrker.join("\n"),
    svagheder: k.svagheder.join("\n"),
    anbefalinger: k.anbefalinger.join("\n"),
    afvigelser: k.afvigelser.join("\n"),
    udkast: k.udkast.join(" "),
    beretning: a.brugCitater ? a.beretning || "" : "",
  }, kode);
}

// Forbindelsen til serverfunktionen, der lader Claude formulere teksten.

import { OMRAADER } from "./lib/nogletal.js";

const KODENOEGLE = "rv-adgangskode";
export const hentKode = () => { try { return sessionStorage.getItem(KODENOEGLE) || ""; } catch { return ""; } };
export const gemKode = k => { try { sessionStorage.setItem(KODENOEGLE, k); } catch { /* privat vindue */ } };

async function kald(del, data, kode) {
  const svar = await fetch("/api/skriv", {
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

const tabelTekst = (a, o) => o.tabel.map(r => `${r.nr}. ${r.navn}: ${a.aar.map((y, i) => `${y} ${r.tekst[i]}`).join(", ")}`).join("\n");

export function skrivOmraade(a, id, kode) {
  const o = a.omraader[id];
  return kald("omraade", {
    virksomhed: a.navn,
    omraade: o.navn,
    tabel: tabelTekst(a, o),
    trin1: o.trin1.join("\n"),
    trin2: o.trin2.join("\n"),
    trin3: o.trin3.join("\n"),
  }, kode);
}

export function skrivKonklusion(a, prosa, kode) {
  const k = a.konklusion;
  return kald("konklusion", {
    virksomhed: a.navn,
    forretningsmodel: a.forretningsmodel,
    profil: a.profil ? `${a.profil.navn}: ${a.profil.kendetegn}` : "",
    omraader: OMRAADER.filter(o => !a.omraader[o.id].ikkeRelevant).map(o => {
      const x = prosa[o.id];
      const om = a.omraader[o.id];
      return `${om.navn}:\n` + [1, 2, 3].map(n => x?.[`trin${n}`] || om[`trin${n}`].join(" ")).join("\n");
    }).join("\n\n"),
    styrker: k.styrker.join("\n"),
    svagheder: k.svagheder.join("\n"),
    anbefalinger: k.anbefalinger.join("\n"),
    afvigelser: k.afvigelser.join("\n"),
    udkast: k.udkast.join(" "),
  }, kode);
}

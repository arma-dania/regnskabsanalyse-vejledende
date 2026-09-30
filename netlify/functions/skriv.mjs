// POST /.netlify/functions/skriv – lader Claude formulere motorens fund som prosa.
//
// Kun du bruger appen, så adgangen er én kode i miljøvariablen ADGANGSKODE.
// Uden den kan enhver med adressen bruge din API-nøgle.

import { createHash, timingSafeEqual } from "node:crypto";
import { spoergJson, Opsaetningsfejl, ClaudeFejl } from "./lib/claude.mjs";
import { gruppePrompt, GRUPPESKEMA, omraadePrompt, OMRAADESKEMA, konklusionPrompt, KONKLUSIONSKEMA } from "./lib/prompter.mjs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const hash = s => createHash("sha256").update(String(s)).digest();

export function kodeOk(givet, rigtig = process.env.ADGANGSKODE) {
  if (!rigtig) throw new Opsaetningsfejl("ADGANGSKODE er ikke sat i Netlify (Environment variables). Sæt den, og deploy igen.");
  return timingSafeEqual(hash(givet ?? ""), hash(rigtig));
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ fejl: "Kun POST." }, 405);
  let krop;
  try {
    krop = await req.json();
  } catch {
    return json({ fejl: "Ugyldig forespørgsel." }, 400);
  }
  try {
    if (!kodeOk(req.headers.get("x-adgangskode"))) return json({ fejl: "Forkert adgangskode." }, 401);
    if (krop?.del === "tjek") return json({ ok: true });
    if (krop?.del === "gruppe") return json(await spoergJson(gruppePrompt(krop.data ?? {}), GRUPPESKEMA, { maxTokens: 4000 }));
    if (krop?.del === "omraade") return json(await spoergJson(omraadePrompt(krop.data ?? {}), OMRAADESKEMA, { maxTokens: 2000 }));
    if (krop?.del === "konklusion") return json(await spoergJson(konklusionPrompt(krop.data ?? {}), KONKLUSIONSKEMA));
    return json({ fejl: "Ukendt del." }, 400);
  } catch (e) {
    if (e instanceof Opsaetningsfejl) return json({ fejl: e.message }, 500);
    if (e instanceof ClaudeFejl) return json({ fejl: e.message }, 502);
    console.error("Uventet fejl", e);
    return json({ fejl: "Der gik noget galt på serveren. Prøv igen." }, 500);
  }
}


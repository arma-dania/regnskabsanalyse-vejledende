// Kaldet til Claude. Ét sted, så model, effort og fejlhåndtering kun skal
// ændres her.

import Anthropic from "@anthropic-ai/sdk";

// Opus 5.5, fordi det er fagligt ræsonnement og sprog på dansk. Effort "low",
// fordi kaldet er synkront og en Netlify-funktion har en tidsgrænse: Claude
// skal ikke regne eller analysere – det har motoren gjort – kun formulere.
const MODEL = "claude-opus-5-5";
const EFFORT = "low";

// Under Netlifys egen grænse, så du får en forståelig besked i stedet for 502.
const TIDSGRAENSE_MS = 24_000;

export class Opsaetningsfejl extends Error {}
export class ClaudeFejl extends Error {}

let klient = null;
function hentKlient() {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new Opsaetningsfejl("ANTHROPIC_API_KEY er ikke sat i Netlify (Environment variables). Tjek at dens scope omfatter Functions, og deploy igen.");
  klient ??= new Anthropic({ timeout: TIDSGRAENSE_MS, maxRetries: 1 });
  return klient;
}

/**
 * Sender prompten og returnerer svaret som JSON efter det givne skema.
 * Structured outputs sikrer, at svaret kan læses uden at gætte på formatet.
 */
export async function spoergJson(prompt, skema, { maxTokens = 8000 } = {}) {
  let svar;
  try {
    svar = await hentKlient().beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      output_config: { effort: EFFORT, format: { type: "json_schema", schema: skema } },
      // Afviser modellens sikkerhedsfiltre kaldet, kører Anthropic det om på
      // den anbefalede model. Usandsynligt ved regnskabsanalyse, men gratis.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: prompt }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      throw new Opsaetningsfejl("ANTHROPIC_API_KEY afvises af Anthropic. Tjek nøglen i Netlify, og deploy igen.");
    if (e instanceof Anthropic.RateLimitError) throw new ClaudeFejl("Der er travlt lige nu. Vent et øjeblik, og prøv igen.");
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ClaudeFejl("Det tog for lang tid at få svar. Prøv igen, eller brug motorens tekst.");
    if (e instanceof Anthropic.APIError) {
      console.error("Anthropic svarede", e.status, e.message);
      throw new ClaudeFejl("Kunne ikke få svar lige nu. Prøv igen om lidt.");
    }
    throw e;
  }
  if (svar.stop_reason === "refusal") throw new ClaudeFejl("Claude afviste at skrive teksten. Brug motorens tekst.");
  if (svar.stop_reason === "max_tokens") throw new ClaudeFejl("Svaret blev for langt og blev skåret af. Prøv igen.");
  const tekst = svar.content.filter(b => b.type === "text").map(b => b.text).join("");
  try {
    return JSON.parse(tekst);
  } catch {
    throw new ClaudeFejl("Svaret kunne ikke læses. Prøv igen.");
  }
}

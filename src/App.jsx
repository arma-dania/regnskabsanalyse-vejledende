import React, { useEffect, useMemo, useState } from "react";
import { POSTER, AFSNIT, medAfledte, balanceKontrol, laesIndsat } from "./lib/poster.js";
import { OMRAADER, ENHEDER, NT, formatNt, fmtPct, fmtPp, fmtX, fmtBeloeb } from "./lib/nogletal.js";
import { PROFILER, PROFILNOEGLE, TOMMELFINGERREGLER, MARKEDSRENTE_FORSLAG, MARKEDSRENTE_NAVN, findProfil, modProfil } from "./lib/maalestok.js";
import { TRIN } from "./lib/temaer.js";
import { analyser } from "./lib/analyse.js";
import { talIAnalysen, tjekTal } from "./lib/tjek.js";
import { EKSEMPEL, tomCase } from "./lib/eksempel.js";
import { hentKode, gemKode, tjekKode, skrivOmraade, skrivKonklusion } from "./api.js";

const LAGER = "rv-case-v1";
const PROSALAGER = "rv-prosa-v1";
const laes = (k, std) => { try { const x = localStorage.getItem(k); return x ? JSON.parse(x) : std; } catch { return std; } };
const skriv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fuld eller privat */ } };

const FANER = [
  { id: "regnskab", navn: "1 Regnskab" },
  { id: "maalestok", navn: "2 Målestokke" },
  { id: "analyse", navn: "3 Vejledende besvarelse" },
  { id: "vejledning", navn: "4 Underviservejledning" },
];

export default function App() {
  const [kase, setKase] = useState(() => laes(LAGER, EKSEMPEL));
  const [prosa, setProsa] = useState(() => laes(PROSALAGER, {}));
  const [fane, setFane] = useState("regnskab");

  useEffect(() => skriv(LAGER, kase), [kase]);
  useEffect(() => skriv(PROSALAGER, prosa), [prosa]);

  const analyse = useMemo(() => {
    try { return analyser(kase); } catch (e) { console.error(e); return null; }
  }, [kase]);

  // Ændres tallene, passer Claudes tekst ikke længere – den markeres som forældet.
  const fingeraftryk = useMemo(() => JSON.stringify(kase), [kase]);
  const prosaForaeldet = prosa._fingeraftryk && prosa._fingeraftryk !== fingeraftryk;

  return (
    <div className="side">
      <header className="top">
        <div>
          <h1>Regnskabsanalyse – vejledende besvarelse</h1>
          <p className="under">Nøgletal, DuPont og EKF-formlen skrevet op ad formuleringstrappen – med en underviservejledning til gennemgangen.</p>
        </div>
        <Hent analyse={analyse} prosa={prosaForaeldet ? {} : prosa} />
      </header>
      <nav className="faner">
        {FANER.map(f => (
          <button key={f.id} className={fane === f.id ? "aktiv" : ""} onClick={() => setFane(f.id)}>{f.navn}</button>
        ))}
      </nav>
      <main>
        {fane === "regnskab" && <RegnskabView kase={kase} setKase={setKase} />}
        {fane === "maalestok" && <MaalestokView kase={kase} setKase={setKase} analyse={analyse} />}
        {fane === "analyse" && analyse && (
          <AnalyseView analyse={analyse} prosa={prosa} setProsa={setProsa} fingeraftryk={fingeraftryk} foraeldet={prosaForaeldet} />
        )}
        {fane === "vejledning" && analyse && <VejledningView analyse={analyse} prosa={prosaForaeldet ? {} : prosa} />}
      </main>
      <footer>Tallene gemmes kun i denne browser. Brug "Gem som fil" for at tage en case med.</footer>
    </div>
  );
}

/* ====================== Hent Word ====================== */

function Hent({ analyse, prosa }) {
  const [travl, setTravl] = useState("");
  async function hent(hvad) {
    if (!analyse) return;
    setTravl(hvad);
    try {
      // Word-biblioteket er stort, så det hentes først, når der trykkes.
      const { besvarelseDocx, vejledningDocx } = await import("./lib/word.js");
      const blob = hvad === "besvarelse" ? await besvarelseDocx(analyse, prosa) : await vejledningDocx(analyse, prosa);
      const navn = `${hvad === "besvarelse" ? "Vejledende besvarelse" : "Underviservejledning"} – ${analyse.navn.replace(/[\\/:*?"<>|]/g, "")}.docx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = navn;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally { setTravl(""); }
  }
  return (
    <div className="hent">
      <button disabled={!!travl} onClick={() => hent("besvarelse")}>{travl === "besvarelse" ? "Laver Word …" : "Vejledende besvarelse (Word)"}</button>
      <button disabled={!!travl} onClick={() => hent("vejledning")}>{travl === "vejledning" ? "Laver Word …" : "Underviservejledning (Word)"}</button>
    </div>
  );
}

/* ====================== 1 Regnskab ====================== */

function RegnskabView({ kase, setKase }) {
  const [indsaet, setIndsaet] = useState(false);
  const saetFelt = (i, key, raa) => setKase(k => {
    const kolonner = k.kolonner.map((c, j) => (j === i ? { ...c, v: { ...c.v, [key]: raa === "" ? null : raa } } : c));
    return { ...k, kolonner };
  });
  const saetAar = (i, aar) => setKase(k => ({ ...k, kolonner: k.kolonner.map((c, j) => (j === i ? { ...c, aar } : c)) }));
  const afledte = kase.kolonner.map(c => medAfledte(c.v));

  function gemFil() {
    const blob = new Blob([JSON.stringify(kase, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(kase.navn || "case").replace(/[\\/:*?"<>|]/g, "")}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function aabnFil(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(t => {
      try {
        const k = JSON.parse(t);
        if (!Array.isArray(k.kolonner) || k.kolonner.length !== 4) throw new Error();
        setKase({ ...tomCase(), ...k });
      } catch { alert("Filen kunne ikke læses som en case."); }
    });
    e.target.value = "";
  }

  return (
    <section>
      <div className="kort">
        <div className="raekke">
          <label>Virksomhed <input value={kase.navn} onChange={e => setKase({ ...kase, navn: e.target.value })} placeholder="Navn" /></label>
          <label>Beløb i <select value={kase.enhed} onChange={e => setKase({ ...kase, enhed: e.target.value })}>
            {ENHEDER.map(x => <option key={x.id}>{x.id}</option>)}
          </select></label>
          <div className="knapper">
            <button onClick={() => setIndsaet(true)}>Indsæt fra Excel</button>
            <button onClick={gemFil}>Gem som fil</button>
            <label className="knap">Åbn fil<input type="file" accept=".json" onChange={aabnFil} hidden /></label>
            <button onClick={() => confirm("Indlæse det tænkte eksempel? De nuværende tal overskrives.") && setKase(EKSEMPEL)}>Eksempel</button>
            <button onClick={() => confirm("Rydde alle tal?") && setKase(tomCase())}>Ryd</button>
          </div>
        </div>
        <p className="hjaelp">
          Tast regnskabet i analyseform – eller kopiér det fra nøgletalsappen: marker tabellen <em>Analyseform</em> i Excel-filen, og brug <em>Indsæt fra Excel</em>.
          Første kolonne er <strong>primo</strong> (det ældste regnskabs sammenligningsår) og bruges kun til gennemsnit; her tastes kun balancen.
          Grå felter beregnes, hvis de står tomme.
        </p>
      </div>
      {indsaet && <IndsaetDialog kase={kase} setKase={setKase} luk={() => setIndsaet(false)} />}

      <div className="kort rul">
        <table className="grid">
          <thead>
            <tr>
              <th>Post</th>
              {kase.kolonner.map((c, i) => (
                <th key={i}>
                  <input className="aar" value={c.aar} onChange={e => saetAar(i, e.target.value)} />
                  <div className="lille">{i === 0 ? "primo" : `analyseår ${i}`}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AFSNIT.map(af => (
              <React.Fragment key={af.id}>
                <tr className="afsnit"><td colSpan={5}>{af.navn}</td></tr>
                {POSTER.filter(p => p.afsnit === af.id).map(p => (
                  <tr key={p.key} className={p.afledt ? "afledt" : ""}>
                    <td>{p.label}</td>
                    {kase.kolonner.map((c, i) => {
                      const spaerret = i === 0 && !p.balance;
                      const raa = c.v[p.key];
                      return (
                        <td key={i}>
                          {spaerret ? <span className="lille">–</span> : (
                            <input
                              inputMode="decimal"
                              value={raa ?? ""}
                              placeholder={p.afledt && afledte[i][p.key] != null ? fmtBeloeb(afledte[i][p.key]) : ""}
                              onChange={e => saetFelt(i, p.key, e.target.value.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."))}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr className="kontrol">
              <td>Kontrol: aktiver − passiver</td>
              {afledte.map((v, i) => {
                const b = balanceKontrol(v);
                return <td key={i} className={b && Math.abs(b.forskel) > 1 ? "fejl" : "ok"}>{b ? (Math.abs(b.forskel) > 1 ? fmtBeloeb(b.forskel) : "stemmer") : "–"}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IndsaetDialog({ kase, setKase, luk }) {
  const [tekst, setTekst] = useState("");
  const [start, setStart] = useState(0);
  const resultat = tekst ? laesIndsat(tekst, 4 - start) : null;
  function brug() {
    setKase(k => ({
      ...k,
      kolonner: k.kolonner.map((c, i) => {
        if (i < start) return c;
        const v = { ...c.v };
        for (const [key, vaerdier] of Object.entries(resultat.poster)) {
          const x = vaerdier[i - start];
          if (x != null && !(i === 0 && !POSTER.find(p => p.key === key)?.balance)) v[key] = x;
        }
        return { ...c, v };
      }),
    }));
    luk();
  }
  return (
    <div className="kort dialog">
      <h3>Indsæt fra Excel</h3>
      <p className="hjaelp">Kopiér rækkerne med postens navn i første kolonne og årene i de næste. Navnene genkendes på de almindelige betegnelser.</p>
      <textarea rows={8} value={tekst} onChange={e => setTekst(e.target.value)} placeholder={"Nettoomsætning\t300.000\t324.000\t340.000\n…"} />
      <label>Første talkolonne er <select value={start} onChange={e => setStart(Number(e.target.value))}>
        {kase.kolonner.map((c, i) => <option key={i} value={i}>{c.aar} ({i === 0 ? "primo" : `analyseår ${i}`})</option>)}
      </select></label>
      {resultat && <p className="hjaelp">Genkendt: {Object.keys(resultat.poster).length} poster.{resultat.ukendte.length ? ` Ikke genkendt: ${resultat.ukendte.join(", ")}.` : ""}</p>}
      <div className="knapper">
        <button className="primaer" disabled={!resultat || !Object.keys(resultat.poster).length} onClick={brug}>Brug tallene</button>
        <button onClick={luk}>Annullér</button>
      </div>
    </div>
  );
}

/* ====================== 2 Målestokke ====================== */

function MaalestokView({ kase, setKase, analyse }) {
  const profil = findProfil(kase.profil);
  const aar = kase.kolonner.slice(1).map(c => c.aar);
  const saetRente = (i, x) => setKase(k => {
    const r = [...(k.markedsrente || [null, null, null])];
    r[i] = x === "" ? null : Number(x.replace(",", "."));
    return { ...k, markedsrente: r };
  });
  return (
    <section>
      <div className="kort">
        <h2>Markedsrenten</h2>
        <p className="hjaelp">{MARKEDSRENTE_NAVN}. Omkring 24. september 2026 lå den på ca. {String(MARKEDSRENTE_FORSLAG).replace(".", ",")} %. Brug helst årets gennemsnit for de ældre år – står feltet tomt, bruges {String(MARKEDSRENTE_FORSLAG).replace(".", ",")} %.</p>
        <div className="raekke">
          {aar.map((y, i) => (
            <label key={i}>{y} <input className="kort-input" inputMode="decimal" placeholder={String(MARKEDSRENTE_FORSLAG).replace(".", ",")}
              value={kase.markedsrente?.[i] ?? ""} onChange={e => saetRente(i, e.target.value)} /> %</label>
          ))}
        </div>
      </div>

      <div className="kort">
        <h2>Forretningsmodellen</h2>
        <label>Typisk profil <select value={kase.profil || ""} onChange={e => setKase({ ...kase, profil: e.target.value })}>
          <option value="">– ingen –</option>
          {PROFILER.map(p => <option key={p.id} value={p.id}>{p.navn}</option>)}
        </select></label>
        {profil && <p className="hjaelp">{profil.kendetegn}</p>}
        {profil && analyse && (
          <table className="tal smal">
            <thead><tr><th>Nøgletal</th><th>Typisk</th><th>{aar[2]}</th><th></th></tr></thead>
            <tbody>
              {Object.entries(PROFILNOEGLE).map(([k, nr]) => {
                const v = analyse.beregnet[2].n[nr];
                const d = modProfil(v, profil.v[k]);
                return (
                  <tr key={k}>
                    <td>{NT[nr].navn}</td>
                    <td>{profil.v[k] == null ? "intet lager" : formatNt(nr, profil.v[k])}</td>
                    <td>{formatNt(nr, v)}</td>
                    <td className={d && d !== "på linje" ? "afvig" : ""}>{d || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <label className="blok">Beskrivelse af virksomhedens forretningsmodel (bruges i trin 4)
          <textarea rows={4} value={kase.forretningsmodel || ""} onChange={e => setKase({ ...kase, forretningsmodel: e.target.value })}
            placeholder="Hvordan tjener virksomheden penge? Kunder, produkter, kanaler, strategi – gerne med ledelsesberetningens egne ord." />
        </label>
      </div>

      <div className="kort">
        <h2>Tommelfingerregler</h2>
        <p className="hjaelp">Rettes i <code>src/lib/maalestok.js</code>.</p>
        <ul>
          {Object.entries(TOMMELFINGERREGLER).map(([nr, r]) => <li key={nr}><strong>{r.tekst}</strong> {r.hvorfor}</li>)}
        </ul>
      </div>
    </section>
  );
}


/* ====================== 3 Vejledende besvarelse ====================== */

function AnalyseView({ analyse, prosa, setProsa, fingeraftryk, foraeldet }) {
  const [kode, setKode] = useState(hentKode());
  const [kodeOk, setKodeOk] = useState(false);
  const [travl, setTravl] = useState("");
  const [fejl, setFejl] = useState("");
  const saet = useMemo(() => talIAnalysen(analyse), [analyse]);

  async function logInd(e) {
    e.preventDefault();
    setFejl("");
    try { await tjekKode(kode); gemKode(kode); setKodeOk(true); } catch (x) { setFejl(x.message); }
  }
  async function skrivEt(id, p) {
    setTravl(id);
    const svar = id === "konklusion" ? await skrivKonklusion(analyse, p, kode) : await skrivOmraade(analyse, id, kode);
    return { ...p, [id]: svar, _fingeraftryk: fingeraftryk };
  }
  async function skrivAlt() {
    setFejl("");
    let p = foraeldet ? {} : { ...prosa };
    try {
      for (const o of OMRAADER) {
        if (analyse.omraader[o.id].ikkeRelevant) continue;
        p = await skrivEt(o.id, p);
        setProsa(p);
      }
      p = await skrivEt("konklusion", p);
      setProsa(p);
    } catch (x) { setFejl(x.message); } finally { setTravl(""); }
  }
  async function skrivEn(id) {
    setFejl("");
    try { setProsa(await skrivEt(id, foraeldet ? {} : prosa)); } catch (x) { setFejl(x.message); } finally { setTravl(""); }
  }
  const brugProsa = foraeldet ? {} : prosa;

  return (
    <section>
      <div className="kort claude">
        <h2>Motorens tekst eller Claudes prosa</h2>
        <p className="hjaelp">
          Nedenfor står motorens analyse: alt er regnet, intet er gættet. Claude kan omskrive den til sammenhængende prosa og skrive trin 4.
          Claude må kun bruge tallene fra analysen – hvert tal i teksten tjekkes, og ukendte tal markeres med gult.
        </p>
        {!kodeOk ? (
          <form className="raekke" onSubmit={logInd}>
            <label>Adgangskode <input type="password" value={kode} onChange={e => setKode(e.target.value)} /></label>
            <button className="primaer">Forbind</button>
          </form>
        ) : (
          <div className="knapper">
            <button className="primaer" disabled={!!travl} onClick={skrivAlt}>{travl ? `Skriver ${travl === "konklusion" ? "konklusionen" : analyse.omraader[travl]?.navn.toLowerCase()} …` : "Skriv hele besvarelsen som prosa"}</button>
            {Object.keys(brugProsa).length > 0 && <button disabled={!!travl} onClick={() => setProsa({})}>Tilbage til motorens tekst</button>}
          </div>
        )}
        {foraeldet && <p className="advarsel">Tallene er ændret, siden Claude skrev prosaen. Den bruges ikke, før den er skrevet igen.</p>}
        {fejl && <p className="fejltekst">{fejl}</p>}
      </div>

      {OMRAADER.map(o => (
        <Omraade key={o.id} a={analyse} id={o.id} prosa={brugProsa[o.id]} saet={saet}
          kanSkrive={kodeOk && !travl && !analyse.omraader[o.id].ikkeRelevant} skriv={() => skrivEn(o.id)} />
      ))}

      <div className="kort">
        <h2>Samlet konklusion – Trin 4 Forretningsmodellen</h2>
        <p className="trinspm">{TRIN[3].spoergsmaal}</p>
        {brugProsa.konklusion ? <Prosa tekst={brugProsa.konklusion.trin4} saet={saet} a={analyse} /> : (
          <>
            <p className="lille">Motorens udkast – skriv selv, eller lad Claude skrive konklusionen.</p>
            {analyse.konklusion.udkast.map((s, i) => <p key={i}>{s}</p>)}
          </>
        )}
        <div className="to">
          <div><h4>Styrker</h4><ul>{analyse.konklusion.styrker.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          <div><h4>Svagheder</h4><ul>{analyse.konklusion.svagheder.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        </div>
        {kodeOk && <button disabled={!!travl} onClick={() => skrivEn("konklusion")}>{travl === "konklusion" ? "Skriver …" : "Skriv trin 4 med Claude"}</button>}
      </div>
    </section>
  );
}

function Omraade({ a, id, prosa, saet, kanSkrive, skriv }) {
  const o = a.omraader[id];
  return (
    <div className="kort">
      <div className="kortTop">
        <h2>{o.navn}</h2>
        {kanSkrive && <button onClick={skriv}>{prosa ? "Skriv igen" : "Skriv som prosa"}</button>}
      </div>
      <NoegletalTabel a={a} o={o} />
      {id === "rentabilitet" && <DuPont a={a} />}
      {id === "rentabilitet" && <EkfTabel a={a} />}
      {o.ikkeRelevant ? <p>{o.trin1[0]}</p> : TRIN.slice(0, 3).map(t => (
        <div key={t.nr} className="trin">
          <h3><span className="trinnr">{t.nr}</span> {t.navn} <span className="trinspm">{t.spoergsmaal}</span></h3>
          {prosa ? <Prosa tekst={prosa[`trin${t.nr}`]} saet={saet} a={a} /> : (
            <ul>{o[`trin${t.nr}`].map((s, i) => <li key={i}>{s}</li>)}</ul>
          )}
        </div>
      ))}
    </div>
  );
}

/** Claudes tekst med ukendte tal markeret. */
function Prosa({ tekst, saet, a }) {
  const ukendte = tjekTal(tekst, a, saet);
  const re = ukendte.length ? new RegExp(`(${ukendte.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g") : null;
  const marker = afs => (re ? afs.split(re).map((d, i) => (ukendte.includes(d) ? <mark key={i} title="Tallet findes ikke i analysen">{d}</mark> : d)) : afs);
  return (
    <div className="prosa">
      {String(tekst || "").split(/\n+/).filter(x => x.trim()).map((afs, i) => <p key={i}>{marker(afs)}</p>)}
      {ukendte.length > 0 && <p className="advarsel">Tal, der ikke findes i analysen: {ukendte.join(", ")}. Ret eller skriv igen.</p>}
    </div>
  );
}

function NoegletalTabel({ a, o }) {
  return (
    <div className="rul">
      <table className="tal">
        <thead><tr><th>Nøgletal</th>{a.aar.map(y => <th key={y}>{y}</th>)}<th>Ændr. {a.aar[1]}</th><th>Ændr. {a.aar[2]}</th></tr></thead>
        <tbody>
          {o.tabel.map(r => (
            <tr key={r.nr}><td>{r.nr}. {r.navn}</td>{r.tekst.map((t, i) => <td key={i}>{t}</td>)}{r.aendring.map((t, i) => <td key={i} className="lille">{t}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DuPont({ a }) {
  const b = a.beregnet;
  const s = f => b.map(x => f(x)).join(" · ");
  const boks = (titel, vaerdi, klasse = "") => <div className={`boks ${klasse}`}><div className="bt">{titel}</div><div className="bv">{vaerdi}</div></div>;
  const d = a.dupont.filter(Boolean);
  return (
    <div className="dupont">
      <div className="lille">DuPont med virksomhedens egne tal ({a.aar.join(" · ")})</div>
      <div className="niv">{boks("Afkastningsgrad", s(x => fmtPct(x.n[1])), "top")}</div>
      <div className="grene">
        <div className="gren">
          {boks("Overskudsgrad", s(x => fmtPct(x.n[2])))}
          <div className="niv">
            {boks("Bruttomargin", s(x => fmtPct(x.n[7])), "lav")}
            <div className="gange">−</div>
            {boks("Kap.omk. i % af oms.", s(x => fmtPct(x.mellem.koAndel)), "lav")}
          </div>
          <div className="lille">forklares under indtjeningsevne</div>
        </div>
        <div className="gange stor">×</div>
        <div className="gren">
          {boks("Aktivernes oms.hastighed", s(x => fmtX(x.n[3])))}
          <div className="niv">
            {boks("Anlæg", s(x => fmtX(x.mellem.binding.anlaeg, 0)), "lav")}
            {boks("Lager", s(x => fmtX(x.mellem.binding.varelager, 0)), "lav")}
            {boks("Debitorer", s(x => fmtX(x.mellem.binding.debitorer, 0)), "lav")}
          </div>
          <div className="lille">kr. bundet pr. 100 kr. omsætning (ultimo) – forklares under kapitaltilpasning</div>
        </div>
      </div>
      {d.length > 0 && (
        <table className="tal smal">
          <thead><tr><th>Ændring i AG</th>{d.map(x => <th key={x.til}>{x.til}</th>)}</tr></thead>
          <tbody>
            <tr><td>fra overskudsgraden</td>{d.map(x => <td key={x.til}>{fmtPp(x.ogEffekt)}</td>)}</tr>
            <tr><td>fra omsætningshastigheden</td>{d.map(x => <td key={x.til}>{fmtPp(x.aohEffekt)}</td>)}</tr>
            <tr className="sum"><td>i alt</td>{d.map(x => <td key={x.til}>{fmtPp(x.dAG)}</td>)}</tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function EkfTabel({ a }) {
  const e = a.ekf.afstemning;
  if (!e.every(x => x?.efterSkat != null)) return null;
  const r = (t, f, klasse) => <tr className={klasse}><td>{t}</td>{e.map((x, i) => <td key={i}>{f(x)}</td>)}</tr>;
  return (
    <div className="rul">
      <table className="tal smal">
        <thead><tr><th>EKF-formlen og afstemningen</th>{a.aar.map(y => <th key={y}>{y}</th>)}</tr></thead>
        <tbody>
          {r("AG", x => fmtPct(x.ag))}
          {r("r", x => fmtPct(x.r))}
          {r("FK/EK", x => fmtX(x.g))}
          {r("+ (AG − r) · FK/EK", x => fmtPp(x.gearingsbidrag))}
          {r("= EKF før skat, formlen", x => fmtPct(x.formel), "sum")}
          {r("+ øvrige finansielle poster", x => fmtPp(x.rest))}
          {r("− skat", x => fmtPp(x.skat))}
          {r("= EKF efter skat (nr. 4)", x => fmtPct(x.efterSkat), "sum")}
        </tbody>
      </table>
    </div>
  );
}

/* ====================== 4 Underviservejledning ====================== */

function VejledningView({ analyse: a, prosa }) {
  const k = a.konklusion;
  return (
    <section>
      <div className="kort">
        <h2>Det store billede</h2>
        <p>{prosa.konklusion?.fortaelling || k.udkast[0]}</p>
        <div className="to">
          <div><h4>Styrker</h4><ul>{k.styrker.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          <div><h4>Svagheder</h4><ul>{k.svagheder.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        </div>
      </div>
      <div className="kort">
        <h2>Forslag til forløb (90 min.)</h2>
        <table className="tal smal venstre">
          <tbody>
            <tr><td>0–10</td><td>Formuleringstrappen på tavlen – de fire spørgsmål er ryggraden i gennemgangen.</td></tr>
            <tr><td>10–35</td><td>Rentabilitet: DuPont-tallene. Lad holdet finde, hvilken faktor der driver AG. Afslut med EKF-afstemningen.</td></tr>
            <tr><td>35–50</td><td>Indtjeningsevne og kapitaltilpasning – de forklarer hver sin faktor i AG.</td></tr>
            <tr><td>50–65</td><td>Soliditet og likviditet: tommelfingerregler – og hvornår forretningsmodellen er den bedre målestok.</td></tr>
            <tr><td>65–85</td><td>Trin 4 i grupper: holder forretningsmodellen? Én anbefaling pr. gruppe, der følger af tallene.</td></tr>
            <tr><td>85–90</td><td>Opsamling: hvilke faldgruber ramte vi?</td></tr>
          </tbody>
        </table>
      </div>
      {[...OMRAADER, { id: "konklusion", navn: "Trin 4 – forretningsmodellen" }].map(o => {
        const fg = a.faldgruber.filter(f => f.omraade === o.id);
        const om = a.omraader[o.id];
        if (om?.ikkeRelevant) return null;
        return (
          <div className="kort" key={o.id}>
            <h2>{o.navn}</h2>
            {om?.noegle?.length > 0 && <><h4>Det skal de finde</h4><ul>{om.noegle.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
            {o.id === "konklusion" && a.profil && <p><strong>Typisk {a.profil.navn.toLowerCase()}:</strong> {a.profil.kendetegn}</p>}
            {o.id === "konklusion" && k.afvigelser.length > 0 && <><h4>Afvigelser fra profilen</h4><ul>{k.afvigelser.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
            {fg.length > 0 && <h4>Faldgruber</h4>}
            {fg.map((f, i) => (
              <div key={i} className="faldgrube">
                <div className="tema">{f.temaNavn}</div>
                <p><strong>Forventet:</strong> {f.forventet}</p>
                <p><strong>Spørg:</strong> {f.spoergsmaal}</p>
                <p><strong>Svaret:</strong> {f.svar}</p>
              </div>
            ))}
            {!fg.length && o.id !== "konklusion" && <p className="lille">Ingen særlige faldgruber i dette regnskab.</p>}
          </div>
        );
      })}
    </section>
  );
}

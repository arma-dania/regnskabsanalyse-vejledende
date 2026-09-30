# Regnskabsanalyse – vejledende besvarelse

En webapp, der tager tre årsregnskaber, stiller dem op i analyseform, beregner 28 nøgletal
inden for fem analyseområder og tegner en graf til hvert nøgletal – præcis som nøgletalsappen
(`arma-dania/regnskaber`), som trin 0-3 er kopieret fra. Ud fra nøgletallene skriver appen
derefter en **vejledende besvarelse** op ad formuleringstrappen (trin 4) og en
**underviservejledning** til gennemgangen med holdet (trin 5). Begge hentes som Word.

Appen er til underviseren: den skriver hele analysen.

| Trin | Hvad der sker |
| --- | --- |
| 0 Velkommen | Overblik |
| 1 Indlæs regnskaber | CVR-opslag, iXBRL eller PDF – som i nøgletalsappen |
| 2 Analyseform | Omform resultatopgørelsen: flyt og læg poster sammen |
| 3 Nøgletal og grafer | De 28 nøgletal, grafer, Word og Excel |
| 4 Vejledende besvarelse | Målestokke, analysen område for område (trin 1-3), konklusionen (trin 4) |
| 5 Underviservejledning | Det store billede, forløb, tavleskitser, faldgruber med spørgsmål og svar |

## De fem analyseområder

| Område | Nøgletal |
| --- | --- |
| Rentabilitetsanalyse | 1–6 |
| Indtjeningsevne | 7–12 |
| Kapitaltilpasning og pengestrømme | 13–19 |
| Soliditet og likviditet | 20–24 |
| Børsrelaterede nøgletal | 25–28 |

Formlerne følger Bilag 2 "Nøgletalsdefinitioner" og ligger samlet i `src/lib/nogletal.js`.
Skal en definition ændres, er det den ene fil, der skal rettes — grafer, Word og Excel følger med.

## Arbejdsdelingen: motoren regner, Claude formulerer

**Motoren** (`src/analyse/analyse.js`) får nøgletallene direkte fra trin 3 (`src/analyse/fraDataset.js`) og regner alt, der kan regnes, uden AI:

- **Trin 1:** retning og størrelse for hvert nøgletal over tre år. En ændring
  nævnes, når den er mindst ½ procentpoint eller 5 %.
- **Trin 2:**
  - ΔAG fordelt på overskudsgrad og omsætningshastighed ved kædesubstitution.
  - ΔOG fordelt på bruttomargin og kapacitetsomkostninger.
  - ΔAOH forklaret med kapitalbindingen pr. 100 kr. omsætning.
  - EKF-formlen med afstemning til nøgletal 4.
  - ΔEKF fordelt på AG, r, gearing, øvrige finansielle poster og skat.
- **Trin 3:** de fire målestokke, som aftalt – sidste år, markedsrenten,
  tommelfingerreglerne og forretningsmodellen. Branchetal bruges ikke.
- **Trin 4:** styrker, svagheder, afvigelser fra profilen, en vurdering
  (holder / presset / under forandring) og anbefalinger, der følger af tallene.
- **Faldgruber:** hvor netop dette regnskab inviterer til de typiske fejl fra
  træningsappens temaliste – med et stilladsspørgsmål og svaret.

**Claude** (`netlify/functions/skriv.mjs`) får motorens fund som data og
omskriver dem til prosa. Claude må ikke regne eller finde på tal. Hvert tal i
Claudes tekst tjekkes mod analysen (`src/analyse/tjek.js`), og ukendte tal
markeres med gult. Ændres tallene bagefter, bruges prosaen ikke, før den er
skrevet igen. Uden Claude bruger Word-dokumenterne motorens egne sætninger.

## Faglige valg, du bør kende

- **Nøgletallene** er nøgletalsappens egne (`src/lib/nogletal.js`). Analysen
  skriver altid om præcis de tal, der står i trin 3. Motorens egen regning
  bruges kun til mellemregningerne, og en prøve kontrollerer, at den giver
  samme tal som nøgletalsappen.
- **EKF-formlen** EKF = AG + (AG − r) · FK/EK gælder før skat. Nøgletal 4 er
  efter skat og indeholder finansielle indtægter. Derfor vises en
  afstemning: formel + øvrige finansielle poster − skat = nøgletal 4.
- **r** er regnet på al fremmedkapital, også rentefri leverandørgæld. Den
  faktiske lånerente er derfor højere. Det står i trin 3, og der er en
  faldgrube, når r ligger under markedsrenten.
- **Kædesubstitution** i rækkefølgen OG → AOH (og AG → r → G for EKF). En
  anden rækkefølge fordeler samspillet lidt anderledes. Summen går altid op,
  og det kontrollerer prøverne.
- **Markedsrenten** er den 10-årige danske statsobligation. Omkring 24.
  september 2026 lå den på ca. 3,4 %. Den tastes pr. år, og
  `MARKEDSRENTE_FORSLAG` i `src/analyse/maalestok.js` bruges, når feltet er tomt.
- **Tommelfingerreglerne** er soliditetsgrad ≥ 30 %, kapitalbindingsgrad ≤ 1,
  likviditetsgrad I ≥ 100 % og likviditetsgrad II ≥ 150 % (gerne 200 %). De
  står i `src/analyse/maalestok.js`.
- **Forretningsmodellerne** er de typiske profiler fra *Gæt
  forretningsmodellen*. Et nøgletal afviger, når det ligger mere end ca. 25 %
  fra profilen. For supermarkeder og abonnement med fysisk levering vurderes
  en lav likviditetsgrad som normal.

## Claude og adgangskoden

Claude-delen (*Skriv som prosa* i trin 4) kræver to miljøvariabler i Netlify
(**Site configuration → Environment variables**, scope skal omfatte **Functions**).
Deploy igen, når de er sat.

| Variabel | Værdi |
| --- | --- |
| `ANTHROPIC_API_KEY` | Nøglen fra console.anthropic.com |
| `ADGANGSKODE` | Din kode til Claude-delen. Kun denne app bruger den; værdien må gerne være den samme som din underviserkode i de andre apps |

Uden dem virker alt andet, og Word-dokumenterne bruger motorens egne sætninger.
Modellen er Claude Opus 5.5 med effort `low` (`netlify/functions/lib/claude.mjs`).

## Kom i gang lokalt

```bash
npm install
npm run proeve         # prøverne: dekompositionerne går op, samme tal som trin 3, Word, adgangskode
npm run dev            # http://localhost:5173
```

iXBRL-adresser hentes gennem en serverfunktion. Den kræver Netlifys CLI:

```bash
npm install -g netlify-cli
netlify dev            # http://localhost:8888 – både app og funktion
```

Uden `netlify dev` virker alt undtagen "Hent regnskab" fra en adresse; PDF-indlæsning
og manuel indtastning kører helt i browseren.

## Udgivelse på Netlify via GitHub

1. Læg mappen i et nyt GitHub-repo:

   ```bash
   git init
   git add .
   git commit -m "Regnskabsanalyse"
   git branch -M main
   git remote add origin git@github.com:BRUGERNAVN/regnskabsanalyse.git
   git push -u origin main
   ```

2. På app.netlify.com: **Add new site → Import an existing project → GitHub** og vælg repoet.
3. Netlify læser `netlify.toml`, så byggeindstillingerne er udfyldt på forhånd
   (`npm run build`, publiceringsmappe `dist`, funktioner i `netlify/functions`).
4. Tryk **Deploy**. Hvert push til `main` udløser en ny udgivelse.

### Miljøvariabler

| Navn | Virkning |
| --- | --- |
| `TILLAD_ALLE_VAERTER` | Sæt til `true`, hvis proxyen skal kunne hente iXBRL fra andre værter end de danske regnskabsservere. Lad den være slået fra på en offentlig side. |
| `VIRK_BRUGER`, `VIRK_KODE` | Kun nødvendige, hvis Erhvervsstyrelsens distributionsindeks kræver legitimation. Rekvireres hos Erhvervsstyrelsen på 35 29 10 00. |

### Fejlsøgning: 403 fra Virk

Virks WAF afviser kald uden browserlignende headere, og proxyen sender dem derfor.
Kommer der stadig 403, peger adressen sandsynligvis på en visningsside frem for selve
dokumentet. Test adressen direkte:

```
https://DIT-SITE.netlify.app/.netlify/functions/ixbrl?url=ADRESSE&debug=1
```

Med `debug=1` returneres status, indholdstype og de første 800 tegn, så det er til at se,
hvad Virk faktisk sender tilbage.

## Sådan læses regnskaberne ind

**PDF.** Teksten trækkes ud med pdf.js, og posterne genkendes på deres danske betegnelser
(`src/lib/pdfImport.js`). Årstallene i kolonneoverskrifterne bruges til at stille årene op
automatisk; en enkelt kolonne kan altid flyttes manuelt, hvis genkendelsen rammer skævt.

Genkendelsen rammer ikke altid. Årsrapporter sættes op vidt forskelligt, og tal i noter kan
forveksles med tal i hovedopgørelsen. Derfor er trin 2 et almindeligt regneark: alt kan rettes,
og balancen kontrolleres undervejs. Betragt PDF-indlæsningen som et udkast, ikke som facit.

**CVR-opslag.** Skriv virksomhedens CVR-nummer, og appen slår de offentliggjorte årsrapporter
op i Erhvervsstyrelsens distributionsindeks, viser dem med regnskabsperiode og henter de tre
nyeste XBRL-dokumenter med ét klik. Det er den pålidelige vej ind. Kun regnskaber, der dækker
(tæt på) et helt år, vises — kvartals- og halvårsregnskaber, som nogle selskaber også
offentliggør, sorteres fra.

**iXBRL.** Her er tallene mærket op med begreber fra taksonomien, så indlæsningen er
pålidelig. Både den danske årsrapporttaksonomi (fsa) og den engelske IFRS-taksonomi
(ifrs-full) genkendes — store/børsnoterede selskaber aflægger ofte årsrapport efter IFRS,
som til dels bruger andre navne for samme post (fx `TradeReceivables` i fsa mod
`CurrentTradeReceivables` i ifrs-full). Mapningen står i `src/lib/ixbrlImport.js`. Kun
kontekster uden dimensioner bruges, så segmentoplysninger ikke forstyrrer hovedtallene —
er en post kun tagget som en dimensioneret opdeling (fx en note udelukkende opdelt på en
akse uden en samlet sum uden dimension), kommer den ikke med.

Talformatet læses ud fra iXBRL'ens egen format-attribut, ikke gættet ud fra sproget:
engelsksprogede IFRS-årsrapporter bruger typisk punktum som decimaltegn og komma som
tusindtalsseparator ("4,000,000.00"), mens danske fsa-regnskaber bruger det omvendte
("4.000.000,00"). Læses det forkerte format, bliver tallet forkert med en faktor på op til
en million — kontrollér derfor altid balancen og et par nøgletal efter en import.

Nogle regnskaber tagger aldrig en samlet personaleomkostning – kun de enkeltposter,
årsregnskabsloven kræver specifikation af (§98a): løn, pension og andre omkostninger til
social sikring, plus evt. andre personaleomkostninger. Findes totalen ikke, lægger appen
selv disse fire poster sammen. Det er et bedste bud på taksonomiens navne for
enkeltposterne, så tjek tallet mod regnskabets note om personaleomkostninger, hvis det er
muligt.

## Flyt og læg poster sammen

På trin 2 (Analyseform) kan poster inden for samme afsnit trækkes ind over hinanden for at
flytte eller lægge dem sammen — kildens tal lægges til målets tal i hvert år, kilden
tømmes, og målet foreslås et nyt, redigerbart navn (fx "Tilgodehavender fra salg
(varedebitorer) (inkl. andre tilgodehavender)"). Afledte (beregnede) poster kan ikke
trækkes, da de bygger på de øvrige poster.

Knappen **Foreslå omformning** kører en fast, gennemsigtig regel over et lille sæt
veletablerede par af poster (fx tilgodehavender/andre tilgodehavender, hensatte
forpligtelser/langfristet gæld i `src/lib/omformning.js`) og foreslår kun en
sammenlægning, hvis den ene post konsekvent udgør under 15 % af den anden i alle år, den
forekommer i. Hvert forslag skal godkendes for sig via samme bekræftelsesdialog som
træk-og-slip — appen ændrer intet af sig selv.

## Fire balancedatoer, tre analyseår

Et årsregnskab indeholder to år. Tre regnskaber giver derfor fire balancedatoer, og
appen fordeler dem selv:

| Balancedato | Rolle |
| --- | --- |
| Ældste sammenligningsår | Primobalance — indgår kun i gennemsnitstal |
| De tre nyeste år | Analyseår 1, 2 og 3 |

Dermed kan nøgletal 1, 3, 4, 5 og 6 beregnes på rigtige gennemsnit af primo og ultimo
i alle tre analyseår, og nøgletal 18 får det lager primo, varekøbet kræver.

Hvert regnskab bidrager kun med sit eget hovedår — bortset fra det ældste regnskab, som
også bidrager med sit sammenligningsår til primobalancen. En 2025-rapport bidrager altså
kun med 2025, en 2024-rapport kun med 2024, mens en 2023-rapport bidrager med både 2023 og
2022. Det undgår at et regnskabs ofte forkortede sammenligningstal for et år fortrænger et
andet regnskabs egne, fyldige tal for samme år. "Ældst" afgøres af regnskabets eget
hovedår, ikke af den rækkefølge, regnskaberne blev indlæst i.

Mangler primobalancen — fx fordi der kun er indlæst ét regnskab — regnes der på ultimotal,
og de berørte nøgletal markeres som skøn.

Under "Indlæs regnskaber" vises de fordelte tal samlet i én tabel: første kolonne er
posternes navne, og de følgende kolonner er balancedatoerne i kronologisk rækkefølge
(primo, derefter analyseår 1, 2 og 3) — normalt fem kolonner i alt ved tre indlæste
regnskaber.

## Klasse B-regnskaber

Små selskaber offentliggør ofte kun bruttofortjeneste, ikke omsætning. Uden omsætning kan
nøgletal 2, 3, 7 og 11–19 ikke beregnes. Appen siger til i stedet for at gætte.

## Filer

```
src/lib/model.js        Regnskabet i analyseform, afledte poster, kontrol af balancen
src/lib/nogletal.js     De 28 nøgletal: formler, beregning, forklaringer
src/lib/pdfImport.js    Tekstudtræk og genkendelse af poster i PDF
src/lib/fordeling.js    Fordeling af fire balancedatoer på tre år plus primo
src/lib/ixbrlImport.js  Mapping fra fsa- og ifrs-full-taksonomien til analyseformen
src/lib/exportExcel.js  Fire ark: analyseform, nøgletal, beregningsgrundlag, definitioner
src/lib/exportWord.js   Rapport med tabeller, grafer og kommentarfelter
src/lib/omformning.js   Forslag til sammenlægning af poster i analyseformen
src/analyse/fraDataset.js  Broen fra nøgletallene i trin 3 til analysen
src/analyse/analyse.js     Analysemotoren: trin 1-3, dekompositioner, faldgruber, trin 4-udkast
src/analyse/beregning.js   Mellemregninger, EKF-afstemning og formatering
src/analyse/maalestok.js   Markedsrente, tommelfingerregler, væsentlighed og forretningsmodeller
src/analyse/temaer.js      Formuleringstrappen og temaerne (samme ordlyd som træningsappen)
src/analyse/tjek.js        Taltjekket af Claudes tekst
src/analyse/word.js        Word: vejledende besvarelse og underviservejledning
src/components/AnalyseTrin.jsx    Trin 4
src/components/VejledningTrin.jsx Trin 5
netlify/functions/skriv.mjs      Claude-kaldet bag adgangskoden
netlify/functions/ixbrl.js       Proxy, der henter iXBRL-dokumenter
netlify/functions/regnskaber.js  Opslag af årsrapporter på CVR-nummer
```

## Licens

Til fri brug i undervisning.

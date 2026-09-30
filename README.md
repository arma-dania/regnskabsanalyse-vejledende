# Regnskabsanalyse – vejledende besvarelse

Bygger videre på nøgletalsappen (`arma-dania/regnskaber`) og bruger
fagligheden fra træningsappen (formuleringstrappen, DuPont og EKF-formlen) til
at skrive en **vejledende besvarelse** af et indlæst regnskab – og en
**underviservejledning** til gennemgangen med holdet. Begge hentes som Word.

Appen er til underviseren, ikke til de studerende: den skriver hele analysen.

## Sådan virker den

| Fane | Hvad du gør |
| --- | --- |
| 1 Regnskab | Tast regnskabet i analyseform for primo + tre år, eller kopiér tabellen fra nøgletalsappens Excel og brug *Indsæt fra Excel*. Balancen kontrolleres. *Gem som fil* gemmer casen som JSON. |
| 2 Målestokke | Markedsrenten pr. år, den typiske profil for forretningsmodellen og en kort beskrivelse af virksomhedens model. |
| 3 Vejledende besvarelse | Motorens analyse, område for område, trin 1-3, og et udkast til trin 4. Med adgangskoden kan Claude omskrive det til prosa. |
| 4 Underviservejledning | Det store billede, forløb på 90 minutter, tavleskitser, "det skal de finde" og faldgruber med spørgsmål og svar. |

## Arbejdsdelingen: motoren regner, Claude formulerer

**Motoren** (`src/lib/analyse.js`) regner alt, der kan regnes, uden AI:

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
Claudes tekst tjekkes mod analysen (`src/lib/tjek.js`), og ukendte tal
markeres med gult. Ændres tallene bagefter, bruges prosaen ikke, før den er
skrevet igen. Uden Claude bruger Word-dokumenterne motorens egne sætninger.

## Faglige valg, du bør kende

- **Nøgletallene** følger Bilag 2 og er regnet som i nøgletalsappen, så AG =
  OG × AOH går op. AG, EKF, r og gearing regnes på gennemsnit af primo og
  ultimo, de øvrige på ultimotal.
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
  `MARKEDSRENTE_FORSLAG` i `src/lib/maalestok.js` bruges, når feltet er tomt.
- **Tommelfingerreglerne** er soliditetsgrad ≥ 30 %, kapitalbindingsgrad ≤ 1,
  likviditetsgrad I ≥ 100 % og likviditetsgrad II ≥ 150 % (gerne 200 %). De
  står i `src/lib/maalestok.js`.
- **Forretningsmodellerne** er de typiske profiler fra *Gæt
  forretningsmodellen*. Et nøgletal afviger, når det ligger mere end ca. 25 %
  fra profilen. For supermarkeder og abonnement med fysisk levering vurderes
  en lav likviditetsgrad som normal.

## Sæt den op på Netlify

1. netlify.com → **Add new site → Import an existing project** → GitHub →
   dette repo. Byggeindstillingerne læses fra `netlify.toml`, og
   byggekommandoen kører prøverne først.
2. Sæt miljøvariablerne (scope skal omfatte **Functions**), og deploy igen:

| Variabel | Værdi |
| --- | --- |
| `ANTHROPIC_API_KEY` | Nøglen fra console.anthropic.com |
| `ADGANGSKODE` | Din kode til Claude-delen. Brug fx `crypto.randomUUID()` i browserens konsol |

Uden adgangskode virker alt undtagen *Skriv som prosa*.

**Model og pris.** Claude Opus 5.5 med effort `low`. Et helt sæt – fem
områder og konklusionen – er seks korte kald. Tager et kald for lang tid, så
prøv igen, eller hæv funktionens tidsgrænse i Netlify. Modellen står i
`netlify/functions/lib/claude.mjs`.

## Kør lokalt

```
npm install
npm run proeve   # dekompositionerne går op, taltjek, Word, adgangskode
npm run dev      # appen uden Claude på http://localhost:5173
netlify dev      # med Claude (kræver Netlify CLI og en .env med de to variabler)
```

## Filer

| Fil | Indhold |
| --- | --- |
| `src/lib/poster.js` | Analyseformens poster, afledte poster, indsæt fra Excel |
| `src/lib/nogletal.js` | De 28 nøgletal og EKF-afstemningen |
| `src/lib/maalestok.js` | **Markedsrente, tommelfingerregler, væsentlighed og forretningsmodeller** |
| `src/lib/analyse.js` | Motoren: trin 1-3, dekompositioner, faldgruber, trin 4-udkast |
| `src/lib/temaer.js` | Formuleringstrappen og temaerne – samme ordlyd som træningsappen |
| `src/lib/tjek.js` | Taltjekket af Claudes tekst |
| `src/lib/word.js` | De to Word-dokumenter |
| `src/lib/eksempel.js` | En tænkt grossist med opdigtede tal |
| `netlify/functions/skriv.mjs` | Claude-kaldet bag adgangskoden |
| `netlify/functions/lib/prompter.mjs` | Prompterne |
| `proever/` | Prøverne |

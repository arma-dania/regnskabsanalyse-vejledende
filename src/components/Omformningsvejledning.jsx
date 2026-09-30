const MAAL = [
  ['', 'Nettoomsætning'],
  ['−', 'Vareforbrug'],
  ['=', 'Bruttoresultat'],
  ['−', 'Kapacitetsomkostninger (personaleomkostninger, andre eksterne omkostninger, af- og nedskrivninger)'],
  ['=', 'Resultat af primær drift'],
  ['+', 'Finansielle indtægter'],
  ['−', 'Finansielle omkostninger'],
  ['=', 'Resultat før skat'],
  ['−', 'Skat af årets resultat'],
  ['=', 'Årets resultat']
]

const ARTSOPDELT = [
  ['Nettoomsætning', 'Lad den stå.'],
  ['Ændring i lagre af færdigvarer og varer under fremstilling', 'Træk den ind over vareforbruget ("Omkostninger til råvarer og hjælpematerialer" eller "Vareforbrug"). En lagerforøgelse trækkes fra vareforbruget, et lagerfald lægges til.'],
  ['Omkostninger til råvarer og hjælpematerialer / Vareforbrug', 'Lad den stå. Det er analyseformens vareforbrug.'],
  ['Andre driftsindtægter', 'Træk dem ind over "Nettoomsætning", så de indgår i omsætningen. Appen foreslår navnet "Nettoomsætning og andre driftsindtægter".'],
  ['Bruttofortjeneste (fed)', 'Lad den stå. Det er regnskabets egen sum og ikke analyseformens bruttoresultat, fordi andre eksterne omkostninger er trukket fra i den.'],
  ['Personaleomkostninger', 'Lad den stå. Står lønninger, pensioner og andre omkostninger til social sikring som hver sin linje, så træk dem sammen til én post – appen foreslår navnet "Personaleomkostninger".'],
  ['Andre eksterne omkostninger', 'Lad den stå. Det er en kapacitetsomkostning.'],
  ['Af- og nedskrivninger', 'Lad den stå. Det er en kapacitetsomkostning.'],
  ['Andre driftsomkostninger', 'Træk dem ind over "Andre eksterne omkostninger".'],
  ['Indtægter af kapitalandele i datter- eller associerede virksomheder', 'Træk dem ind over "Finansielle indtægter" – de stammer ikke fra virksomhedens egen primære drift.'],
  ['Finansielle indtægter og omkostninger', 'Lad dem stå.'],
  ['Skat af årets resultat', 'Lad den stå.']
]

const FUNKTIONSOPDELT = [
  ['Nettoomsætning', 'Lad den stå.'],
  ['Produktionsomkostninger', 'Lad den stå – den bruges som vareforbrug. Bemærk, at produktionsomkostningerne også rummer faste omkostninger i produktionen (fx løn og afskrivninger). Bruttoresultatet er derfor ikke et rent dækningsbidrag, og bruttomargin, nulpunktsomsætning og sikkerhedsmargin skal tolkes med forsigtighed. Skriv det i din analyse.'],
  ['Bruttoresultat (fed)', 'Lad den stå. Det er regnskabets egen sum.'],
  ['Distributionsomkostninger og administrationsomkostninger', 'Træk den ene ind over den anden. Appen foreslår navnet "Kapacitetsomkostninger".'],
  ['Andre driftsomkostninger', 'Træk dem ind over "Kapacitetsomkostninger".'],
  ['Andre driftsindtægter', 'Træk dem ind over "Nettoomsætning", så de indgår i omsætningen.'],
  ['Personaleomkostninger og af- og nedskrivninger i noterne', 'Læg dem ikke til. De er allerede fordelt på produktions-, distributions- og administrationsomkostningerne.'],
  ['Indtægter af kapitalandele i datter- eller associerede virksomheder', 'Træk dem ind over "Finansielle indtægter".'],
  ['Finansielle indtægter og omkostninger samt skat', 'Lad dem stå.']
]

function Trin ({ raekker }) {
  return (
    <table className="vejledning-tabel">
      <thead><tr><th>Post i regnskabet</th><th>Sådan gør du</th></tr></thead>
      <tbody>
        {raekker.map(([post, handling]) => (
          <tr key={post}><td>{post}</td><td>{handling}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Omformningsvejledning ({ opstilling }) {
  return (
    <details className="kort vejledning">
      <summary>
        Vejledning: Sådan omformer du resultatopgørelsen
        {opstilling && <span className="vejledning-maerke">Dit regnskab er {opstilling === 'arts' ? 'artsopdelt' : 'funktionsopdelt'}</span>}
      </summary>

      <h4>Målet: resultatopgørelsen i analyseform</h4>
      <table className="vejledning-maal">
        <tbody>
          {MAAL.map(([tegn, post]) => (
            <tr key={post} className={tegn === '=' ? 'sum' : ''}><td>{tegn}</td><td>{post}</td></tr>
          ))}
        </tbody>
      </table>
      <p>
        Appen regner selv bruttoresultat, kapacitetsomkostninger og resultat af primær drift ud fra
        posterne, som du har omformet dem. Din opgave er at få regnskabets poster på plads, så de
        passer ind i analyseformen.
      </p>

      <h4>Sådan gør du i tabellen</h4>
      <ul>
        <li><strong>Læg sammen:</strong> træk en post ind over midten af en anden post. Den post, du trækker, forsvinder, og den post, du slipper på, får den samlede værdi. Appen foreslår et navn, som du kan rette.</li>
        <li><strong>Indtægt mod omkostning:</strong> trækker du en indtægt ind over en omkostning (eller omvendt), bliver den trukket fra – fx bliver en lagerforøgelse ("Ændring i lagre af færdigvarer og varer under fremstilling") trukket fra vareforbruget.</li>
        <li><strong>Flyt:</strong> slip posten i den øverste eller nederste kant af en anden post.</li>
        <li><strong>Mellemresultater:</strong> regnskabets egne summer står med fed (fx bruttofortjeneste og resultat før skat). Dem skal du ikke lægge sammen med noget.</li>
        <li><strong>Fortryd:</strong> nederst på siden står alle sammenlægninger og flytninger, som hver kan fortrydes.</li>
        <li>En sammenlægning gælder automatisk alle år, så posterne behandles ens hele perioden igennem.</li>
      </ul>

      <h4 className={'nyt-afsnit' + (opstilling === 'arts' ? ' dit-regnskab' : '')}>Artsopdelt resultatopgørelse</h4>
      <p>Kendes på, at andre eksterne omkostninger, personaleomkostninger og af- og nedskrivninger står som hver sin linje.</p>
      <Trin raekker={ARTSOPDELT} />

      <h4 className={'nyt-afsnit' + (opstilling === 'funktion' ? ' dit-regnskab' : '')}>Funktionsopdelt resultatopgørelse</h4>
      <p>Kendes på linjerne produktionsomkostninger, distributionsomkostninger og administrationsomkostninger.</p>
      <Trin raekker={FUNKTIONSOPDELT} />

      <h4 className="nyt-afsnit">Viser regnskabet kun bruttofortjeneste?</h4>
      <p>
        Små virksomheder (regnskabsklasse B) må vise bruttofortjeneste i stedet for omsætning og
        vareforbrug. Så er der intet at omforme over bruttofortjenesten: lad den stå, og omform
        resten som i den artsopdelte vejledning. På nøgletalssiden kan du vælge at beregne de
        nøgletal, der ellers bruger omsætningen, på bruttofortjenesten i stedet.
      </p>
    </details>
  )
}

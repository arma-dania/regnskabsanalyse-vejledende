// Earth Matters ApS (klasse B) bruger "RestOfOtherFinanceExpenses" og
// personaleomkostningerne opdelt i fire delposter. Bygget efter regnskabet
// for 2025 (kr.).
import { DOMParser } from "linkedom";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseXbrlDokument } from "../src/lib/ixbrlImport.js";
import { fordelKolonner, anvendFordeling } from "../src/lib/fordeling.js";
import { withDerived } from "../src/lib/model.js";

const ctx = (id, y, inst) => `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier scheme="x">41143320</xbrli:identifier></xbrli:entity><xbrli:period>${inst ? `<xbrli:instant>${y}-12-31</xbrli:instant>` : `<xbrli:startDate>${y}-01-01</xbrli:startDate><xbrli:endDate>${y}-12-31</xbrli:endDate>`}</xbrli:period></xbrli:context>`;
const n = (b, c, v) => `<ix:nonFraction name="fsa:${b}" contextRef="${c}" unitRef="DKK" decimals="0">${v}</ix:nonFraction>`;
const r = (label, b, a, f, dur = true) => `<tr><td>${label}</td><td>${n(b, dur ? "d1" : "i1", a)}</td><td>${n(b, dur ? "d0" : "i0", f)}</td></tr>`;

function dokument(medTotal) {
  return `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:xbrli="http://www.xbrl.org/2003/instance"><body>
<ix:header><ix:resources>${ctx("d1", 2025)}${ctx("d0", 2024)}${ctx("i1", 2025, 1)}${ctx("i0", 2024, 1)}</ix:resources></ix:header>
<p>Resultatopgørelse</p><table>
${r("Bruttofortjeneste", "GrossProfitLoss", "6.533.046", "7.342.243")}
${medTotal ? r("Personaleomkostninger", "EmployeeBenefitsExpense", "5.725.598", "5.099.170") : ""}
${r("Lønninger", "WagesAndSalaries", "4.895.845", "4.514.202")}
${r("Pensioner", "PostemploymentBenefitExpense", "400.198", "294.904")}
${r("Andre omkostninger til social sikring", "SocialSecurityContributions", "82.858", "67.875")}
${r("Andre personaleomkostninger", "OtherEmployeeExpense", "346.697", "222.189")}
${r("Af- og nedskrivninger", "DepreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss", "348.910", "38.677")}
${r("Resultat af ordinær primær drift", "ProfitLossFromOrdinaryOperatingActivities", "458.538", "2.204.396")}
${r("Andre finansielle indtægter", "OtherFinanceIncome", "387.368", "145.464")}
${r("Andre finansielle omkostninger", "RestOfOtherFinanceExpenses", "187.044", "533.195")}
${r("Skat af årets resultat", "TaxExpense", "146.928", "397.610")}
${r("Årets resultat", "ProfitLoss", "511.934", "1.419.055")}
</table><p>Balance</p><table>
${r("Aktiver i alt", "Assets", "3.965.582", "3.982.160", false)}
${r("Egenkapital", "Equity", "2.196.137", "1.684.203", false)}
${r("Passiver i alt", "LiabilitiesAndEquity", "3.965.582", "3.982.160", false)}
</table></body></html>`;
}

const indlaes = medTotal => {
  const tom = { virksomhed: "", enhed: "kr.", grundenhed: "kr.", aar: [{}, {}, {}].map(() => ({ label: "", poster: {}, values: {} })), primoPoster: {}, poster: [], sammenlaegninger: {}, raekkefoelge: [] };
  const ds = anvendFordeling(tom, fordelKolonner([parseXbrlDokument(dokument(medTotal), "2025.xhtml", DOMParser)]));
  return withDerived(ds.aar.find(y => y.label === "2025").values);
};

test("andre finansielle omkostninger (RestOfOtherFinanceExpenses) og andre personaleomkostninger indlæses", () => {
  const v = indlaes(false);
  assert.equal(v.finansielleOmkostninger, 187044);
  assert.equal(v.personaleomkostninger, 5725598);
  assert.equal(v.resultatPrimaerDrift, 458538);
  assert.equal(v.aaretsResultat, 511934);
});

test("delposterne tælles ikke med, når regnskabet også viser personaleomkostninger i alt", () => {
  assert.equal(indlaes(true).personaleomkostninger, 5725598);
});

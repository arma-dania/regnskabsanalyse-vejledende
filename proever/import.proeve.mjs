// Et konstrueret regnskab i stil med Gasa Group Denmark A/S (modervirksomhed
// med datterselskaber, engelske overskrifter, nøgletabel før opgørelserne).
import { DOMParser } from "linkedom";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseXbrlDokument } from "../src/lib/ixbrlImport.js";
import { fordelKolonner, anvendFordeling } from "../src/lib/fordeling.js";
import { validate, withDerived } from "../src/lib/model.js";
import { beregnAlle } from "../src/lib/nogletal.js";

const ctx = (id, y, inst) => inst
  ? `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier scheme="x">25442024</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>${y}-12-31</xbrli:instant></xbrli:period></xbrli:context>`
  : `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier scheme="x">25442024</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:startDate>${y}-01-01</xbrli:startDate><xbrli:endDate>${y}-12-31</xbrli:endDate></xbrli:period></xbrli:context>`;
const n = (b, c, v) => `<ix:nonFraction name="fsa:${b}" contextRef="${c}" unitRef="DKK" scale="3" decimals="-3">${v}</ix:nonFraction>`;
const raekke = (label, b, a, f, dur = true) => `<tr><td>${label}</td><td>${n(b, dur ? "d1" : "i1", a)}</td><td>${n(b, dur ? "d0" : "i0", f)}</td></tr>`;

// Mini-Gasa (t.kr.): 2025 og 2024.
function dokument(y1, y0, t) {
  return `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:xbrli="http://www.xbrl.org/2003/instance"><head><title>Annual report</title></head><body>
<ix:header><ix:resources>${ctx("d1", y1)}${ctx("d0", y0)}${ctx("i1", y1, 1)}${ctx("i0", y0, 1)}</ix:resources></ix:header>
<p>Contents</p><p>Income statement 12</p><p>Balance sheet 13</p><p>Notes 15</p>
<p>Financial highlights</p><table>${raekke("Net financials", "OtherFinanceExpenses", "9.999", "9.999")}${raekke("Profit for the year", "ProfitLoss", t[1].pl, t[0].pl)}</table>
<p>Income statement</p><table>
${raekke("Revenue", "Revenue", t[1].oms, t[0].oms)}
${raekke("Cost of sales", "RawMaterialsAndConsumablesUsed", t[1].vf, t[0].vf)}
${raekke("Other external expenses", "OtherExternalExpenses", t[1].ee, t[0].ee)}
${raekke("Staff costs", "EmployeeBenefitsExpense", t[1].pers, t[0].pers)}
${raekke("Depreciation", "DepreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss", t[1].afs, t[0].afs)}
${raekke("Income from investments in group enterprises", "IncomeFromInvestmentsInGroupEnterprises", t[1].dat, t[0].dat)}
${raekke("Financial income", "OtherFinanceIncome", t[1].fi, t[0].fi)}
${raekke("Financial expenses", "OtherFinanceExpenses", t[1].fo, t[0].fo)}
${raekke("Profit before tax", "ProfitLossFromOrdinaryActivitiesBeforeTax", t[1].pbt, t[0].pbt)}
${raekke("Tax", "TaxExpenseOnOrdinaryActivities", t[1].tax, t[0].tax)}
${raekke("Profit for the year", "ProfitLoss", t[1].pl, t[0].pl)}
${raekke("Retained earnings", "RetainedEarnings", "-56.000", "10.000")}
</table>
<p>Balance sheet</p><p>Assets</p><table>
${raekke("Investments", "LongtermInvestmentsAndReceivables", t[1].fa, t[0].fa, false)}
${raekke("Cash", "CashAndCashEquivalents", t[1].lik, t[0].lik, false)}
${raekke("Total assets", "Assets", t[1].akt, t[0].akt, false)}
</table><p>Equity and liabilities</p><table>
${raekke("Equity", "Equity", t[1].ek, t[0].ek, false)}
${raekke("Trade payables", "ShorttermTradePayables", t[1].lev, t[0].lev, false)}
${raekke("Total equity and liabilities", "LiabilitiesAndEquity", t[1].akt, t[0].akt, false)}
</table>
<p>Statement of changes in equity</p><table>${raekke("Equity attributable to shareholders", "EquityAttributableToOwnersOfParent", "153.300", "153.300", false)}</table>
<p>Notes</p><table>${raekke("Payables to group enterprises", "ShorttermPayablesToGroupEnterprises", "48.000", "40.000", false)}</table>
</body></html>`;
}
const aar = y => ({ oms: "1.171.500", vf: "998.200", ee: "45.800", pers: "110.100", afs: "2.000", dat: "18.800", fi: "5.800", fo: "6.400", pbt: "33.600", tax: "3.300", pl: "30.300", fa: "89.500", lik: "257.300", akt: "346.800", ek: "140.400", lev: "206.400", ...y });
const t24 = aar({ oms: "1.162.100", vf: "991.100", ee: "44.600", pers: "108.000", afs: "2.800", dat: "21.900", fi: "9.300", fo: "7.900", pbt: "38.900", tax: "3.800", pl: "35.100", fa: "69.500", lik: "306.200", akt: "375.700", ek: "189.200", lev: "186.500" });
const t25 = aar({});
const t23 = aar({ oms: "1.094.200", vf: "929.500", ee: "44.800", pers: "104.100", afs: "8.100", dat: "20.000", fi: "6.800", fo: "7.100", pbt: "27.400", tax: "1.700", pl: "25.700", fa: "46.600", lik: "255.000", akt: "301.600", ek: "153.300", lev: "148.300" });
const t22 = aar({ ek: "125.000", akt: "280.000", fa: "40.000", lik: "240.000", lev: "155.000" });

const docs = [
  parseXbrlDokument(dokument(2025, 2024, [t24, t25]), "2025.xhtml", DOMParser),
  parseXbrlDokument(dokument(2024, 2023, [t23, t24]), "2024.xhtml", DOMParser),
  parseXbrlDokument(dokument(2023, 2022, [t22, t23]), "2023.xhtml", DOMParser),
];
test("engelsk årsrapport: noter, disponering og nøgletabel kommer ikke med i opgørelserne", () => {
const d25 = docs[0];
const ids = d25.poster.map(p => p.id);
assert.ok(!ids.some(id => /RetainedEarnings|EquityAttributable|PayablesToGroup/.test(id)), "noter og disponering er ikke med");
assert.equal(d25.kolonner[0].values["resultat:OtherFinanceExpenses"], 6400000, "nøgletalstabellen overskriver ikke resultatopgørelsen");

});

test("indtægter af kapitalandele tæller med i årets resultat og EKF – som i årsrapporten", () => {
const tom = { virksomhed: "Gasa", enhed: "mio. kr.", grundenhed: "kr.", aar: [{}, {}, {}].map(() => ({ label: "", poster: {}, values: {} })), primoPoster: {}, poster: [], sammenlaegninger: {}, raekkefoelge: [] };
const ds = anvendFordeling(tom, fordelKolonner(docs));
assert.equal(withDerived(ds.aar[2].values).aaretsResultat, 30300000);
const nt = beregnAlle(ds);
assert.deepEqual(nt.map(r => r[4].value.toFixed(1)), ["18.5", "20.5", "18.4"]);
assert.equal(validate(ds).filter(x => /analyseformen/.test(x.text)).length, 0);
});

/** Pure tax computation. VAT-inclusive: net + VAT are derived from a tax-included
 *  gross. Non-VAT: shows a percentage tax (business liability, informational).
 *  none: no tax line. Rate is config-driven (accounting confirms which applies). */
export interface TaxBreakdown {
  mode: string;
  rate: number;
  net: number;
  tax: number;
  total: number;
  label: string;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeTax(gross: number, mode: string, rate: number): TaxBreakdown {
  const g = r2(gross);
  if (mode === "vat_inclusive" && rate > 0) {
    const net = r2(g / (1 + rate));
    return { mode, rate, net, tax: r2(g - net), total: g, label: `VAT ${Math.round(rate * 100)}% (incl.)` };
  }
  if (mode === "non_vat" && rate > 0) {
    return { mode, rate, net: g, tax: r2(g * rate), total: g, label: `Percentage tax ${(rate * 100).toFixed(1)}%` };
  }
  return { mode: "none", rate: 0, net: g, tax: 0, total: g, label: "" };
}

import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeTax } from "@/lib/hotel/tax";
import { COLLECTION_CATEGORIES } from "@/lib/config";

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${m}/${d}/${y}`;
}

type Collection = {
  id: string;
  collected_on: string;
  or_number: string | null;
  ar_no: string | null;
  business_line: string;
  charge_type: string | null;
  amount: number;
  unit: { unit_number: string } | null;
};

export async function GET(req: NextRequest) {
  await requireModule("finance");

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: rawRows }, { data: settingsRow }] = await Promise.all([
    admin
      .from("collections")
      .select("id, collected_on, or_number, ar_no, business_line, charge_type, amount, unit:unit_id(unit_number)")
      .gte("collected_on", from)
      .lte("collected_on", to)
      .order("collected_on", { ascending: true })
      .order("created_at", { ascending: true }),
    admin.from("finance_settings").select("vat_mode, vat_rate").eq("id", 1).maybeSingle(),
  ]);

  const rows = (rawRows ?? []) as unknown as Collection[];

  const vatMode = (settingsRow?.vat_mode as string) ?? "none";
  const vatRate = Number(settingsRow?.vat_rate ?? 0);

  const labelMap = new Map<string, string>(COLLECTION_CATEGORIES.map((c) => [c.key as string, c.label]));

  const header = [
    "Date",
    "OR/AR Number",
    "Customer/Unit",
    "Business Line",
    "Gross Amount",
    "Taxable Sales (VAT Base)",
    "Output VAT",
    "VAT-Exempt / Zero-rated",
  ].join(",");

  const dataRows: string[] = [];

  let grandGross = 0;
  let grandTaxable = 0;
  let grandVat = 0;
  let grandExempt = 0;

  for (const c of rows) {
    const gross = r2(Number(c.amount));
    const tax = computeTax(gross, vatMode as "vat_inclusive" | "non_vat" | "none", vatRate);
    const taxable = vatMode === "vat_inclusive" ? tax.net : gross;
    const vat = vatMode === "vat_inclusive" ? tax.tax : 0;
    const exempt = vatMode === "none" ? gross : 0;

    grandGross += gross;
    grandTaxable += taxable;
    grandVat += vat;
    grandExempt += exempt;

    const orRef = c.or_number ?? c.ar_no ?? "";
    const unitLabel = (c.unit as { unit_number: string } | null)?.unit_number ?? "Various";
    const lineLabel = labelMap.get(c.business_line) ?? c.business_line;

    dataRows.push(
      [
        csvEscape(fmtDate(c.collected_on)),
        csvEscape(orRef),
        csvEscape(unitLabel),
        csvEscape(lineLabel),
        csvEscape(r2(gross).toFixed(2)),
        csvEscape(r2(taxable).toFixed(2)),
        csvEscape(r2(vat).toFixed(2)),
        csvEscape(r2(exempt).toFixed(2)),
      ].join(","),
    );
  }

  const totalRow = [
    "TOTAL",
    "",
    "",
    "",
    csvEscape(r2(grandGross).toFixed(2)),
    csvEscape(r2(grandTaxable).toFixed(2)),
    csvEscape(r2(grandVat).toFixed(2)),
    csvEscape(r2(grandExempt).toFixed(2)),
  ].join(",");

  const csv = [
    `BIR Subsidiary Sales Journal,,,,,,,`,
    `Period:,${from} to ${to},,,,,,`,
    `VAT Mode:,${vatMode},,,,,,`,
    ``,
    header,
    ...dataRows,
    ``,
    totalRow,
  ].join("\r\n");

  const filename = `bir-sales-journal_${from}_${to}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

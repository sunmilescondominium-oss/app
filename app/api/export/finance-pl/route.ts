import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { plReport } from "@/lib/finance/queries";
import { toCsv, csvResponse } from "@/lib/export/csv";
import { todayManila } from "@/lib/collections/summary";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "finance")) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || todayManila();
  const to = url.searchParams.get("to") || todayManila();
  const pl = await plReport(from, to);

  const rows = pl.rows.map((r) => [r.label, r.income, r.expense, r.net]);
  rows.push(["TOTAL", pl.incomeTotal, pl.expenseTotal, pl.netTotal]);
  const csv = toCsv(["Business line", "Income", "Expense", "Net"], rows);
  return csvResponse(`profit-and-loss_${from}_to_${to}.csv`, csv);
}

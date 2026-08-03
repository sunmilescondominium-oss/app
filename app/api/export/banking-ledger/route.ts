import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { getAccount, listTransactions } from "@/lib/banking/queries";
import { TXN_KIND_LABEL } from "@/lib/banking/types";
import { toCsv, csvResponse } from "@/lib/export/csv";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "banking")) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const accountId = url.searchParams.get("account");
  if (!accountId) return new Response("Missing account", { status: 400 });
  const account = await getAccount(accountId);
  if (!account) return new Response("Not found", { status: 404 });

  const txns = await listTransactions(accountId, 1000);
  const csv = toCsv(
    ["Date", "Type", "Reference", "Payee / source", "Out", "In", "Status", "Cleared on", "Memo"],
    txns.map((t) => [
      t.txn_date, TXN_KIND_LABEL[t.kind], t.reference ?? "", t.counterparty ?? "",
      t.direction === "out" ? t.amount : "", t.direction === "in" ? t.amount : "",
      t.status, t.cleared_on ?? "", t.memo ?? "",
    ]),
  );
  const safe = account.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return csvResponse(`ledger_${safe}.csv`, csv);
}

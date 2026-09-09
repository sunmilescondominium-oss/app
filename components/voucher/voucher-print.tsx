import { APP_BRAND_SHORT } from "@/lib/config";

const COMPANY_NAME = APP_BRAND_SHORT.toUpperCase() + " CORP.";
const COMPANY_ADDRESS = "Sun Miles Condo Rosal St. Brgy. 1 Calamba City";

function pesoInWords(amount: number): string {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven",
    "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
    "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function say(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? "-" + ones[n % 10] : "") + " ";
    return ones[Math.floor(n / 100)] + " hundred " + say(n % 100);
  }
  const pesos = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);
  let words = "";
  if (pesos >= 1_000_000) words += say(Math.floor(pesos / 1_000_000)) + "million ";
  if (pesos >= 1_000) words += say(Math.floor((pesos % 1_000_000) / 1_000)) + "thousand ";
  words += say(pesos % 1_000);
  words = words.trim();
  let result = (words || "zero").replace(/\b\w/g, (c) => c.toUpperCase()) + " Pesos";
  if (centavos > 0) {
    result += " and " + say(centavos).trim().replace(/\b\w/g, (c) => c.toUpperCase()) + (centavos === 1 ? " Centavo" : " Centavos");
  }
  return result + " Only";
}

const td: React.CSSProperties = {
  border: "1px solid #000",
  padding: "3px 5px",
  fontSize: "9pt",
  verticalAlign: "middle",
};
const th: React.CSSProperties = {
  ...td,
  fontWeight: "bold",
  textAlign: "center",
  backgroundColor: "#f5f5f5",
};
const labelCol: React.CSSProperties = { ...td, width: "14%", whiteSpace: "nowrap" };

export interface VoucherData {
  rcNo: string;
  date: string;
  place?: string;
  paidTo: string;
  paidToAddress?: string;
  particulars: { description: string; amount?: number }[];
  totalAmount: number;
}

function VoucherBody({ data }: { data: VoucherData }) {
  const { rcNo, date, place = "Calamba City", paidTo, paidToAddress = "", particulars, totalAmount } = data;
  const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Always show at least 5 rows of particulars for writing space
  const rows = particulars.length >= 5 ? particulars : [
    ...particulars,
    ...Array(5 - particulars.length).fill({ description: "", amount: undefined }),
  ];

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      {/* Header */}
      <tbody>
        <tr>
          <td colSpan={6} style={{ ...td, textAlign: "center", padding: "6px 4px" }}>
            <div style={{ fontSize: "11pt", fontWeight: "bold", letterSpacing: "0.5px" }}>{COMPANY_NAME}</div>
            <div style={{ fontSize: "8pt", marginTop: "1px" }}>{COMPANY_ADDRESS}</div>
          </td>
        </tr>

        {/* RC No + VOUCHER */}
        <tr>
          <td style={{ ...labelCol }}>R.C No.</td>
          <td style={{ ...td, width: "20%" }}>{rcNo}</td>
          <td colSpan={3} style={{ ...td, textAlign: "center", fontSize: "14pt", fontWeight: "bold", letterSpacing: "2px" }}>VOUCHER</td>
          <td style={{ ...td, width: "14%" }}></td>
        </tr>

        {/* Date */}
        <tr>
          <td style={labelCol}>Date</td>
          <td style={td}>{date}</td>
          <td colSpan={4} style={td}></td>
        </tr>

        {/* Place */}
        <tr>
          <td style={labelCol}>Place</td>
          <td style={td}>{place}</td>
          <td colSpan={4} style={td}></td>
        </tr>

        {/* Paid to */}
        <tr>
          <td style={labelCol}>Paid to</td>
          <td colSpan={5} style={td}>{paidTo}</td>
        </tr>

        {/* Address */}
        <tr>
          <td style={{ ...labelCol, paddingLeft: "16px" }}>Address</td>
          <td colSpan={5} style={td}>{paidToAddress}</td>
        </tr>

        {/* Particulars header */}
        <tr>
          <td colSpan={5} style={th}>PARTICULARS</td>
          <td style={{ ...th, width: "18%" }}>AMOUNT</td>
        </tr>

        {/* Detail rows */}
        {rows.map((r, i) => (
          <tr key={i} style={{ height: "22px" }}>
            {i === 0
              ? <td style={{ ...labelCol, whiteSpace: "nowrap" }}>Payment for :</td>
              : <td style={td}></td>}
            <td colSpan={4} style={td}>{r.description}</td>
            <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {r.amount != null ? peso(r.amount) : ""}
            </td>
          </tr>
        ))}

        {/* Total */}
        <tr>
          <td colSpan={4} style={td}></td>
          <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>TOTAL</td>
          <td style={{ ...td, textAlign: "right", fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>
            {peso(totalAmount)}
          </td>
        </tr>

        {/* Receipt text */}
        <tr>
          <td colSpan={6} style={{ ...td, textAlign: "center", lineHeight: 1.8, padding: "8px" }}>
            <span>Received from </span>
            <span style={{ display: "inline-block", width: "180px", borderBottom: "1px solid #000" }}>&nbsp;</span>
            <span> the amount</span>
            <br />
            <span>of PESOS </span>
            <span style={{ display: "inline-block", minWidth: "220px", borderBottom: "1px solid #000", textAlign: "left", paddingLeft: "4px" }}>
              {pesoInWords(totalAmount)}
            </span>
            <br />
            <span style={{ fontSize: "8pt", color: "#444" }}>in full payment of amount describe above</span>
          </td>
        </tr>

        {/* Blank spacer */}
        <tr>
          <td colSpan={6} style={{ ...td, height: "18px" }}></td>
        </tr>

        {/* Signatures */}
        <tr>
          <td colSpan={3} style={{ ...td, fontWeight: "bold" }}>APPROVED BY:</td>
          <td colSpan={3} style={{ ...td, fontWeight: "bold" }}>
            RECEIVED BY:{" "}
            <span style={{ display: "inline-block", width: "120px", borderBottom: "1px solid #000" }}>&nbsp;</span>
          </td>
        </tr>

        {/* Bottom spacer */}
        <tr>
          <td colSpan={6} style={{ ...td, height: "14px" }}></td>
        </tr>
      </tbody>
    </table>
  );
}

export function VoucherPrint({ data }: { data: VoucherData }) {
  return (
    <>
      <style>{`
        @media print {
          @page { size: Letter; margin: 0.4in 0.5in; }
          .voucher-copy { page-break-inside: avoid; }
          .voucher-cut { border-top: 1px dashed #666; margin: 6px 0; text-align: center; font-size: 8pt; color: #666; }
        }
      `}</style>

      {/* Office copy */}
      <div className="voucher-copy">
        <div style={{ fontSize: "7pt", textAlign: "right", marginBottom: "2px", color: "#666" }}>Office Copy</div>
        <VoucherBody data={data} />
      </div>

      {/* Cut line */}
      <div className="voucher-cut" style={{ fontSize: "8pt", color: "#666", borderTop: "1px dashed #999", margin: "8px 0", textAlign: "center" }}>
        ✂ &nbsp; CUT HERE &nbsp; ✂
      </div>

      {/* Payee copy */}
      <div className="voucher-copy">
        <div style={{ fontSize: "7pt", textAlign: "right", marginBottom: "2px", color: "#666" }}>Payee / Vendor Copy</div>
        <VoucherBody data={data} />
      </div>
    </>
  );
}

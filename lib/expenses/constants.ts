export const CSV_TEMPLATE_FIELDS = [
  { key: "Date",         note: "YYYY-MM-DD" },
  { key: "Category",     note: "Must match an existing category name" },
  { key: "Vendor/Payee", note: "Must match an existing vendor name" },
  { key: "Amount",       note: "Numbers only, no commas" },
  { key: "OR Number",    note: "Optional" },
  { key: "Source",       note: "bank or petty_cash" },
  { key: "Bank Account", note: "Bank account label — required when Source = bank" },
  { key: "Remarks",      note: "Optional" },
];

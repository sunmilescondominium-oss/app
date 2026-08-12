// CSV headers + templates for the operational config tables.

export const RATE_PLAN_HEADERS = ["name", "base_hours", "base_rate", "extra_hour_rate", "sort_order"] as const;
export const RATE_PLAN_TEMPLATE =
  RATE_PLAN_HEADERS.join(",") + "\n" +
  "3 Hours,3,350,100,10\n" +
  "6 Hours,6,550,90,20\n" +
  "12 Hours,12,900,80,30\n" +
  "# name is unique — re-importing an existing name updates its rates · numbers only, no peso sign\n";

export const MENU_HEADERS = ["category", "name", "price", "sort_order"] as const;
export const MENU_TEMPLATE =
  MENU_HEADERS.join(",") + "\n" +
  "Beverage,Bottled Water 500ml,20,10\n" +
  "Beverage,Soft Drinks in Can,45,20\n" +
  "Food,Instant Noodles,35,30\n" +
  "# category+name together must be unique — re-importing updates the price\n";

export const SUPPLY_HEADERS = ["name", "unit_label", "stock_qty", "reorder_level", "sort_order"] as const;
export const SUPPLY_TEMPLATE =
  SUPPLY_HEADERS.join(",") + "\n" +
  "Bath Towel,pcs,0,10,10\n" +
  "Bath Soap,pcs,0,24,20\n" +
  "Toilet Paper,roll,0,24,30\n" +
  "# name is unique — re-importing an existing name updates unit/stock/reorder\n";

// Meter reading bulk import template.
// unit_number   : must match an existing unit's unit_number exactly (case-insensitive)
// utility       : electric | water
// read_on       : YYYY-MM-DD — date the meter was physically read
// reading       : dial reading (cumulative kWh / cu.m)
// bill_amount   : peso amount printed on the bill (leave blank if not yet billed)
// billing_period: YYYY-MM billing month (e.g. 2026-08)
// or_number     : Meralco / water utility OR or reference number on the bill
// due_date      : YYYY-MM-DD when the bill is due for payment
// remarks       : any note (optional)
export const METER_READING_HEADERS = [
  "unit_number", "utility", "read_on", "reading",
  "bill_amount", "billing_period", "or_number", "due_date", "remarks",
] as const;
export const METER_READING_TEMPLATE =
  METER_READING_HEADERS.join(",") + "\n" +
  "Room 101,electric,2026-08-01,4523.50,1850.00,2026-08,MEP-123456,2026-08-20,\n" +
  "Room 101,water,2026-08-01,1230.00,280.00,2026-08,,2026-08-20,\n" +
  "Room 102,electric,2026-08-01,8712.00,2100.00,2026-08,MEP-123457,2026-08-20,\n" +
  "# unit_number must match exactly · utility = electric or water · reading = cumulative dial\n";

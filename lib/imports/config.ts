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

-- Expense voucher numbering + check number + editable particulars notes

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS check_number   text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voucher_number text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voucher_notes  text;

ALTER TABLE expense_settings ADD COLUMN IF NOT EXISTS voucher_prefix   text NOT NULL DEFAULT 'EV';
ALTER TABLE expense_settings ADD COLUMN IF NOT EXISTS voucher_seq_next int  NOT NULL DEFAULT 1;

-- Atomic: increment and return formatted voucher number in one statement
CREATE OR REPLACE FUNCTION next_voucher_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq    int;
  v_prefix text;
BEGIN
  UPDATE expense_settings
  SET    voucher_seq_next = voucher_seq_next + 1
  WHERE  id = 1
  RETURNING voucher_seq_next - 1, voucher_prefix
  INTO v_seq, v_prefix;

  RETURN v_prefix || '-' || LPAD(v_seq::text, 5, '0');
END;
$$;

"use client";

export function InactiveCheckbox({ checked }: { checked: boolean }) {
  return (
    <input
      type="checkbox"
      name="inactive"
      value="1"
      defaultChecked={checked}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="h-4 w-4 rounded border-stone-300 accent-amber-600"
    />
  );
}

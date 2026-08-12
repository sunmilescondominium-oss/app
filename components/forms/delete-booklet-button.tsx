"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBooklet } from "@/app/(app)/forms/actions";

export function DeleteBookletButton({ bookletId, bookletNo }: { bookletId: string; bookletNo: string }) {
  const [busy, start] = useTransition();
  const router = useRouter();

  function handle() {
    if (!window.confirm(`PERMANENTLY delete booklet ${bookletNo} and all its serials? This cannot be undone.`)) return;
    start(async () => {
      const res = await deleteBooklet(bookletId);
      if (!res.ok) { window.alert(res.error); return; }
      router.push("/forms");
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
    >
      {busy ? "Deleting…" : "🗑 Delete booklet"}
    </button>
  );
}

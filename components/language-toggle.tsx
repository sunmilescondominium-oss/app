"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGS, type Lang } from "@/lib/i18n";

/** EN / Filipino switch. Stores the choice in a cookie both server and client
 *  read, then refreshes so the page re-renders in the chosen language. Reads the
 *  current value from the cookie when `current` isn't supplied. */
export function LanguageToggle({ current }: { current?: Lang }) {
  const router = useRouter();
  const [cur, setCur] = useState<Lang>(current ?? "en");
  useEffect(() => {
    if (current) return;
    const m = document.cookie.match(/(?:^|; )lang=(en|fil)/);
    if (m) setCur(m[1] as Lang);
  }, [current]);

  function set(lang: Lang) {
    document.cookie = `lang=${lang}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setCur(lang);
    router.refresh();
  }
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-stone-300 text-xs font-semibold">
      {LANGS.map((l) => (
        <button
          key={l.key}
          type="button"
          onClick={() => set(l.key)}
          className={`px-2.5 py-1 ${cur === l.key ? "bg-amber-600 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}
        >
          {l.key === "en" ? "EN" : "FIL"}
        </button>
      ))}
    </div>
  );
}

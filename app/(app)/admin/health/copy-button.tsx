"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy diagnostics" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50 active:scale-95 transition-transform"
    >
      {copied ? "✅ Copied!" : `📋 ${label}`}
    </button>
  );
}

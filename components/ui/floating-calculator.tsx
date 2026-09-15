"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const STORAGE_KEY = "calc_pos";

type Op = "+" | "-" | "×" | "÷" | null;

function fmt(n: number): string {
  if (!isFinite(n)) return "Error";
  const s = n.toLocaleString("en-PH", { maximumFractionDigits: 10 });
  return s.length > 18 ? n.toPrecision(10) : s;
}

function compute(a: number, op: Op, b: number): number {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  if (op === "÷") return b === 0 ? NaN : a / b;
  return b;
}

export function FloatingCalculator() {
  // ── position & visibility ─────────────────────────────────────────────────
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 80 });

  // Restore saved position after mount (avoids SSR window access)
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) { setPos(JSON.parse(s)); return; }
    } catch { /* ignore */ }
    setPos({ x: Math.max(0, window.innerWidth - 260), y: 80 });
  }, []);
  const [minimized, setMinimized] = useState(false);
  const [visible, setVisible] = useState(true);

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const savePos = useCallback((p: { x: number; y: number }) => {
    setPos(p);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  }, []);

  // ── drag handlers ─────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !panelRef.current) return;
      const panel = panelRef.current;
      const maxX = window.innerWidth - panel.offsetWidth;
      const maxY = window.innerHeight - panel.offsetHeight;
      savePos({
        x: Math.max(0, Math.min(maxX, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(maxY, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [savePos]);

  // ── calculator state ──────────────────────────────────────────────────────
  const [display, setDisplay] = useState("0");
  const [pending, setPending] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [justEvaled, setJustEvaled] = useState(false);
  const [memory, setMemory] = useState(0);

  const current = parseFloat(display.replace(/,/g, "")) || 0;

  function digit(d: string) {
    if (justEvaled) { setDisplay(d); setJustEvaled(false); return; }
    setDisplay((prev) => {
      if (d === "." && prev.includes(".")) return prev;
      if (prev === "0" && d !== ".") return d;
      if (prev.replace(/[^0-9]/g, "").length >= 15) return prev;
      return prev + d;
    });
  }

  function setOperator(nextOp: Op) {
    if (pending !== null && op && !justEvaled) {
      const result = compute(pending, op, current);
      setPending(result);
      setDisplay(fmt(result));
    } else {
      setPending(current);
    }
    setOp(nextOp);
    setJustEvaled(true);
  }

  function evaluate() {
    if (pending === null || !op) return;
    const result = compute(pending, op, current);
    setDisplay(fmt(result));
    setPending(null);
    setOp(null);
    setJustEvaled(true);
  }

  function clear() { setDisplay("0"); setPending(null); setOp(null); setJustEvaled(false); }
  function clearEntry() { setDisplay("0"); setJustEvaled(false); }
  function backspace() {
    if (justEvaled) { clear(); return; }
    setDisplay((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
  }
  function toggleSign() { setDisplay((prev) => (prev.startsWith("-") ? prev.slice(1) : "-" + prev)); }
  function percent() { setDisplay(fmt(current / 100)); }

  function mPlus() { setMemory((m) => m + current); }
  function mMinus() { setMemory((m) => m - current); }
  function mRecall() { setDisplay(fmt(memory)); setJustEvaled(true); }
  function mClear() { setMemory(0); }

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="no-print fixed z-[9999] rounded-full bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-lg hover:bg-amber-700"
        style={{ right: 16, bottom: 20 }}
        title="Open calculator"
      >
        🧮
      </button>
    );
  }

  const btn = (label: string, onClick: () => void, variant: "num" | "op" | "fn" | "eq" | "mem" = "num") => {
    const base = "flex items-center justify-center rounded-lg text-sm font-semibold select-none active:scale-95 transition-transform cursor-pointer h-9";
    const cls: Record<typeof variant, string> = {
      num: `${base} bg-stone-100 hover:bg-stone-200 text-stone-800`,
      op:  `${base} bg-amber-500 hover:bg-amber-600 text-white`,
      fn:  `${base} bg-stone-300 hover:bg-stone-400 text-stone-800`,
      eq:  `${base} bg-emerald-600 hover:bg-emerald-700 text-white col-span-2`,
      mem: `${base} bg-stone-200 hover:bg-stone-300 text-stone-600 text-xs`,
    };
    return (
      <button key={label} onClick={onClick} className={cls[variant]}>
        {label}
      </button>
    );
  };

  return (
    <div
      ref={panelRef}
      className="no-print fixed z-[9999] select-none rounded-2xl shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: 232 }}
    >
      {/* Title bar */}
      <div
        onMouseDown={onMouseDown}
        className="flex cursor-grab items-center justify-between rounded-t-2xl bg-stone-800 px-3 py-2 active:cursor-grabbing"
      >
        <span className="text-xs font-semibold text-stone-300">🧮 Calculator</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setMinimized((v) => !v)}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-amber-900 hover:bg-amber-300"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? "▲" : "▼"}
          </button>
          <button
            onClick={() => setVisible(false)}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-400 text-[9px] font-bold text-white hover:bg-rose-300"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <div className="rounded-b-2xl bg-stone-50 p-2 shadow-inner">
          {/* Display */}
          <div className="mb-2 rounded-xl bg-stone-900 px-3 py-2 text-right">
            <div className="h-4 text-right text-[10px] text-stone-500">
              {pending !== null ? `${fmt(pending)} ${op ?? ""}` : " "}
            </div>
            <div
              className="mt-0.5 truncate text-right font-mono text-xl font-bold text-emerald-400 tabular-nums"
              title={display}
            >
              {display}
            </div>
            {memory !== 0 && (
              <div className="text-right text-[10px] text-amber-400">M: {fmt(memory)}</div>
            )}
          </div>

          {/* Memory row */}
          <div className="mb-1.5 grid grid-cols-4 gap-1">
            {btn("MC", mClear, "mem")}
            {btn("MR", mRecall, "mem")}
            {btn("M−", mMinus, "mem")}
            {btn("M+", mPlus, "mem")}
          </div>

          {/* Buttons grid */}
          <div className="grid grid-cols-4 gap-1">
            {btn("AC",  clear,        "fn")}
            {btn("CE",  clearEntry,   "fn")}
            {btn("⌫",   backspace,    "fn")}
            {btn("÷",   () => setOperator("÷"), "op")}

            {btn("7",   () => digit("7"))}
            {btn("8",   () => digit("8"))}
            {btn("9",   () => digit("9"))}
            {btn("×",   () => setOperator("×"), "op")}

            {btn("4",   () => digit("4"))}
            {btn("5",   () => digit("5"))}
            {btn("6",   () => digit("6"))}
            {btn("−",   () => setOperator("-"), "op")}

            {btn("1",   () => digit("1"))}
            {btn("2",   () => digit("2"))}
            {btn("3",   () => digit("3"))}
            {btn("+",   () => setOperator("+"), "op")}

            {btn("+/−", toggleSign,   "fn")}
            {btn("0",   () => digit("0"))}
            {btn(".",   () => digit("."))}
            {btn("=",   evaluate,     "eq")}
          </div>
        </div>
      )}
    </div>
  );
}

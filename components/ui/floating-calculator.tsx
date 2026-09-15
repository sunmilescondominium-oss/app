"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const POS_KEY  = "calc_pos";
const OPEN_KEY = "calc_open";

type Op = "+" | "-" | "×" | "÷" | null;

/** Format a computed result number for display */
function fmt(n: number): string {
  if (!isFinite(n)) return "Error";
  const s = n.toLocaleString("en-PH", { maximumFractionDigits: 10 });
  return s.length > 16 ? n.toPrecision(10) : s;
}

/**
 * Format a raw digit string (e.g. "1234567.89") with commas on the integer
 * part for the live display — keeps the decimal portion unformatted so the
 * user can still type freely.
 */
function fmtDisplay(raw: string): string {
  if (raw === "Error") return raw;
  const neg = raw.startsWith("-");
  const abs = neg ? raw.slice(1) : raw;
  const dotIdx = abs.indexOf(".");
  const intPart = dotIdx >= 0 ? abs.slice(0, dotIdx) : abs;
  const decPart = dotIdx >= 0 ? abs.slice(dotIdx) : "";   // includes the "."
  const intNum  = parseInt(intPart || "0", 10);
  const intFmt  = isNaN(intNum) ? intPart : intNum.toLocaleString("en-PH");
  return (neg ? "-" : "") + intFmt + decPart;
}

function compute(a: number, op: Op, b: number): number {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  if (op === "÷") return b === 0 ? NaN : a / b;
  return b;
}

export function FloatingCalculator() {
  // ── mount guard ───────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  const [pos,  setPos]  = useState({ x: 0, y: 0 });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let x = window.innerWidth - 220, y = window.innerHeight - 64;
    try { const s = localStorage.getItem(POS_KEY); if (s) { const p = JSON.parse(s); x = p.x; y = p.y; } } catch { /* ignore */ }
    let wasOpen = false;
    try { wasOpen = localStorage.getItem(OPEN_KEY) === "1"; } catch { /* ignore */ }
    setPos({ x, y });
    setOpen(wasOpen);
    setMounted(true);
  }, []);

  const savePos = useCallback((p: { x: number; y: number }) => {
    setPos(p);
    try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  }, []);

  const toggleOpen = useCallback((v: boolean) => {
    setOpen(v);
    try { localStorage.setItem(OPEN_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  }, []);

  // ── drag ──────────────────────────────────────────────────────────────────
  const dragging   = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const didDrag    = useRef(false);
  const panelRef   = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button,input,textarea")) return;
    dragging.current = true;
    didDrag.current  = false;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !panelRef.current) return;
      didDrag.current = true;
      const panel = panelRef.current;
      const maxX  = window.innerWidth  - panel.offsetWidth;
      const maxY  = window.innerHeight - panel.offsetHeight;
      savePos({
        x: Math.max(0, Math.min(maxX, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(maxY, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [savePos]);

  // ── Alt+C global toggle (always active, even when focus is in a form) ─────
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          try { localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch { /* ignore */ }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted]);

  // ── calculator state ──────────────────────────────────────────────────────
  const [display,    setDisplay]    = useState("0");
  const [pending,    setPending]    = useState<number | null>(null);
  const [op,         setOp]         = useState<Op>(null);
  const [justEvaled, setJustEvaled] = useState(false);
  const [memory,     setMemory]     = useState(0);

  const current = parseFloat(display.replace(/,/g, "")) || 0;

  function digit(d: string) {
    if (justEvaled) { setDisplay(d); setJustEvaled(false); return; }
    setDisplay((prev) => {
      if (d === "." && prev.includes(".")) return prev;
      if (prev === "0" && d !== ".") return d;
      if (prev.replace(/[^0-9]/g, "").length >= 14) return prev;
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

  function clear()      { setDisplay("0"); setPending(null); setOp(null); setJustEvaled(false); }
  function clearEntry() { setDisplay("0"); setJustEvaled(false); }
  function backspace()  {
    if (justEvaled) { clear(); return; }
    setDisplay((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
  }
  function toggleSign() { setDisplay((prev) => (prev.startsWith("-") ? prev.slice(1) : prev === "0" ? "0" : "-" + prev)); }
  function percent()    { setDisplay(fmt(current / 100)); }

  // ── calculator keyboard (only when expanded, not in form fields) ──────────
  const digitRef      = useRef(digit);
  const setOpRef      = useRef(setOperator);
  const evaluateRef   = useRef(evaluate);
  const clearRef      = useRef(clear);
  const backspaceRef  = useRef(backspace);
  const toggleSignRef = useRef(toggleSign);
  const percentRef    = useRef(percent);
  digitRef.current      = digit;
  setOpRef.current      = setOperator;
  evaluateRef.current   = evaluate;
  clearRef.current      = clear;
  backspaceRef.current  = backspace;
  toggleSignRef.current = toggleSign;
  percentRef.current    = percent;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Skip if Alt+C (handled by the global toggle above)
      if (e.altKey && e.key.toLowerCase() === "c") return;
      // Skip if focus is in a page form field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const k = e.key;
      if (k >= "0" && k <= "9")        { digitRef.current(k);        e.preventDefault(); return; }
      if (k === ".")                   { digitRef.current(".");       e.preventDefault(); return; }
      if (k === "+")                   { setOpRef.current("+");       e.preventDefault(); return; }
      if (k === "-")                   { setOpRef.current("-");       e.preventDefault(); return; }
      if (k === "*")                   { setOpRef.current("×");       e.preventDefault(); return; }
      if (k === "/")                   { setOpRef.current("÷");       e.preventDefault(); return; }
      if (k === "Enter" || k === "=")  { evaluateRef.current();       e.preventDefault(); return; }
      if (k === "Backspace")           { backspaceRef.current();      e.preventDefault(); return; }
      if (k === "Escape" || k === "Delete") { clearRef.current();     e.preventDefault(); return; }
      if (k === "%")                   { percentRef.current();        e.preventDefault(); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ── nothing until hydrated ────────────────────────────────────────────────
  if (!mounted) return null;

  // ── Pill (minimised) ──────────────────────────────────────────────────────
  if (!open) {
    return (
      <div ref={panelRef} className="no-print fixed z-[9999]" style={{ left: pos.x, top: pos.y }}>
        <div
          onMouseDown={onMouseDown}
          onClick={() => { if (!didDrag.current) toggleOpen(true); }}
          className="flex cursor-pointer items-center gap-2 rounded-full bg-stone-800 px-4 py-2 shadow-xl ring-1 ring-white/10 hover:bg-stone-700 active:scale-95 transition-transform select-none"
          title="Open calculator (Alt+C)"
        >
          <span className="text-base leading-none">🧮</span>
          <span className="text-xs font-semibold text-stone-200 whitespace-nowrap">Calc</span>
          {memory !== 0 && (
            <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">M</span>
          )}
        </div>
      </div>
    );
  }

  // ── Full panel (expanded) ─────────────────────────────────────────────────
  const Btn = ({
    label, onClick, variant = "num",
  }: {
    label: string;
    onClick: () => void;
    variant?: "num" | "op" | "fn" | "eq" | "mem";
  }) => {
    const base = "flex items-center justify-center rounded-xl text-sm font-semibold select-none active:scale-95 transition-transform cursor-pointer h-10";
    const cls: Record<string, string> = {
      num: `${base} bg-stone-100 hover:bg-stone-200 text-stone-800`,
      op:  `${base} bg-amber-500 hover:bg-amber-400 text-white`,
      fn:  `${base} bg-stone-300 hover:bg-stone-400 text-stone-700`,
      eq:  `${base} bg-emerald-600 hover:bg-emerald-500 text-white col-span-2`,
      mem: `${base} bg-stone-200 hover:bg-stone-300 text-stone-500 text-[11px]`,
    };
    return <button onClick={onClick} className={cls[variant]}>{label}</button>;
  };

  return (
    <div
      ref={panelRef}
      className="no-print fixed z-[9999] rounded-2xl shadow-2xl overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: 240 }}
    >
      {/* Title bar — drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="flex cursor-grab items-center justify-between bg-stone-800 px-3 py-2.5 active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🧮</span>
          <span className="text-xs font-semibold text-stone-300">Calculator</span>
          <span className="text-[9px] text-stone-500">Alt+C</span>
        </div>
        <button
          onClick={() => toggleOpen(false)}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-600 hover:bg-stone-500 text-stone-300 hover:text-white text-[10px] transition-colors"
          title="Minimise to pill (Alt+C)"
        >
          ─
        </button>
      </div>

      {/* Calculator body */}
      <div className="bg-stone-50 p-2.5">
        {/* Display */}
        <div className="mb-2.5 rounded-xl bg-stone-900 px-3 pt-2 pb-2.5">
          <div className="text-right text-[10px] text-stone-500 h-4 leading-none">
            {pending !== null ? `${fmt(pending)} ${op ?? ""}` : " "}
          </div>
          <div
            className="mt-1 truncate text-right font-mono text-2xl font-bold text-emerald-400 tabular-nums leading-none"
            title={display}
          >
            {fmtDisplay(display)}
          </div>
          {memory !== 0 && (
            <div className="mt-1 text-right text-[10px] text-amber-400 leading-none">
              M: {fmt(memory)}
            </div>
          )}
        </div>

        {/* Memory row */}
        <div className="mb-1.5 grid grid-cols-4 gap-1">
          <Btn label="MC" onClick={() => setMemory(0)}                                       variant="mem" />
          <Btn label="MR" onClick={() => { setDisplay(fmt(memory)); setJustEvaled(true); }}  variant="mem" />
          <Btn label="M−" onClick={() => setMemory((m) => m - current)}                      variant="mem" />
          <Btn label="M+" onClick={() => setMemory((m) => m + current)}                      variant="mem" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-4 gap-1">
          <Btn label="AC"  onClick={clear}                         variant="fn" />
          <Btn label="CE"  onClick={clearEntry}                    variant="fn" />
          <Btn label="⌫"   onClick={backspace}                     variant="fn" />
          <Btn label="÷"   onClick={() => setOperator("÷")}        variant="op" />

          <Btn label="7"   onClick={() => digit("7")} />
          <Btn label="8"   onClick={() => digit("8")} />
          <Btn label="9"   onClick={() => digit("9")} />
          <Btn label="×"   onClick={() => setOperator("×")}        variant="op" />

          <Btn label="4"   onClick={() => digit("4")} />
          <Btn label="5"   onClick={() => digit("5")} />
          <Btn label="6"   onClick={() => digit("6")} />
          <Btn label="−"   onClick={() => setOperator("-")}        variant="op" />

          <Btn label="1"   onClick={() => digit("1")} />
          <Btn label="2"   onClick={() => digit("2")} />
          <Btn label="3"   onClick={() => digit("3")} />
          <Btn label="+"   onClick={() => setOperator("+")}        variant="op" />

          <Btn label="+/−" onClick={toggleSign}                    variant="fn" />
          <Btn label="0"   onClick={() => digit("0")} />
          <Btn label="."   onClick={() => digit(".")} />
          <Btn label="="   onClick={evaluate}                      variant="eq" />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Per-browser column control for any server- or client-rendered <table> inside
 * the wrapped subtree. Users can hide/show columns, drag to reorder them, and
 * drag a column's right edge to resize its width. The layout is remembered in
 * localStorage under `storageKey`.
 *
 * It works purely on the DOM: every header/data cell is tagged with its original
 * column index (data-col); whole cells are re-appended in the chosen order and
 * `display:none`-hidden; header cells get an explicit width (table-layout:fixed).
 * React never reorders cells within a row, so moving them is safe, and the resize
 * handles live inside the wrapper (never injected into the table), so the table's
 * own DOM is only ever touched via style. A MutationObserver re-applies the layout
 * after a server refresh swaps the rows.
 */

type Saved = { order: number[]; hidden: number[]; widths?: Record<number, number> };
type Handle = { col: number; left: number; top: number; height: number };

function tagCells(table: HTMLTableElement): number {
  const head = table.tHead?.rows[0];
  if (!head) return 0;
  const n = head.cells.length;
  Array.from(head.cells).forEach((c, i) => { if (c.dataset.col == null) c.dataset.col = String(i); });
  Array.from(table.tBodies).forEach((b) =>
    Array.from(b.rows).forEach((r) => {
      if (r.cells.length !== n) return; // skip colspan placeholder rows
      Array.from(r.cells).forEach((c, i) => { if (c.dataset.col == null) c.dataset.col = String(i); });
    }),
  );
  return n;
}

function applyLayout(table: HTMLTableElement, order: number[], hidden: Set<number>, widths: Record<number, number>) {
  const n = order.length;
  const rows: HTMLTableRowElement[] = [];
  if (table.tHead?.rows[0]) rows.push(table.tHead.rows[0]);
  Array.from(table.tBodies).forEach((b) =>
    Array.from(b.rows).forEach((r) => { if (r.cells.length === n) rows.push(r); }),
  );
  rows.forEach((row) => {
    const byCol: Record<string, HTMLTableCellElement> = {};
    Array.from(row.cells).forEach((c) => { if (c.dataset.col != null) byCol[c.dataset.col] = c; });
    order.forEach((col) => {
      const cell = byCol[String(col)];
      if (!cell) return;
      cell.style.display = hidden.has(col) ? "none" : "";
      row.appendChild(cell); // move into place
    });
  });

  const hasWidths = Object.keys(widths).length > 0;
  table.style.tableLayout = hasWidths ? "fixed" : "";
  if (table.tHead?.rows[0]) {
    Array.from(table.tHead.rows[0].cells).forEach((th) => {
      const col = Number(th.dataset.col);
      const w = widths[col];
      (th as HTMLElement).style.width = w ? `${w}px` : "";
    });
  }
}

export function AdjustableColumns({
  storageKey,
  children,
  align = "right",
}: {
  storageKey: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [widths, setWidths] = useState<Record<number, number>>({});
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [handles, setHandles] = useState<Handle[]>([]);
  const key = `cols:${storageKey}`;

  const getTable = () => wrapRef.current?.querySelector("table") as HTMLTableElement | null;

  const recomputeHandles = useCallback(() => {
    const table = getTable();
    const wrap = wrapRef.current;
    if (!table?.tHead?.rows[0] || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const hs: Handle[] = [];
    Array.from(table.tHead.rows[0].cells).forEach((th) => {
      if ((th as HTMLElement).style.display === "none") return;
      const r = th.getBoundingClientRect();
      hs.push({ col: Number(th.dataset.col), left: r.right - wrapRect.left, top: r.top - wrapRect.top, height: r.height });
    });
    setHandles(hs);
  }, []);

  // Read the table once, load any saved layout, reconcile with current columns.
  useEffect(() => {
    const table = getTable();
    if (!table) return;
    const n = tagCells(table);
    if (n === 0) return;
    const labs = Array.from(table.tHead!.rows[0].cells)
      .sort((a, b) => Number(a.dataset.col) - Number(b.dataset.col))
      .map((c, i) => (c.textContent ?? "").trim() || `Column ${i + 1}`);

    let ord = Array.from({ length: n }, (_, i) => i);
    let hid: number[] = [];
    let wid: Record<number, number> = {};
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw) as Saved;
        const ok = (x: number) => Number.isInteger(x) && x >= 0 && x < n;
        const kept = p.order.filter(ok);
        ord = [...kept, ...ord.filter((i) => !kept.includes(i))];
        hid = (p.hidden ?? []).filter(ok);
        if (p.widths) for (const [k, v] of Object.entries(p.widths)) if (ok(Number(k)) && Number(v) > 0) wid[Number(k)] = Number(v);
      }
    } catch { /* ignore bad storage */ }
    setLabels(labs);
    setOrder(ord);
    setHidden(new Set(hid));
    setWidths(wid);
    setReady(true);
  }, [key]);

  // Apply + persist whenever the layout changes; re-apply after row refreshes.
  useEffect(() => {
    if (!ready) return;
    const table = getTable();
    if (!table) return;
    const tbody = table.tBodies[0];
    let obs: MutationObserver | null = null;
    const reapply = () => {
      obs?.disconnect();
      tagCells(table);
      applyLayout(table, order, hidden, widths);
      recomputeHandles();
      if (tbody) obs?.observe(tbody, { childList: true });
    };
    if (tbody) obs = new MutationObserver(reapply);
    reapply();
    try { localStorage.setItem(key, JSON.stringify({ order, hidden: [...hidden], widths })); } catch { /* ignore */ }

    const onResize = () => recomputeHandles();
    window.addEventListener("resize", onResize);
    const wrap = wrapRef.current;
    wrap?.addEventListener("scroll", onResize, true); // capture inner .table-wrap scroll
    return () => { obs?.disconnect(); window.removeEventListener("resize", onResize); wrap?.removeEventListener("scroll", onResize, true); };
  }, [ready, order, hidden, widths, key, recomputeHandles]);

  function toggle(col: number) {
    setHidden((h) => {
      const s = new Set(h);
      if (s.has(col)) s.delete(col);
      else if (s.size < order.length - 1) s.add(col); // keep ≥1 visible
      return s;
    });
  }

  function moveTo(from: number, to: number) {
    if (from === to) return;
    setOrder((o) => {
      const a = [...o];
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
      return a;
    });
  }

  function reset() {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    const table = getTable();
    if (table) table.style.tableLayout = "";
    setOrder(labels.map((_, i) => i));
    setHidden(new Set());
    setWidths({});
  }

  // Start a width drag on a column's right edge.
  function startResize(col: number, e: React.MouseEvent) {
    e.preventDefault();
    const table = getTable();
    const head = table?.tHead?.rows[0];
    if (!table || !head) return;
    // Freeze current widths of all visible columns so only this one changes.
    const frozen: Record<number, number> = { ...widths };
    Array.from(head.cells).forEach((th) => {
      if ((th as HTMLElement).style.display === "none") return;
      const c = Number(th.dataset.col);
      if (!frozen[c]) frozen[c] = th.getBoundingClientRect().width;
    });
    const th = Array.from(head.cells).find((c) => Number(c.dataset.col) === col) as HTMLElement | undefined;
    if (!th) return;
    table.style.tableLayout = "fixed";
    const startX = e.clientX;
    const startW = frozen[col];

    const onMove = (ev: MouseEvent) => {
      const w = Math.max(48, Math.round(startW + (ev.clientX - startX)));
      th.style.width = `${w}px`;
      frozen[col] = w;
      recomputeHandles();
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setWidths({ ...frozen });
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const dirty = ready && (order.some((c, i) => c !== i) || hidden.size > 0 || Object.keys(widths).length > 0);

  return (
    <div ref={wrapRef} className="relative">
      {ready && labels.length > 1 && (
        <div className={`relative mb-2 flex ${align === "right" ? "justify-end" : "justify-start"}`}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            ⚙ Columns{dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-9 z-20 w-64 rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
                <p className="px-2 pb-1.5 pt-1 text-[11px] uppercase tracking-wide text-stone-400">
                  Drag ⠿ to reorder · toggle to show/hide · drag a column edge to resize
                </p>
                <ul className="max-h-72 overflow-auto">
                  {order.map((col, pos) => (
                    <li
                      key={col}
                      draggable
                      onDragStart={() => setDrag(pos)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { if (drag != null) moveTo(drag, pos); setDrag(null); }}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${drag === pos ? "bg-amber-50" : "hover:bg-stone-50"}`}
                    >
                      <span className="cursor-grab select-none text-stone-300" title="Drag to reorder">⠿</span>
                      <label className="flex flex-1 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!hidden.has(col)}
                          onChange={() => toggle(col)}
                          className="accent-amber-600"
                        />
                        <span className={hidden.has(col) ? "text-stone-400 line-through" : "text-stone-700"}>
                          {labels[col]}
                        </span>
                      </label>
                      <span className="flex flex-col leading-none">
                        <button type="button" onClick={() => moveTo(pos, Math.max(0, pos - 1))} disabled={pos === 0} className="text-[10px] text-stone-400 hover:text-stone-700 disabled:opacity-30" aria-label="Move up">▲</button>
                        <button type="button" onClick={() => moveTo(pos, Math.min(order.length - 1, pos + 1))} disabled={pos === order.length - 1} className="text-[10px] text-stone-400 hover:text-stone-700 disabled:opacity-30" aria-label="Move down">▼</button>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-1 flex justify-between border-t border-stone-100 px-2 pt-2">
                  <button type="button" onClick={reset} className="text-xs text-stone-500 hover:text-stone-800">Reset</button>
                  <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-amber-700 hover:underline">Done</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {children}

      {/* Width-resize handles, positioned over each visible header's right edge. */}
      {ready && handles.map((h) => (
        <div
          key={h.col}
          onMouseDown={(e) => startResize(h.col, e)}
          title="Drag to resize column"
          className="absolute z-[5] w-1.5 cursor-col-resize hover:bg-amber-300/60"
          style={{ left: h.left - 3, top: h.top, height: h.height }}
        />
      ))}
    </div>
  );
}

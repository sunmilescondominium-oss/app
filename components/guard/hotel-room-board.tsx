"use client";

import { useState, useEffect, useTransition } from "react";
import {
  fetchGuardRooms,
  confirmGuestEntry,
  acknowledgeTransfer,
  confirmGuestExit,
  reportAdditionalPerson,
  confirmAdditionalEntry,
  raiseUnauthorizedEntry,
  type GuardRoomCard,
} from "@/app/(app)/guard/hotel-room-actions";
import type { PersonEventCard } from "@/lib/guard/queries";

function formatManila(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

function expectedCheckout(checkInAt: string, plannedHours: number): Date {
  return new Date(new Date(checkInAt).getTime() + plannedHours * 3_600_000);
}

function timeLabel(target: Date): { label: string; overdue: boolean } {
  const diff = target.getTime() - Date.now();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return { label: overdue ? `${label} overdue` : `${label} left`, overdue };
}

function EntryBadge({ room }: { room: GuardRoomCard }) {
  if (room.guardEntryConfirmed) {
    const all = room.guardEntryCount !== null && room.guardEntryCount >= room.guestCount;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        {all
          ? `✓ All ${room.guestCount} confirmed in`
          : `✓ ${room.guardEntryCount ?? "?"} of ${room.guestCount} inside`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      ⏳ Awaiting entry confirmation
    </span>
  );
}

function PersonEventRow({
  ev,
  onRefresh,
}: {
  ev: PersonEventCard;
  onRefresh: () => void;
}) {
  const [busy, start] = useTransition();

  function handleConfirm() {
    start(async () => {
      await confirmAdditionalEntry(ev.id, ev.personCount);
      onRefresh();
    });
  }

  if (ev.entryConfirmedAt) {
    return (
      <li className="text-xs text-green-700">
        ✓ +{ev.personCount} person{ev.personCount !== 1 ? "s" : ""} entered & confirmed
      </li>
    );
  }
  if (ev.feeAuthorizedAt) {
    return (
      <li className="flex items-center justify-between gap-2">
        <span className="text-xs text-blue-700">
          ✓ Fee collected — +{ev.personCount} may enter
        </span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "…" : "Confirm Entry"}
        </button>
      </li>
    );
  }
  return (
    <li className="text-xs text-amber-700">
      ⏳ +{ev.personCount} person{ev.personCount !== 1 ? "s" : ""} waiting — cashier collecting fee
    </li>
  );
}

function RoomCard({
  room,
  onRefresh,
}: {
  room: GuardRoomCard;
  onRefresh: () => void;
}) {
  const [confirmingEntry, setConfirmingEntry] = useState(false);
  const [entryInput, setEntryInput] = useState(String(room.guestCount));
  const [reportingExtra, setReportingExtra] = useState(false);
  const [extraInput, setExtraInput] = useState("1");
  const [reportingUnauthorized, setReportingUnauthorized] = useState(false);
  const [unauthorizedNote, setUnauthorizedNote] = useState("");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");

  const checkout = expectedCheckout(room.checkInAt, room.plannedHours);
  const { label: timeLeft, overdue } = timeLabel(checkout);
  const isGatePassIssued = room.status === "checked_out";

  function handleConfirmEntry() {
    setError("");
    const count = parseInt(entryInput, 10);
    if (!Number.isFinite(count) || count < 0) {
      setError("Enter a valid number.");
      return;
    }
    startTransition(async () => {
      const result = await confirmGuestEntry(room.stayId, count);
      if (!result.ok) { setError(result.error); return; }
      setConfirmingEntry(false);
      onRefresh();
    });
  }

  function handleAcknowledgeTransfer() {
    if (!room.transferId) return;
    setError("");
    startTransition(async () => {
      const result = await acknowledgeTransfer(room.transferId!);
      if (!result.ok) { setError(result.error); return; }
      onRefresh();
    });
  }

  function handleConfirmExit() {
    setError("");
    startTransition(async () => {
      const result = await confirmGuestExit(room.stayId);
      if (!result.ok) { setError(result.error); return; }
      onRefresh();
    });
  }

  function handleReportUnauthorized() {
    setError("");
    startTransition(async () => {
      const result = await raiseUnauthorizedEntry(room.stayId, unauthorizedNote);
      if (!result.ok) { setError(result.error); return; }
      setReportingUnauthorized(false);
      setUnauthorizedNote("");
      onRefresh();
    });
  }

  function handleReportExtra() {
    setError("");
    const count = parseInt(extraInput, 10);
    if (!Number.isFinite(count) || count < 1) {
      setError("Enter a valid person count.");
      return;
    }
    startTransition(async () => {
      const result = await reportAdditionalPerson(room.stayId, count);
      if (!result.ok) { setError(result.error); return; }
      setReportingExtra(false);
      setExtraInput("1");
      onRefresh();
    });
  }

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm ${
        isGatePassIssued
          ? "border-blue-200"
          : overdue
          ? "border-red-200"
          : "border-stone-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-stone-800">Room {room.unitNumber}</span>
            {room.fromPreviousShift && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
                Carried over
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-stone-600">{room.guestLabel}</p>
        </div>
        <div className="text-right">
          <span
            className={`text-xs font-semibold ${
              overdue ? "text-red-600" : "text-stone-500"
            }`}
          >
            {overdue ? "⚠ " : ""}
            {timeLeft}
          </span>
          <p className="text-[10px] text-stone-400">
            Out: {formatManila(checkout.toISOString())}
          </p>
        </div>
      </div>

      {/* Guest count */}
      <div className="px-4 pb-2">
        <span className="text-xs text-stone-500">
          {room.guestCount} guest{room.guestCount !== 1 ? "s" : ""} declared
          {room.extraPersons > 0 ? ` · ${room.extraPersons} extra charged` : ""}
        </span>
      </div>

      {/* Entry status */}
      <div className="border-t border-stone-100 px-4 py-3 space-y-2">
        <EntryBadge room={room} />

        {!room.guardEntryConfirmed && !confirmingEntry && !isGatePassIssued && (
          <button
            type="button"
            onClick={() => setConfirmingEntry(true)}
            className="block text-xs font-medium text-amber-700 hover:text-amber-900 underline"
          >
            Confirm entry
          </button>
        )}

        {confirmingEntry && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-600">Persons entered:</span>
            <input
              type="number"
              min={0}
              max={20}
              value={entryInput}
              onChange={(e) => setEntryInput(e.target.value)}
              className="w-16 rounded border border-stone-300 px-2 py-1 text-sm text-center"
            />
            <button
              type="button"
              onClick={handleConfirmEntry}
              disabled={busy}
              className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingEntry(false)}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Additional persons section */}
      {(room.pendingPersonEvents.length > 0 || room.readyToEnterEvents.length > 0 || room.status === "active") && (
        <div className="border-t border-stone-100 px-4 py-3 space-y-2">
          {(room.pendingPersonEvents.length > 0 || room.readyToEnterEvents.length > 0) && (
            <ul className="space-y-1.5">
              {room.pendingPersonEvents.map((ev) => (
                <PersonEventRow key={ev.id} ev={ev} onRefresh={onRefresh} />
              ))}
              {room.readyToEnterEvents.map((ev) => (
                <PersonEventRow key={ev.id} ev={ev} onRefresh={onRefresh} />
              ))}
            </ul>
          )}

          {room.status === "active" && !reportingExtra && (
            <button
              type="button"
              onClick={() => setReportingExtra(true)}
              className="text-xs font-medium text-rose-700 hover:text-rose-900 underline"
            >
              + Additional person at gate
            </button>
          )}

          {reportingExtra && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-600">How many:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={extraInput}
                onChange={(e) => setExtraInput(e.target.value)}
                className="w-16 rounded border border-stone-300 px-2 py-1 text-sm text-center"
              />
              <button
                type="button"
                onClick={handleReportExtra}
                disabled={busy}
                className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? "…" : "Report"}
              </button>
              <button
                type="button"
                onClick={() => setReportingExtra(false)}
                className="text-xs text-stone-400 hover:text-stone-600"
              >
                Cancel
              </button>
            </div>
          )}

          {room.status === "active" && !reportingUnauthorized && (
            <button
              type="button"
              onClick={() => setReportingUnauthorized(true)}
              className="text-xs font-medium text-red-700 hover:text-red-900 underline"
            >
              ⚠ Report unauthorized entry
            </button>
          )}

          {reportingUnauthorized && (
            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="Note (optional)"
                value={unauthorizedNote}
                onChange={(e) => setUnauthorizedNote(e.target.value)}
                className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReportUnauthorized}
                  disabled={busy}
                  className="rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {busy ? "…" : "Submit Alert"}
                </button>
                <button
                  type="button"
                  onClick={() => { setReportingUnauthorized(false); setUnauthorizedNote(""); }}
                  className="text-xs text-stone-400 hover:text-stone-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transfer badge */}
      {room.transferId && (
        <div className="border-t border-stone-100 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-medium text-blue-700">
                🔄 Transferred from Room {room.transferFromUnit ?? "—"}
              </span>
              {room.transferAt && (
                <span className="ml-1 text-[10px] text-stone-400">
                  at {formatManila(room.transferAt)}
                </span>
              )}
            </div>
            {!room.transferGuardAcknowledged && (
              <button
                type="button"
                onClick={handleAcknowledgeTransfer}
                disabled={busy}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                {busy ? "…" : "Acknowledge"}
              </button>
            )}
            {room.transferGuardAcknowledged && (
              <span className="text-xs text-green-700">✓ Acknowledged</span>
            )}
          </div>
        </div>
      )}

      {/* Gate pass / exit confirmation */}
      {isGatePassIssued && (
        <div className="border-t border-blue-100 bg-blue-50 px-4 py-3 rounded-b-xl">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-blue-800">
              Gate pass issued — verify receipt & allow exit
            </p>
            {!room.guardExitConfirmed && (
              <button
                type="button"
                onClick={handleConfirmExit}
                disabled={busy}
                className="rounded bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
              >
                {busy ? "…" : "Confirm Exit"}
              </button>
            )}
            {room.guardExitConfirmed && (
              <span className="text-xs text-green-700">✓ Exit confirmed</span>
            )}
          </div>
          {room.guardExitConfirmedAt && (
            <p className="mt-0.5 text-[10px] text-blue-600">
              Confirmed at {formatManila(room.guardExitConfirmedAt)}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="px-4 pb-3 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

export function HotelRoomBoard({
  initialRooms,
  shiftStartedAt,
}: {
  initialRooms: GuardRoomCard[];
  shiftStartedAt?: string;
}) {
  const [rooms, setRooms] = useState<GuardRoomCard[]>(initialRooms);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      try {
        const fresh = await fetchGuardRooms(shiftStartedAt);
        setRooms(fresh);
        setLastRefresh(new Date());
      } catch {
        // network hiccup — keep stale data
      }
    });
  }

  // Auto-refresh every 30 s
  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftStartedAt]);

  const active = rooms.filter((r) => r.status === "active");
  const pendingExit = rooms.filter((r) => r.status === "checked_out");

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-stone-700">
            {rooms.length} occupied room{rooms.length !== 1 ? "s" : ""}
          </span>
          {pendingExit.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {pendingExit.length} gate pass pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-stone-400">
            Updated {lastRefresh.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            {isRefreshing ? "Refreshing…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {rooms.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">
          No occupied rooms right now.
        </div>
      )}

      {/* Gate pass pending — show first */}
      {pendingExit.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Gate pass issued — confirm exit
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingExit.map((room) => (
              <RoomCard key={room.stayId} room={room} onRefresh={refresh} />
            ))}
          </div>
        </div>
      )}

      {/* Active rooms */}
      {active.length > 0 && (
        <div className="space-y-2">
          {pendingExit.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Active rooms
            </h3>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((room) => (
              <RoomCard key={room.stayId} room={room} onRefresh={refresh} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

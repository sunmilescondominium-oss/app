"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { authorizeGateEntry } from "@/app/(app)/hotel/actions";

interface PersonEvent {
  id: string;
  personCount: number;
  feeAuthorizedAt: string | null;
  entryConfirmedAt: string | null;
  createdAt: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventRow({
  ev,
  canAuthorize,
}: {
  ev: PersonEvent;
  canAuthorize: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function authorize() {
    start(async () => {
      const res = await authorizeGateEntry(ev.id);
      if (res.ok) router.refresh();
    });
  }

  const statusLabel = ev.entryConfirmedAt
    ? `✓ Guard confirmed entry at ${formatTime(ev.entryConfirmedAt)}`
    : ev.feeAuthorizedAt
    ? `✓ Authorized at ${formatTime(ev.feeAuthorizedAt)} — guard confirming entry`
    : `⏳ Waiting for authorization`;

  const statusColor = ev.entryConfirmedAt
    ? "text-green-700"
    : ev.feeAuthorizedAt
    ? "text-blue-700"
    : "text-amber-700";

  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <div>
        <span className="text-sm font-medium text-stone-700">
          +{ev.personCount} person{ev.personCount !== 1 ? "s" : ""}
        </span>
        <span className="ml-2 text-xs text-stone-400">
          reported {formatTime(ev.createdAt)}
        </span>
        <p className={`text-xs ${statusColor}`}>{statusLabel}</p>
      </div>
      {canAuthorize && !ev.feeAuthorizedAt && !ev.entryConfirmedAt && (
        <button
          type="button"
          onClick={authorize}
          disabled={pending}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 whitespace-nowrap"
        >
          {pending ? "Saving…" : "Authorize Entry"}
        </button>
      )}
    </li>
  );
}

export function GateEntryPanel({
  events,
  canAuthorize,
}: {
  events: PersonEvent[];
  canAuthorize: boolean;
}) {
  if (events.length === 0) return null;

  const hasPending = events.some((e) => !e.feeAuthorizedAt);

  return (
    <div
      className={`no-print rounded-2xl border p-4 ${
        hasPending
          ? "border-rose-200 bg-rose-50"
          : "border-stone-200 bg-stone-50"
      }`}
    >
      <p className={`mb-2 text-sm font-semibold ${hasPending ? "text-rose-900" : "text-stone-700"}`}>
        {hasPending
          ? `⚠ Additional person${events.length > 1 ? "s" : ""} at gate — collect fee first, then authorize`
          : "Gate entry events"}
      </p>
      {hasPending && (
        <p className="mb-3 text-xs text-rose-700">
          Add the extra person charge below, collect payment, then click{" "}
          <strong>Authorize Entry</strong> to signal the guard.
        </p>
      )}
      <ul className="divide-y divide-stone-100">
        {events.map((ev) => (
          <EventRow key={ev.id} ev={ev} canAuthorize={canAuthorize} />
        ))}
      </ul>
    </div>
  );
}

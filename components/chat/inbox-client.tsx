"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ConversationPartner, StaffProfile } from "@/lib/chat/queries";

function playMessageSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    [0, 0.24].forEach((offset) => {
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoDep = ctx.createGain();
      const env = ctx.createGain();
      osc.type = "sawtooth"; osc.frequency.value = 430;
      lfo.type = "sine"; lfo.frequency.value = 28; lfoDep.gain.value = 60;
      lfo.connect(lfoDep); lfoDep.connect(osc.frequency);
      osc.connect(env); env.connect(master);
      const t = now + offset;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(1, t + 0.015);
      env.gain.setValueAtTime(1, t + 0.1);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      lfo.start(t); osc.start(t); lfo.stop(t + 0.2); osc.stop(t + 0.2);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* browser blocked audio */ }
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function Avatar({ name, size = 9 }: { name: string; size?: number }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <span
      className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800`}
    >
      {initial}
    </span>
  );
}

export function InboxClient({
  myUserId,
  initialConversations,
  chattableStaff,
}: {
  myUserId: string;
  initialConversations: ConversationPartner[];
  chattableStaff: StaffProfile[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  // Live-update inbox when we receive a new message
  useEffect(() => {
    const channel = supabase
      .channel(`inbox:${myUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `recipient_id=eq.${myUserId}`,
        },
        (payload) => {
          const msg = payload.new as { sender_id: string; body: string; created_at: string };
          setConversations((prev) => {
            const existing = prev.find((c) => c.userId === msg.sender_id);
            if (existing) {
              return [
                { ...existing, latestMessage: msg.body, latestAt: msg.created_at, unreadCount: existing.unreadCount + 1 },
                ...prev.filter((c) => c.userId !== msg.sender_id),
              ];
            }
            // New conversation — trigger a router refresh to get the profile
            router.refresh();
            return prev;
          });
          playMessageSound();
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [myUserId, supabase, router]);

  const totalUnread = conversations.reduce((n, c) => n + c.unreadCount, 0);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Header */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-lg font-bold text-stone-800">Messages</h1>
          {totalUnread > 0 && (
            <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white">
              {totalUnread} unread
            </span>
          )}
        </div>
        {/* Person picker dropdown */}
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) router.push(`/chat/${e.target.value}`);
          }}
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        >
          <option value="">💬 Start or open a conversation…</option>
          {chattableStaff.map((s) => (
            <option key={s.userId} value={s.userId}>
              {s.displayName}{s.roleLabel ? ` — ${s.roleLabel}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Conversation list */}
      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 p-10 text-center">
          <p className="text-sm text-stone-400">No messages yet.</p>
          <p className="mt-1 text-xs text-stone-400">
            Click &quot;+ New&quot; to start a conversation.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {conversations.map((c) => (
            <button
              key={c.userId}
              type="button"
              onClick={() => router.push(`/chat/${c.userId}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-amber-50 first:rounded-t-2xl last:rounded-b-2xl"
            >
              <Avatar name={c.displayName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm ${c.unreadCount > 0 ? "font-bold text-stone-900" : "font-medium text-stone-700"}`}>
                    {c.displayName}
                  </p>
                  <p className="shrink-0 text-[11px] text-stone-400">{fmtTime(c.latestAt)}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-stone-400">{c.latestMessage}</p>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markRead } from "@/lib/chat/actions";
import type { ChatMessage } from "@/lib/chat/queries";

/** Two duck quacks — universally funny chat sound. */
function playMessageSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    [0, 0.24].forEach((offset) => {
      const osc    = ctx.createOscillator();
      const lfo    = ctx.createOscillator();
      const lfoDep = ctx.createGain();
      const env    = ctx.createGain();

      osc.type          = "sawtooth";
      osc.frequency.value = 430;
      lfo.type          = "sine";
      lfo.frequency.value = 28;
      lfoDep.gain.value = 60;

      lfo.connect(lfoDep);
      lfoDep.connect(osc.frequency);
      osc.connect(env);
      env.connect(master);

      const t = now + offset;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(1, t + 0.015);
      env.gain.setValueAtTime(1, t + 0.1);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.19);

      lfo.start(t); osc.start(t);
      lfo.stop(t + 0.2); osc.stop(t + 0.2);
    });

    setTimeout(() => ctx.close(), 800);
  } catch { /* browser blocked audio */ }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export function ThreadClient({
  myUserId,
  partnerId,
  partnerName,
  partnerRole,
  initialMessages,
}: {
  myUserId: string;
  partnerId: string;
  partnerName: string;
  partnerRole: string | null;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const supabase = useRef(createClient()).current;

  // Mark all messages from partner as read on mount
  useEffect(() => {
    void markRead(partnerId);
  }, [partnerId]);

  // Subscribe to new messages in this conversation
  useEffect(() => {
    const channel = supabase
      .channel(`thread:${[myUserId, partnerId].sort().join(":")}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `recipient_id=eq.${myUserId}`,
        },
        (payload) => {
          const msg = payload.new as {
            id: string; sender_id: string; recipient_id: string;
            body: string; read_at: string | null; created_at: string;
          };
          if (msg.sender_id === partnerId) {
            setMessages((prev) => [
              ...prev,
              {
                id: msg.id,
                senderId: msg.sender_id,
                recipientId: msg.recipient_id,
                body: msg.body,
                readAt: msg.read_at,
                createdAt: msg.created_at,
              },
            ]);
            playMessageSound();
            void markRead(partnerId);
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [myUserId, partnerId, supabase]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = body.trim();
    if (!text || pending) return;
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      senderId: myUserId,
      recipientId: partnerId,
      body: text,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setError(null);
    start(async () => {
      const result = await sendMessage(partnerId, text);
      if (!result.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(result.error);
      }
    });
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group messages by date for display
  let lastDate = "";

  return (
    <div className="flex h-[calc(100vh-10rem)] max-w-2xl mx-auto flex-col rounded-2xl border border-stone-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
          {partnerName.charAt(0).toUpperCase()}
        </span>
        <div>
          <p className="text-sm font-bold text-stone-800">{partnerName}</p>
          {partnerRole && <p className="text-xs text-stone-400">{partnerRole}</p>}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-center text-xs text-stone-400 py-8">
            Start the conversation below.
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === myUserId;
          const dateLabel = new Date(msg.createdAt).toDateString();
          const showDate = dateLabel !== lastDate;
          lastDate = dateLabel;
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="my-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-stone-100" />
                  <span className="text-[11px] font-medium text-stone-400">{fmtDate(msg.createdAt)}</span>
                  <div className="h-px flex-1 bg-stone-100" />
                </div>
              )}
              <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    isMine
                      ? "rounded-br-sm bg-amber-600 text-white"
                      : "rounded-bl-sm bg-stone-100 text-stone-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <p className={`mt-0.5 text-right text-[10px] ${isMine ? "text-amber-200" : "text-stone-400"}`}>
                    {fmtTime(msg.createdAt)}
                    {isMine && msg.id.startsWith("opt-") && " ·"}
                    {isMine && !msg.id.startsWith("opt-") && msg.readAt && " ✓"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {error && (
        <p className="px-4 pb-1 text-xs text-rose-600">{error}</p>
      )}
      <div className="flex items-end gap-2 border-t border-stone-100 px-4 py-3">
        <textarea
          ref={inputRef}
          rows={1}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
          style={{ maxHeight: "7rem" }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={pending || !body.trim()}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

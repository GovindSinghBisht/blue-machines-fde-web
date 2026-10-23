"use client";

import { useEffect, useState } from "react";
import { getConversation, getConversations } from "@/lib/api";
import { date } from "@/lib/format";
import type { ConversationSummary, Transcript } from "@/lib/types";

/** The customer's recent conversations (the backend keeps the latest few) with a read-only transcript view. */
export default function RecentConversations({ sessionId, refreshKey }: { sessionId: string; refreshKey: number }) {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [open, setOpen] = useState<Transcript | null>(null);

  useEffect(() => {
    getConversations(sessionId)
      .then((r) => setItems(r.conversations))
      .catch(() => undefined);
  }, [sessionId, refreshKey]);

  const past = items.filter((c) => !c.current && c.turns > 0);

  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-semibold">Recent conversations</h3>
      {past.length === 0 ? (
        <p className="text-sm text-muted">Your earlier conversations will appear here.</p>
      ) : (
        <ul className="space-y-2">
          {past.map((c) => (
            <li key={c.conversation_id}>
              <button
                onClick={() => getConversation(sessionId, c.conversation_id).then(setOpen).catch(() => undefined)}
                className="w-full rounded-xl border border-line bg-surface p-3 text-left hover:border-accent"
              >
                <p className="truncate text-sm font-medium">{c.title ?? "Conversation"}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {date(c.started_at)} · {c.turns} question{c.turns === 1 ? "" : "s"}
                  {c.channel === "voice" ? " · voice" : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <TranscriptView transcript={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function TranscriptView({ transcript, onClose }: { transcript: Transcript; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{transcript.title ?? "Conversation"}</p>
            <p className="text-xs text-muted">{date(transcript.started_at)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-line px-2 py-1 text-xs hover:border-accent">
            Close
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-4 py-4 text-sm">
          {transcript.messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.role === "user" ? "bg-accent text-white" : "border border-line bg-surface-2"}`}
              >
                <p className="whitespace-pre-wrap">{m.content || "…"}</p>
                {m.interrupted && <p className="mt-1 text-[11px] opacity-70">Interrupted</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

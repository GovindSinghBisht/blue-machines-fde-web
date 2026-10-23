import type { Account, BackendStat, ConversationSummary, DemoCustomer, Guardrail, Transcript, TurnMetrics } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "loan-servicing-session";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * The login session token. Kept in sessionStorage so a page refresh keeps the customer signed in, while
 * closing the tab ends it. Sent only in the Authorization header, never in URLs.
 */
let token: string | null = null;

export function savedToken(): string | null {
  if (token) return token;
  try {
    token = sessionStorage.getItem(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}

function setToken(value: string | null) {
  token = value;
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session still works until the page reloads */
  }
}

function authHeaders(): Record<string, string> {
  const t = savedToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...authHeaders(), ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the service. Check that the API is running.");
  }
  if (res.status === 401) setToken(null);
  if (!res.ok) throw new ApiError(res.status, await detail(res));
  return res.json() as Promise<T>;
}

async function detail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function getHealth() {
  return request<{ status: string; business_date: string; tts: "openai" | "browser" }>("/api/health");
}

export function setChannel(channel: "text" | "voice") {
  return request<{ channel: string }>("/api/channel", { method: "POST", body: JSON.stringify({ channel }) });
}

/** Synthesised speech for one sentence (server TTS). Rejects so the caller can fall back to the browser voice. */
export async function fetchSpeech(text: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/tts`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new ApiError(res.status, "Speech unavailable");
  return res.blob();
}

export type VoiceTurnMetrics = {
  transcript_ms: number | null;
  first_audio_ms: number | null;
  first_answer_audio_ms: number | null;
  first_token_ms: number | null;
  turn_total_ms: number | null;
  interrupted: boolean;
  tts: string;
};

export function postVoiceMetrics(m: VoiceTurnMetrics) {
  return request<{ ok: boolean }>("/api/voice-metrics", { method: "POST", body: JSON.stringify(m) }).catch(() => undefined);
}

export function getDemoCustomers() {
  return request<{ customers: DemoCustomer[]; otp_hint: string }>("/api/demo-customers");
}

export async function login(phone: string, otp: string) {
  const r = await request<{ token: string; expires_at: string; customer: Account["customer"]; account: Account }>(
    "/api/login",
    { method: "POST", body: JSON.stringify({ phone, otp }) },
  );
  setToken(r.token);
  return r;
}

/** Restore the signed-in customer after a refresh. Resolves to null when there is no valid session. */
export async function restoreSession(): Promise<{ account: Account } | null> {
  if (!savedToken()) return null;
  try {
    return await request<{ account: Account }>("/api/me");
  } catch {
    return null;
  }
}

export async function logout() {
  await request<{ ok: boolean }>("/api/logout", { method: "POST" }).catch(() => undefined);
  setToken(null);
}

export function getAccount() {
  return request<Account>("/api/account");
}

export function getConversations() {
  return request<{ conversations: ConversationSummary[] }>("/api/conversations");
}

export function getConversation(conversationId: string) {
  return request<Transcript>(`/api/conversations/${conversationId}`);
}

export type TurnHandlers = {
  onTool: (e: { name: string; label: string }) => void;
  onToolResult: (e: { name: string; ok: boolean; error?: string | null; system?: string | null; sources: string[] }) => void;
  onAction: (e: { action_id: string; summary: string; details: Record<string, unknown> }) => void;
  onFiller?: (text: string) => void;
  onText: (delta: string) => void;
  onDone: (e: {
    text: string;
    metrics: TurnMetrics;
    sources: string[];
    backend: Record<string, BackendStat>;
    refused: boolean;
    pending_actions: string[];
    guardrails?: Guardrail[];
  }) => void;
  onError: (message: string) => void;
};

/** POST a message and dispatch the server-sent events as they arrive (EventSource can't POST). */
export async function sendMessage(text: string, on: TurnHandlers, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ text }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ApiError(0, "Can't reach the service. Check your connection and try again.");
  }
  if (res.status === 401) setToken(null);
  if (!res.ok || !res.body) throw new ApiError(res.status, await detail(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      dispatch(buffer.slice(0, end), on);
      buffer = buffer.slice(end + 2);
    }
  }
}

function dispatch(block: string, on: TurnHandlers) {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7);
    else if (line.startsWith("data: ")) data += line.slice(6);
  }
  if (!data) return;
  const payload = JSON.parse(data);
  switch (event) {
    case "tool":
      return on.onTool(payload);
    case "tool_result":
      return on.onToolResult(payload);
    case "action":
      return on.onAction(payload);
    case "filler":
      return on.onFiller?.(payload.text);
    case "text":
      return on.onText(payload.delta);
    case "done":
      return on.onDone(payload);
    case "error":
      return on.onError(payload.message);
  }
}

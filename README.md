# blue-machines-fde-web

Customer-facing web app for the AI loan servicing assistant: sign in with a registered mobile number,
ask by text or voice, confirm actions, and see accounts and open requests update alongside.

Built with Next.js (App Router), React and Tailwind CSS. It talks to the assistant API in the backend
repository: [loan-servicing-ai](https://github.com/GovindSinghBisht/loan-servicing-ai).

## Run

Start the backend first (mock enterprise systems and the assistant API on port 8000; see its README).
Then:

```bash
npm install
cp .env.example .env.local     # only needed if the API is not on http://127.0.0.1:8000
npm run dev                    # http://localhost:3000
```

Sign in with a demo customer (OTP `123456`). Production build: `npm run build && npm start`.

## What the UI shows

- **Live progress**: while the assistant works, each system lookup appears as a step ("Checking payment
  records") instead of a spinner, then the reply streams in.
- **Verifiable answers**: every reply lists the records and policy clauses it was based on.
- **Confirmations**: actions appear as a card with Confirm / Cancel; nothing is submitted until the
  customer confirms, and the card records the outcome.
- **Account panel**: loans, cards and open requests (with SLA status), refreshed after every turn.
- **Degraded mode**: if a backend system is down, the reply and the panel say which information is
  unavailable rather than failing.
- **Latency details** (header toggle): time to first word, total, model vs tool time, and per-system calls
  and retries for each reply.
- **Sessions**: signing in returns a session token kept in the tab's `sessionStorage` and sent in the
  `Authorization` header. A page refresh keeps the customer signed in with the conversation on screen;
  closing the tab or signing out ends it (sign-out revokes the token on the server).
- **Documents**: when the assistant obtains a repayment statement from the loan system, a download card
  appears in the reply; the PDF is fetched with the session token, so links cannot be shared or reused.
- **Recent conversations**: the customer's last few conversations (the backend keeps five) appear in the
  account panel and open as a read-only transcript.
- **Guardrail notes**: if a card number, Aadhaar or PAN was removed from a message, or a figure in a reply
  couldn't be matched to the customer's records, the reply says so.
- **Voice mode** (mic button): talk instead of typing in the same conversation. Replies are spoken as
  they stream; talk at any time to interrupt; slow lookups get a short spoken filler. Needs a browser with
  speech recognition (Chrome or Edge); use headphones so the assistant does not hear itself. The voice bar
  shows the last turn's transcript time, time to first sound and time to the answer's audio.

## Structure

| Path | What |
|---|---|
| `src/app/page.tsx` | Session state, layout (chat + account panel, tabs on mobile) |
| `src/components/SignIn.tsx` | Mobile + OTP sign-in, demo customer shortcuts |
| `src/components/Chat.tsx` | Conversation, streaming, suggestions, confirm/cancel |
| `src/components/MessageBubble.tsx` | Reply with progress steps, sources, action card, latency |
| `src/components/AccountPanel.tsx` | Loans, cards, open requests |
| `src/lib/api.ts` | Typed API client and server-sent events parser |
| `src/lib/speech.ts` | Speech recognition, sentence splitting, streamed speech output |
| `src/components/useVoice.ts` | Voice turn logic: barge-in, echo filter, fillers, latency timeline |
| `src/components/VoiceBar.tsx` | Voice mode controls and status |
| `src/components/RecentConversations.tsx` | Past conversations list and transcript view |

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Base URL of the assistant API |

The API must allow this app's origin (backend `WEB_ORIGINS`, default `http://localhost:3000`).

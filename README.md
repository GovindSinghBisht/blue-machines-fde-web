# Loan servicing web app

This is the customer facing web app for the loan servicing assistant. A customer signs in with their
registered mobile number, asks questions by text or voice, confirms requests, and sees their accounts and
open requests update alongside the conversation.

It is built with Next.js, React and Tailwind CSS, and it talks to the assistant API in the backend
repository, [loan-servicing-ai](https://github.com/GovindSinghBisht/loan-servicing-ai).

## Running it

Start the backend first. Its README explains how to run the mock systems and the API on port 8000. Then
install and start the app:

```bash
npm install
```
```bash
npm run dev
```

Open http://localhost:3000 and sign in as one of the demo customers. The OTP is `123456`. If the API runs
somewhere other than http://127.0.0.1:8000, copy `.env.example` to `.env.local` and set
`NEXT_PUBLIC_API_URL`. For a production build, run `npm run build` and then `npm start`.

The `Dockerfile` builds a standalone production image. The backend repository's `docker-compose.yml`
builds it together with the API and the HTTPS proxy, and serves the API on the same address under `/api`.
When the server sets an access code, the sign in screen asks for it.

## What the interface does

While the assistant works, each lookup appears as a step such as "Checking payment records" instead of a
spinner, and then the reply streams in. Every reply lists the records and policy clauses it was based on,
so the customer can see where an answer came from.

Requests such as a dispute or a waiver appear as a card with Confirm and Cancel buttons. Nothing is
submitted until the customer confirms, and the card then shows what happened. The account panel shows
loans, cards and open requests with their SLA status, and it refreshes after every turn. If a backend
system is down, the reply and the panel say which information is unavailable instead of failing.

A toggle in the header shows latency details for each reply: the time to the first word, the total time,
how that splits between the model and the tools, and the calls and retries made to each system.

Signing in returns a session token that is kept in the tab's session storage and sent in the
Authorization header. Refreshing the page keeps the customer signed in with the conversation on screen.
Closing the tab or signing out ends the session, and signing out also revokes the token on the server.

When the assistant gets a repayment statement from the loan system, a download card appears in the reply.
The PDF is fetched with the session token, so the link cannot be shared or reused. The customer's last few
conversations appear in the account panel and open as a read only transcript. If a card, Aadhaar or PAN
number was removed from a message, or a figure in a reply could not be matched to the customer's records,
the reply says so.

The microphone button switches to voice in the same conversation. Replies are spoken as they stream, the
customer can talk at any time to interrupt, and slow lookups get a short spoken filler. Voice needs a
browser with speech recognition, such as Chrome or Edge, and headphones help so the assistant does not
hear itself. The voice bar shows the last turn's timings for the transcript, the first sound and the
spoken answer.

## Code layout

| Path | Contents |
|---|---|
| `src/app/page.tsx` | Session state and layout, with chat and account panel side by side or as tabs on mobile |
| `src/components/SignIn.tsx` | Sign in with mobile number, OTP, the optional access code and demo customers |
| `src/components/Chat.tsx` | The conversation, streaming, suggestions and confirmations |
| `src/components/MessageBubble.tsx` | A reply with its progress steps, sources, action card and latency |
| `src/components/AccountPanel.tsx` | Loans, cards and open requests |
| `src/lib/api.ts` | Typed API client and the parser for streamed events |
| `src/lib/speech.ts` | Speech recognition, sentence splitting and spoken output |
| `src/components/useVoice.ts` | Voice turns, interruptions, echo filtering, fillers and timings |
| `src/components/VoiceBar.tsx` | Voice controls and status |
| `src/components/RecentConversations.tsx` | Past conversations and their transcripts |

## Configuration

`NEXT_PUBLIC_API_URL` is the address of the assistant API and defaults to http://127.0.0.1:8000. Leave it
empty when the app is served behind the same proxy as the API, as in the Docker setup. The API has to allow
this app's address through the backend's `WEB_ORIGINS` setting, which defaults to http://localhost:3000.

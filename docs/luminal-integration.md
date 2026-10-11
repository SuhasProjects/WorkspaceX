# Luminal generation integration

The backend branch includes the published widget-engine branch and imports
`WIDGET_SYSTEM_PROMPT` and `parseModelOutput` from its generation contract.
`src/lib/luminal/generate.ts` is server-only. It sends the system prompt and
admin's trimmed request as separate OpenAI-compatible chat messages, parses the
reply, checks that it is a complete self-contained document under 100 KiB, and
returns exactly `{ title, html }`. Provider failures, timeouts, malformed output,
and missing configuration become sanitized error codes; provider response bodies
and the API key are not sent to the browser.

A focused mock check and TypeScript check passed. The real endpoint and model were supplied by the user and saved locally. Live generation returned provider HTTP 503, so successful generation remains unverified. `/api/generate` is implemented with admin session and role checks.

Widget-engine milestone code is merged into `backend` for this integration, not
into `main`. The frontend branch has not yet been published. The existing draft
storage contract says 16 KiB per value, while the widget engine allows 64 KiB;
Backend and Engine must agree on one limit before shared-storage integration.

The latest Atlas check reaches the server but receives MongoDB authentication
error 8000. The database user/password in local `.env.local` must be corrected
before the persistence verification can pass. No database read/write has been
confirmed. To retry once corrected: `npm run verify:db`.
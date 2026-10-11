# AWS setup and billing integration handoff

Written for a coding agent (Claude Code, Codex, Kiro, or similar) working on a
fresh computer. Follow it top to bottom. Steps marked **(human)** need the
person at the keyboard; do not try to automate them or ask for access keys.

## Part 1: connect the agent to AWS

Source: AWS Agent Toolkit setup instructions,
https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/setup-instructions/setup.md

1. **Inputs to collect from the human:** a profile name (we use `workspacezero`),
   a region for resources (we use `us-east-1`), and "new" or "advanced" AWS
   experience for the rules file. Never ask for access keys or secret keys.
   Tell the human that credentials last 12 hours and renew without a browser
   for up to 90 days.
2. **Install `uv`** if `uv --version` fails:
   `curl -LsSf https://astral.sh/uv/install.sh | sh`
3. **Install the AWS CLI** if `aws --version` fails (user-level, no admin):
   `curl -fsSL 'https://awscli.amazonaws.com/v2/install.sh' | bash`
   then make sure `~/.local/bin` is on PATH, for zsh:
   `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc`
   and `export PATH="$HOME/.local/bin:$PATH"` in the current shell.
   Verified today on macOS: installs AWS CLI 2.37.x into `~/.local/share/aws-cli`.
4. **Sign in (human):**
   `aws configure set region us-east-1 --profile workspacezero`
   `aws login --region us-east-1 --profile workspacezero`
   A browser tab opens. If it does not, the command prints a URL to give to
   the human. Wait for the command to exit 0.
5. **Verify:** `aws sts get-caller-identity --profile workspacezero` must print
   `Account`, `Arn`, and `UserId`. Confirm with the human that the account id
   is the hackathon account the billing service was enabled on.
6. **Run the toolkit wizard (human answers prompts):**
   `aws configure agent-toolkit --yes --region us-east-1 --profile workspacezero`
   This always runs in `us-east-1`. It installs AWS skills and writes an
   `aws-mcp` entry into the agent's MCP config.
7. **Point the MCP server at the profile:** in each `aws-mcp` entry the wizard
   wrote, add (change nothing else):
   `"env": { "AWS_MCP_PROXY_PROFILES": "workspacezero" }`
8. **Verify the toolkit:**
   `aws agent-toolkit list-available-skills --region us-east-1 --profile workspacezero`
   Save the full JSON output into the chat: it is how we find out what the
   "monetization service" is called (look for skills mentioning billing,
   payments, subscriptions, monetization, or marketplace).
9. **Rules file:** fetch `aws-starter-rules.md` (new) or `aws-agent-rules.md`
   (advanced) from the `aws/agent-toolkit-for-aws` repository and append it to
   the project's `CLAUDE.md` (or `AGENTS.md` for Codex) between
   `<!-- BEGIN AWS Agent Toolkit rules -->` and `<!-- END AWS Agent Toolkit rules -->`.
   **Do not commit this block without team agreement**; it changes how every
   teammate's agent behaves. Project instructions take precedence over it.

## Part 2: what WorkspaceZero already has

Read `docs/billing.md` first. In short:

- Plans and limits: `src/lib/billing/plans.ts` (client-safe).
- Provider boundary: `src/lib/billing/provider.ts`. `BillingProvider` has two
  methods, `createCheckoutSession` and `parseWebhook`. The placeholder has
  `available: false` and throws on both, so nothing can activate a paid plan.
- Routes: `GET /api/billing` (summary), `POST /api/billing/checkout` (admin,
  records `pending`), `POST /api/billing/webhook` (the only path to `active`).
- Data: `workspaces.subscription { plan, status, externalId?, updatedAt }`,
  `workspaces.generationUsage["YYYY-MM"]`; helpers `setWorkspaceSubscription`,
  `countWidgets`, `getGenerationCount` in `src/lib/db/repository.ts`.
- Enforcement already live: tool count and monthly generations. Feature gates
  (shared widgets, member logins) switch on with `BILLING_ENFORCE_FEATURES=true`.
- Env names reserved: `BILLING_PROVIDER`, `BILLING_WEBHOOK_SECRET`,
  `BILLING_ENFORCE_FEATURES` (see `.env.example`).

## Part 3: connect the AWS monetization service

Do these in order. Do not invent endpoint URLs, header names, or event names;
take them from the service's documentation or the skill output from step 8.

1. **Identify the service** from the skills list or the teammate who enabled
   it. Record: base URL or SDK, auth method, how to create a hosted checkout
   for a plan, how to pass metadata (we need `workspaceId`, `plan`, and for
   Team a `seats` count) and a return URL, the webhook signing scheme and
   header names, event type names, and the price or product identifiers for
   Pro ($12/mo) and Team ($50/mo for 10 seats, +$25 per additional 10).
2. **Create `src/lib/billing/aws-provider.ts`** implementing `BillingProvider`:
   - `createCheckoutSession({ workspaceId, plan, returnUrl })`: call the
     service, attach metadata, return `{ url, sessionId }`. Never touch the
     database here.
   - `parseWebhook(request)`: read the raw body with `await request.text()`,
     verify the signature with `process.env.BILLING_WEBHOOK_SECRET` using the
     service's documented algorithm (typically HMAC-SHA256 over timestamp +
     body; compare with a constant-time function such as
     `crypto.timingSafeEqual`), reject timestamps older than 5 minutes, then
     map the event to `{ type: "activated" | "renewed" | "past_due" | "canceled",
     workspaceId, plan, externalId, eventId }`. Take `workspaceId` and `plan`
     from the metadata we attached at checkout, never from untrusted fields.
     Throw on any failure.
   - `available: true` only when the required env vars are present.
3. **Select it** in `getBillingProvider()` when `process.env.BILLING_PROVIDER === "aws"`.
4. **Idempotency:** add a `billingEvents` collection with a unique index on
   `eventId` (indexes are created in `src/lib/db/client.ts`); in the webhook
   route, insert the event id first and return 200 without changes if it
   already exists.
5. **Seat count for Team:** until accounts exist, send `seats: 10`; compute
   price with `monthlyPriceFor(plan, seats)` from `plans.ts`.
6. **Environment:** add the service's variables to `.env.example` (names only),
   to `.env.local` for development, and to Vercel for production, plus
   `BILLING_PROVIDER=aws` and `BILLING_WEBHOOK_SECRET`.
7. **Register the webhook** with the service at
   `https://workspacezero.vercel.app/api/billing/webhook`.
8. **Return page polish:** `src/components/billing/pricing-page.tsx` handles
   `?checkout=return`; make it poll `GET /api/billing` every 2 seconds for up
   to 60 seconds and show "Payment confirmed" when `subscription.status`
   becomes `active`, otherwise "Still confirming your payment". Never show
   success before the webhook has landed.

## Part 4: verification checklist

Run against a throwaway workspace (create one with `POST /api/workspaces`):

- `GET /api/billing` shows `checkoutAvailable: true` with the AWS provider.
- `POST /api/billing/checkout {"plan":"pro"}` returns a URL and sets
  `subscription.status: "pending"`; limits are unchanged.
- A webhook with a bad signature returns 4xx and changes nothing.
- A valid `activated` event sets `active`; `widgetLimit` becomes null and the
  generation limit becomes 20 (Pro) or 100 (Team).
- Sending the same event twice changes nothing the second time.
- A `canceled` event drops the workspace back to Free limits.
- Members get 403 from `/api/billing/checkout`.

Report results in the format the team uses: what changed, which files, the
commit id, whether it was tested, and anything a teammate must do next.

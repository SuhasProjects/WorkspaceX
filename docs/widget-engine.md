# Widget engine

The widget engine runs AI-generated mini-apps inside WorkspaceZero. It is the
same engine for every widget: a poll, a countdown, and an expense tracker all
run through identical code with no per-widget special cases.

Owned paths: `src/components/widget-engine/` and `src/lib/widget-protocol/`.

## How a widget runs

1. The dashboard renders `<WidgetRenderer widgetId workspaceId html theme />`.
2. The engine wraps the widget's HTML with its own head: a Content Security
   Policy, theme CSS variables, and the runtime script. The result becomes the
   `srcdoc` of an iframe with `sandbox="allow-scripts"` and nothing else.
3. Inside the iframe, the runtime defines the global `workspace` object with
   four async methods: `getShared`, `setShared`, `getPersonal`, `setPersonal`.
4. Each call becomes a `postMessage` to the dashboard. The dashboard identifies
   the sender by its iframe window (never by anything in the message), attaches
   the real widget and workspace IDs, and routes the request:
   - shared → `GET/PUT /api/storage` (session cookie → MongoDB)
   - personal → `localStorage` under `wz:personal:v1:<workspace>:<widget>:<key>`
   - preview (unsaved widget) → throwaway in-memory store
5. The reply is posted back to that iframe only, matched by request ID.

Protocol types and limits live in `src/lib/widget-protocol/protocol.ts` and are
shared with the backend, so client and server validation cannot drift.

## What the sandbox prevents

| Attempt by widget code | Result |
| --- | --- |
| Read the dashboard page, cookies, or session | `SecurityError` (opaque origin, no `allow-same-origin`) |
| `fetch`, XHR, WebSocket, external scripts/styles/images/fonts | Blocked by CSP; reported as a widget error |
| Navigate the top window, open popups, submit a real form | Blocked by the sandbox |
| Navigate its own frame elsewhere | Detected on second load; widget is stopped |
| Claim a different widget or workspace ID | Ignored; identity comes from the iframe window |
| Read another widget's data | Impossible; every request is scoped by the engine, then re-checked by the backend |
| Oversized values, bad keys, non-JSON, request floods | Rejected with `INVALID_INPUT`, `PAYLOAD_TOO_LARGE`, or `RATE_LIMITED` |
| Throw errors, never finish loading, or return empty HTML | Error bar or "Widget unavailable" card; dashboard unaffected |

Verified in Chrome with self-testing widgets covering every row above.

## Known limits

- A widget stuck in an infinite loop can freeze the tab in browsers that run
  sandboxed frames in the same process. Nothing in a browser prevents this.
- Shared storage is last-write-wins. Two people saving the same key at the same
  moment can lose one update. The sample poll re-reads before writing, which
  narrows but does not close the window.
- There are no per-user accounts, so "one vote per person" can only be enforced
  per browser via personal storage.
- Personal data lives in one browser; it does not follow the user to another device.
- The CSP blocks remote images and web fonts, so generated widgets must use
  system fonts and inline/SVG graphics. The system prompt tells the model this.

## Generated code compatibility

Three habits common in AI-written code would silently break under the sandbox,
so the runtime patches them: form `submit` events fire again (real submission
stays blocked), `alert()` shows an in-widget toast, and `localStorage` becomes a
memory store instead of throwing at startup.

`src/lib/widget-protocol/generation-contract.ts` holds the Luminal system
prompt, `parseModelOutput` (tolerates fences and prose around the document),
and `checkWidgetCompatibility`, which warns about external scripts, network
calls, remote media, and shadowing the `workspace` global.

## Developer tools

- `WidgetPlayground` renders every test widget plus pasted model output with a
  theme switch and a mock/real storage toggle. Mount it at a dev route such as
  `src/app/dev/widgets/page.tsx`.
- `configureWidgetEngine({ sharedStorage: "mock" })` keeps shared data in
  localStorage for working without the backend.
- `TEST_WIDGETS` in `test-widgets.ts` covers interaction, both storage types,
  forms, a crashing widget, sandbox escape attempts, and navigation.

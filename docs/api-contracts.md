# WorkspaceZero API contracts — foundation proposal

Backend owns `src/types/contracts.ts`. Frontend and Widget Engine must review this
proposal before implementing dependent integrations. Workspace, auth, task, widget, generation, and storage endpoints are implemented.

All requests use same-origin URLs. JSON bodies require `Content-Type: application/json`.
Success has `{ data: ... }`; failure has `{ error: { code, message } }`.
String IDs and UTC ISO timestamps cross the API. Database records and password
hashes never cross it. Responses containing workspace data must not be cached.

## Endpoints

| Method and path | Input | Contents of `data` | Permission | Success |
| --- | --- | --- | --- | --- |
| POST /api/workspaces | name, optional workspaceId, adminPassword, memberPassword | `{ workspace: Workspace }` | Public | 201 |
| POST /api/auth/login | workspaceId, password | `{ workspace: Workspace }` | Public | 200 |
| POST /api/auth/logout | None | `{ success: true }` | Idempotent, including logged out | 200 |
| GET /api/workspaces/current | None | `{ workspace: Workspace }` | Admin/member | 200 |
| GET /api/tasks | None | `{ tasks: Task[] }` | Admin/member | 200 |
| POST /api/tasks | title, optional description, dueDate, dueTime, and status (default todo) | `{ task: Task }` | Admin/member | 201 |
| PATCH /api/tasks/[id] | At least one of title, description, dueDate, dueTime, or status | `{ task: Task }` | Admin | 200 |
| DELETE /api/tasks/[id] | Path ID | `{ success: true }` | Admin | 200 |
| POST /api/generate | prompt, optional baseHtml for editing an existing widget | `{ title, html, optional size }` | Admin | 200 |
| GET /api/widgets | None | `{ widgets: Widget[] }` | Admin/member | 200 |
| POST /api/widgets | title, html, optional size | `{ widget: Widget }` | Admin | 201 |
| PATCH /api/widgets/[id] | size | `{ widget: Widget }` | Admin | 200 |
| DELETE /api/widgets/[id] | Path ID | `{ success: true }` | Admin | 200 |
| GET /api/storage | Query widgetId, key | `{ value, exists }` | Admin/member, registered widget | 200 |
| PUT /api/storage | widgetId, key, value | `{ success: true }` | Admin/member, registered widget | 200 |
| GET /api/health | None | `{ status: "ok", service: "workspacezero" }` | Public | 200 |

Creation establishes an admin session. Login infers role from the password; admin
and member passwords must differ. Workspace and role come from a verified session
on subsequent requests, never client-selected workspace fields. Cookies must be
HTTP-only, SameSite=Lax, Secure in production, and expiring. Mutation endpoints
must validate same-origin requests in addition to session/role checks.

## Validation defaults to implement

Implemented endpoints enforce these limits.
Unknown input fields are rejected. JSON bodies are limited to 16 KiB except widget saves (256 KiB) and storage writes (70 KiB). Stored JSON values are limited to 64 KiB encoded as UTF-8, with finite numbers and maximum nesting depth 32. Saved HTML is limited to 200 KiB UTF-8; generated HTML is limited to 100 KiB;
the complete JSON save body must still fit the 256 KiB limit.

Names/titles: trimmed, 1–120 characters. Workspace IDs: 3–64 lowercase ASCII
letters, digits, or hyphens; generated when omitted. Passwords: 12–128 characters,
not trimmed. Descriptions: up to 2,000 characters. Prompts: trimmed, 1–4,000
characters. Storage keys: 1–128 ASCII letters, digits, dots, underscores, or
hyphens. IDs supplied in paths must be valid IDs and belong to the session's
workspace. Task statuses are `todo`, `in_progress`, `done`. Task due dates use
`YYYY-MM-DD` and optional due times use `HH:mm`. Clearing a due date also clears its time. Clear a description
with an empty string. HTML validation checks the document format and size; it
does not establish that generated code is safe.

Widget sizes are `small`, `medium`, or `large`. Newly saved widgets without a
size default to `medium` during the generator transition. Legacy database records
without a size are returned as `large` so existing full-page tools remain usable.

Missing storage returns `{ value: null, exists: false }`. A stored null returns
`{ value: null, exists: true }`. Lists return empty arrays when empty, ordered by
creation time with ID as a stable tie-breaker. Widget deletion also removes its
shared data. Generic storage uses last-write-wins; concurrent writes can lose
updates, including poll increments.

## Errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | INVALID_INPUT | Malformed JSON or invalid fields |
| 401 | UNAUTHENTICATED | Missing/expired session or invalid login credentials |
| 403 | FORBIDDEN | Role or request-origin restriction |
| 404 | NOT_FOUND | Missing resource, including another workspace's resource |
| 409 | CONFLICT | Workspace ID already exists |
| 413 | PAYLOAD_TOO_LARGE | Body, HTML, or stored value exceeds limit |
| 415 | UNSUPPORTED_MEDIA_TYPE | JSON endpoint received another content type |
| 429 | RATE_LIMITED | Login/generation request limit reached |
| 502 | GENERATION_FAILED | Provider failure or invalid model output |
| 503 | SERVICE_UNAVAILABLE | Required configuration or service unavailable |
| 504 | GENERATION_TIMEOUT | Provider request exceeded timeout |
| 500 | INTERNAL_ERROR | Unexpected server failure |

Login errors must not reveal whether a workspace exists. Public errors contain
no stack traces, provider response bodies, credentials, or password hashes.
The health endpoint checks HTTP availability only, not MongoDB or Luminal.

## Generated-widget and engine agreement

Generation returns `title`, a complete self-contained HTML document, and may
return a recommended `size`. Saving is a separate admin action. Luminal's verified endpoint/model and service
availability are dependencies of the later generation phase.

Engine injects the async `workspace` SDK before widget scripts execute. SDK reads
return a JSON value or null when absent; successful writes resolve without a
value; errors reject. Widgets use the SDK rather than implementing their own
bridge, fetch, or storage. No external assets or network calls are allowed.

Messages use `workspacezero.widget.v1` and the types in `contracts.ts`. Requests
carry no trusted workspace/widget ID: the parent maps `event.source` to the actual
renderer widget. Successful write messages return `value: null`. Failed messages
return an API-shaped error. Validate actions, IDs, keys, values, message size, and
source; cap pending requests and use timeouts. Opaque iframe origins require
source validation rather than origin validation alone.

The proposed renderer adds `workspaceId` to the originally suggested props so
personal storage can be namespaced by workspace + widget + key. The server still
derives workspace identity from the session. This prop addition needs Frontend
and Engine agreement before their implementation.

Unsaved previews have no registered widget ID and cannot access persistent
shared storage. Engine/Frontend must agree on a distinct preview mode and error
display before building previews; do not save automatically to enable preview.

Engine owns restrictive iframe sandboxing and CSP that blocks external network
resources. Use scripts without same-origin permission. Engine owns initial theme
delivery, `kind: theme` updates, and injection of these proposed CSS variables:
`--wz-background`, `--wz-surface`, `--wz-text`, `--wz-muted`, `--wz-accent`,
`--wz-border`. Frontend/Engine must agree on color values. Iframe sandboxing alone
does not make arbitrary generated programs completely secure.

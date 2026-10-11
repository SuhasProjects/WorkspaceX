# Backend core handoff

The `backend` branch now contains the widget engine milestone and authenticated
workspace, widget, generation, and shared-storage API routes. The build and one
focused live API check passed. The check created temporary workspaces, verified
admin/member roles, widget persistence, shared reads/writes, an unauthenticated
rejection, and cross-workspace denial; it removed the temporary records.

The widget engine can use its default `apiSharedStorage` adapter. It sends
`GET /api/storage?widgetId=...&key=...` and `PUT /api/storage` with `{ widgetId,
key, value }`. Both return the agreed `{ data: ... }` envelope. The parent must
pass the real registered widget ID. The server identifies the workspace from the
signed HTTP-only cookie. Both roles may read/write shared widget data; admin is
required to create/delete widgets and call `/api/generate`.

Local MongoDB connection and persistence passed. Luminal's configured base URL
and model were verified against the user's dashboard values, and the generator
uses the engine's exact prompt and parser. A live provider call returned HTTP
503, so live generation remains unverified. No raw provider body or API key was
logged. The local `.env.local` remains ignored by Git; production variables have
not been configured in Vercel.

The 64 KiB widget-engine storage limit is now enforced by `/api/storage`. Task
board routes remain pending. Frontend integration, end-to-end generation,
production deployment, and second-browser testing remain pending. The widget
engine and frontend agents should pull `main` after this backend merge and run
`npm ci` for added dependencies.
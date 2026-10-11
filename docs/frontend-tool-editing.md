# Frontend tool editing

Saved widget pages show **Edit this tool** only for workspace admins. Mock previews
and member pages have no edit controls. Backend must enforce admin permissions.

The editor submits `POST /api/generate` with `{ prompt, baseHtml: widget.html }`.
It expects `{ data: { title, html } }`. The saved HTML is the base for each request.
Generated HTML uses the existing Engine `WidgetRenderer` with `preview`, an isolated
preview ID, workspace ID, theme, and sizing class. Shared/personal preview writes
do not modify the saved tool's state. Approval is disabled until the renderer is
ready, and stays disabled if it reports a runtime failure.

Only **Approve and replace tool** sends a save request. It calls
`PUT /api/widgets/[id]` with `{ title, html }` and expects
`{ data: { widget: Widget } }`, with exactly the original widget ID.
The list and rendered tool update in place after success. No create-widget POST
is used for replacement. Generation/save failures retain the prompt or preview;
cancel discards the local edit. Saving disables cancellation to avoid an unclear
outcome. Requests abort if the editor is unmounted.

## Backend handoff — not implemented by Frontend

- `/api/generate` needs the requested optional `baseHtml` support and edit-mode
  messages from `buildGenerationMessages`, plus the requested temperature.
- `PUT /api/widgets/[id]` needs same-origin/admin/workspace checks and title/HTML
  validation. Update the existing record in place; preserve `id`, `createdAt`,
  and its associated shared storage. Return the updated Widget in the named field.
- A missing PUT handler shows a friendly message and keeps the preview available.
  No fallback creates another widget or deletes existing storage.

The fetched `9f7fc1b` foundation has neither backend edit hookup. No backend,
shared-contract, or widget-engine source changes were made for this feature.

Validation: the production build and its TypeScript validation passed. Frontend
lint found only two unused imports left by the shared-code merge; those were
removed. The live homepage and `/api/health` at workspacezero.vercel.app returned
HTTP 200. This availability check does not verify authenticated editing, MongoDB,
or Luminal. End-to-end editing requires the backend handlers and deployment.

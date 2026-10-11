# Database milestone

Backend branch. Added the official MongoDB driver, server-only import protection,
connection reuse with bounded timeouts, database indexes, workspace persistence,
and workspace-scoped widget persistence and deletion. Private workspace hashes
are available only through the explicitly server-only credential lookup. Public
workspace summaries exclude hashes. Repository callers must supply workspace
identity from verified sessions when API routes are implemented.

The MongoDB driver manages a connection pool per client; the app reuses its
client across requests/hot reloads. Reference:
https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/

Local credentials remain in ignored `.env.local`. Database name: `workspacezero`.
After Atlas network access and database-user credentials were corrected, live
verification passed: connection, indexes, scoped workspace/widget reads and
writes, duplicate protection, widget-data cleanup, and test-record cleanup.
TLS certificate verification remains enabled.

Authenticated workspace, widget, and storage endpoints now pass a focused live
API check. See `docs/backend-core.md`. The widget engine can use the real
`/api/storage` endpoint.
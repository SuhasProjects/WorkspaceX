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

Local credentials are in ignored .env.local; database name is workspacezero.
Luminal configuration is incomplete until the actual base URL/model are provided.
No public business endpoints or shared-storage operations are enabled yet.
API and renderer contracts are unchanged. Frontend/Engine keep using mocks.
Root dependencies changed: teammates should run npm ci after integrating.

Validation: TypeScript and lint passed. The live persistence verification was
blocked by a TLS connection failure to Atlas. No database write was confirmed.
Check Atlas Network Access for the current client IP, cluster availability, and
local TLS/network configuration. TLS certificate verification is not disabled.

To rerun after fixing access: npm run verify:db. It creates uniquely named
verification records, checks persistence/workspace scoping/deletion, and removes
only its own records. It never drops the database or prints credentials/raw
provider errors. Do not interpret this script's existence as a successful test.

Next: resolve Atlas access, confirm persistence, then proceed to the next major
phase after human approval. Authentication/authorization must precede exposing
persistence endpoints publicly.
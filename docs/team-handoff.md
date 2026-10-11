# Shared foundation handoff

## Scope and ownership

One Next.js App Router application. npm and `package-lock.json` are shared.
The foundation provides configuration, a starter screen, browser-safe contracts,
an environment template, and a public health route. Business endpoints, database
connectivity, authentication, Luminal, dashboard, and widget runtime are later
milestones. Do not treat their documented contracts as working APIs.

| Owner | Files/directories |
| --- | --- |
| Backend | src/app/api, src/lib/db, src/lib/auth, src/lib/luminal |
| Backend coordinates | package.json, package-lock.json, root config, .env.example, src/types/contracts.ts, docs/api-contracts.md |
| Frontend | src/app/page.tsx, src/app/globals.css, src/components/auth, dashboard, tasks, builder |
| Engine | src/components/widget-engine, src/lib/widget-protocol |
| Coordinate before changing | src/app/layout.tsx, shared types, renderer props, protocol, API response shapes |

Empty owned directories contain `.gitkeep`; remove the placeholder when adding
real files. Frontend may introduce `src/app/(ui)` later, but must avoid defining
two routes for `/`. Only Backend initializes the project.

## Branch workflow

Backend publishes the verified foundation on `main` and supplies its commit SHA.
Each human uses a separate clone, or a separate Git worktree directory. A single
directory can have only one checked-out branch; switching it under another agent
would disrupt their work.

In each teammate's own checkout, start from the published foundation:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c frontend
```

Engine uses `widget-engine` instead; Backend uses `backend`. If the branch already
exists, switch to it rather than recreating it. Commit tested feature groups,
push each branch, and merge reviewed changes incrementally into `main`. Never
force-push shared branches or overwrite another teammate's work. Backend owns
dependency additions to minimize lockfile conflicts. Coordinate shared interface
changes and pull merged updates before integrating the next feature group.

## Required review before parallel implementation

- All agents: review `src/types/contracts.ts` and `docs/api-contracts.md`, especially
  response nesting, field validation, permissions, and missing-storage behavior.
- Frontend + Engine: approve the renderer's additional `workspaceId` prop,
  unsaved preview mode, and initial/theme-update behavior.
- Backend + Engine: approve SDK reads/writes, errors, protocol, HTML output,
  storage limits, and network isolation requirements.
- Backend + human: verify real MongoDB/Luminal configuration locally; do not paste
  credentials into chat or commit them. No endpoint or model is guessed.

Frontend can build against explicit mocks while the backend is unfinished.
Engine can test fixed self-contained documents before generation is connected.
Replace mocks during integration. Authentication/isolation are required before
shared-storage APIs become public.

## Next milestone

After human approval, Backend implements MongoDB connection reuse, indexes, and
workspace/widget persistence, then tests actual reads/writes. Authentication and
authorization must accompany externally accessible persistence operations.

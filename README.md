# WorkspaceZero

One Next.js application for AI-generated mini-apps in shared team workspaces.
The application includes authenticated workspace, task, widget, generation, and shared-storage APIs connected to the dashboard. Deployment remains in progress.

## Local development

Use Node.js 24 LTS and npm (the committed lockfile is authoritative).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. `/api/health` verifies HTTP availability only; it does
not test MongoDB or Luminal. The foundation runs without credentials. For later
backend milestones, copy `.env.example` to `.env.local` and enter verified values
locally. Never commit secrets or prefix them with `NEXT_PUBLIC_`.

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

## Team handoff

- [API contracts and decisions requiring review](docs/api-contracts.md)
- [Ownership, branches, and teammate setup](docs/team-handoff.md)
- [Shared TypeScript contracts](src/types/contracts.ts)

Backend owns initialization, backend routes, shared contracts, dependencies,
and deployment. Frontend owns dashboard/access screens and styling. Widget
Engine owns iframe execution and the storage bridge. Review the contracts before
parallel implementation. Core workspace, auth, task, widget, generation, and storage endpoints now exist.

## Dependencies

The official initializer installed Next.js 16.4.0, React/React DOM 19.3.0,
TypeScript, Tailwind CSS with its Turbopack integration, ESLint, and type packages.
Next.js configuration intentionally omits optional component caching/prefetch
features. System fonts avoid network-dependent font downloads during builds.

Future backend phases add the official MongoDB driver and established validation,
password hashing, and session libraries when used. Luminal will use server-side
fetch with a verified OpenAI-compatible endpoint/model; no values are invented.

The initial npm audit reports five high-severity entries in the development-only
ESLint dependency chain (braces, micromatch, fast-glob, and Next ESLint).
The available braces release is affected; npm's proposed force-fix downgrades
Next's lint configuration to an incompatible major. Do not apply it blindly.
Track a compatible upstream patch; rerun `npm audit` when updating dependencies.
These entries do not establish that production dependencies are vulnerable.

MongoDB persistence, authentication, shared-storage, and Luminal generation passed focused live checks. Dashboard integration is complete; Vercel deployment remains pending.

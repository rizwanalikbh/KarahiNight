---
name: New workspace lib tsconfig and pnpm overrides gotchas
description: Two non-obvious failure modes when adding a new lib/* package (e.g. copying a skill template like object-storage-web) into this pnpm/TS monorepo.
---

When adding a brand-new package under `lib/` and wiring it into `tsconfig.json` project references from an artifact:

1. Its `tsconfig.json` must set `"composite": true"` (and typically `declarationMap: true`, `emitDeclarationOnly: true`) or any downstream project that references it fails with
   `TS6306: Referenced project '...' must have setting "composite": true`. Copy the pattern from an existing sibling lib (e.g. `lib/api-client-react/tsconfig.json`), don't assume the skill/template's tsconfig already has it.

2. Don't blindly add a root `pnpm.overrides` block for `react`/`react-dom` because a generic skill instruction says to (e.g. "Uppy v5 needs React >=19, override it"). Check `pnpm-workspace.yaml` catalog versions first — if the project's catalog already pins React 19+, the override is unnecessary and `pnpm install` will hard-error with `Cannot resolve version $react in overrides` (root package.json has no direct "react" dependency to reference via `$react`).

**Why:** both mistakes surface only at `pnpm install` / `tsc --build` time, after files are already copied in, wasting a retry cycle.
**How to apply:** when copying any skill template package into `lib/`, immediately check its tsconfig against a sibling lib's tsconfig for composite settings, and check `pnpm-workspace.yaml` catalog before adding any override.

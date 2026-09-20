---
name: Imported pnpm workspaces
description: Lockfile drift is common when importing a pnpm monorepo whose manifest already contains a newly added dependency.
---

When an imported workspace's frozen install reports that package specifiers differ from the lockfile, refresh the lockfile with the workspace's existing pnpm policy before running validation.

**Why:** Frozen installs correctly protect reproducibility, but they cannot repair a repository snapshot whose manifest and lockfile were committed out of sync.

**How to apply:** Treat the mismatch as an import-preparation issue, preserve the workspace's package-manager settings, and rerun the full typecheck/build after the lockfile is synchronized.
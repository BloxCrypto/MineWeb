---
name: Workspace package installation
description: Package installer behavior for dependencies belonging to a pnpm workspace package.
---

When adding a dependency to a workspace package, use that package's dependency manifest and workspace-aware install flow; the generic language-package installer targets the workspace root and rejects pnpm filter flags.

**Why:** The generic installer successfully invoked pnpm but could not scope an install to the API package, while root installation would put the dependency in the wrong package.

**How to apply:** Before adding a package to a non-root workspace, inspect the package manifest and use the repository's supported workspace install path rather than passing pnpm flags as package names.
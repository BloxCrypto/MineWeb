---
name: Mineflayer bundling
description: Runtime bundling constraint for the Mineflayer dependency in this workspace.
---

Keep Mineflayer external to the API server's esbuild bundle and load it as a direct Node runtime dependency.

**Why:** Bundling the library caused the esbuild service to stop during the API build, while externalizing it produced a stable server bundle and preserves its CommonJS runtime behavior.

**How to apply:** When changing the API build configuration or upgrading Mineflayer, retain the external dependency boundary and verify both the bundle and the server startup.
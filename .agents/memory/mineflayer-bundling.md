---
name: Mineflayer bundling
description: Runtime bundling constraint for the Mineflayer dependency in this workspace.
---

Keep Mineflayer and Prismarine Viewer external to the API server's esbuild bundle and load them as direct Node runtime dependencies.

**Why:** Bundling the libraries caused the esbuild service to stop during the API build, while externalizing them produced a stable server bundle and preserves their CommonJS runtime behavior. Prismarine Viewer also needs Canvas's native binary and its system UUID library at runtime.

**How to apply:** When changing the API build configuration or upgrading Mineflayer/pathfinder/viewer, retain the external dependency boundary, import CommonJS packages through a runtime-safe namespace, allow Canvas's build script, and verify both the bundle and server startup.
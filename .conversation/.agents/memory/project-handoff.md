---
name: Project handoff restoration
description: Files from a temporary conversation workspace may need to be restored before registering or publishing the app artifact.
---

After moving a conversation into a project, check `.local/conversation-workspace/files` before assuming the source is present in the active project root. Restore the app source while preserving the generated artifact metadata and managed workflow configuration.

**Why:** The handoff can preserve the imported source separately while the new project contains only generated placeholder artifacts, so publishing the placeholder would omit the user's app.

**How to apply:** Compare the active artifact directories with the preserved files, register any missing deployable artifact, copy source/configuration into it without replacing its managed `artifact.toml`, reinstall dependencies, and restart the managed workflow.
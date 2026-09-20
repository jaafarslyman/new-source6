---
name: Project handoff restoration
description: Files from a temporary conversation workspace may need to be restored before registering or publishing the app artifact.
---

After moving a conversation into a project, check the preserved conversation files before assuming the source is present in the active project root. Restore the app source while preserving generated artifact metadata and managed workflow configuration.

**Why:** A handoff can preserve imported source separately while the new project contains only generated placeholder artifacts, so publishing the placeholder would omit the user's app.

**How to apply:** Compare the active artifact directories with the preserved files, restore missing source/configuration without replacing managed artifact metadata, then reinstall dependencies and restart the managed workflow.
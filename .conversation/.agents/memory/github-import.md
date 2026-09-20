---
name: Private GitHub imports
description: Reliable repository import path when a connected private GitHub repository rejects direct clone or archive requests.
---

Use the connected GitHub API to read the repository tree and blob contents when direct `git clone` or the GitHub tarball endpoint is rejected, even though repository metadata is accessible.

**Why:** Private repositories can return authentication failures for Git transport and 403 responses for archive downloads in this environment, while the authenticated connector proxy still permits file reads.

**How to apply:** Resolve the repository owner/name first, fetch the recursive tree, then fetch each blob through the authenticated connector and write the files locally. Preserve local Replit metadata when importing an existing app.
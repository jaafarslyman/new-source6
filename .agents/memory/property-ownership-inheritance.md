---
name: Property ownership inheritance
description: Ownership scopes on a property are the source of truth for matching newly added units.
---

Property-level owner relationships should remain the source of truth for units that fall inside an owner’s recorded scope. Unit creation may show the matched owner and unit editing may allow an explicit override, but inherited matches should not create redundant unit-level owner rows.

**Why:** Writing both property-level and inherited unit-level rows made one contact appear repeatedly in Contacts and made ownership harder to maintain.

**How to apply:** Resolve numeric lists and ranges from `ownership_scope` when displaying or adding units; only persist a unit-level owner relationship for a deliberate override or a unit with no inherited property owner.
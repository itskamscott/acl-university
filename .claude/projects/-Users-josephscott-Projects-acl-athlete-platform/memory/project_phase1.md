---
name: Phase 1 scope and constraints
description: Phase 1 builds Brand CRM + AI Lab Partner only, strict build order and hard constraints from PROJECT_BRIEF.md
type: project
---

Phase 1 scope: Brand CRM (brand database, pipeline kanban, activity log, follow-ups) + AI Lab Partner (chat with CRM context injection).

**Why:** Ship MVP to 5-10 ACL athletes for beta testing. Everything else (content module, contracts, payments, team features) is explicitly out of scope.

**How to apply:** Always check PROJECT_BRIEF.md before building anything. Follow the 12-step build order strictly. Every new table needs RLS. Mobile-first (test at 375px). One feature per commit. Ask before installing packages. Never leak "Claude" or "Anthropic" into UI.

---
name: Phase 1 design decisions
description: Answers to pre-build questions — brand colors, auth approach, invite codes, field types, RLS, etc.
type: project
---

Decisions confirmed with Kam on 2026-04-21:

**Brand colors:** #f5a42e (orange/accent), #000000 (black), #ffffff (white), #2855c6 (blue), #7ed957 (green). Logo file exists — need Kam to provide it.

**Auth approach:** Email + password signup/login + Google OAuth. No magic links. CONFIRMED.

**Invite-only signup:** Invite codes on signup + admin page for Kam to generate/manage codes. CONFIRMED.

**Logo file:** /Users/josephscott/Downloads/ACL+ Main Logo.png (beaker with ACL+ text, blue/black/white). Copy into project as public/logo.png.

**Lab Partner voice:** Full voice guide at /Users/josephscott/Downloads/LAB_PARTNER_VOICE.md. Store as lib/lab-partner/voice.ts. Key rules: no filler openers, no AI scaffolding words, no em dashes, short answers (1-4 sentences default), specific over vague, three athlete archetypes (Marcus/Destiny/Jordan).

**Sport field:** Free text input.
**School field:** Free text input.

**RLS:** Enable on ALL four tables including `athletes`. Each athlete only sees their own data.

**updated_at:** Add to all tables for consistency, even append-only ones.

**Lab Partner tone:** Incorporate Kam's humanizer skill and voice guidelines into system prompt. Need Kam to share those guidelines.

**Drag-and-drop:** Will propose a library when we reach build step 6.

**Infrastructure:** Supabase project exists. GitHub repo and Vercel project need to be created.

**Why:** These decisions lock in the approach so we don't revisit them mid-build.
**How to apply:** Reference this file when implementing auth, signup, styling, and schema setup.

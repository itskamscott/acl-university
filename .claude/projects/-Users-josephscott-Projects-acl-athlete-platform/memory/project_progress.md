---
name: Build progress as of 2026-04-21
description: Steps 1-10 complete, debugging invite code flow, polish pass not started yet
type: project
---

**Completed Steps (all committed and pushed to main):**
1. Project init (Next.js 16 + Tailwind 4 + shadcn/ui + Vercel)
2. Supabase schema (5 tables with RLS, triggers, indexes)
3. Auth flow (invite codes, email+password, Google OAuth, protected routes)
4. Dashboard shell (sidebar + mobile bottom bar)
5. Brand CRM: list + add + detail with inline editing
6. Pipeline view (kanban desktop, grouped scroll mobile)
7. Activity log + follow-up reminders on dashboard
8. Lab Partner basic chat with Anthropic API
9. Lab Partner CRM context injection (in system prompt)
10. Lab Partner floating panel on all authenticated pages

**Current state:** Debugging invite code signup flow. Fixed middleware blocking /api/verify-invite. Awaiting Vercel deploy to confirm fix works.

**Remaining:**
- Step 11: Polish pass (empty states, error states, loading states, mobile responsiveness at 375px)
- Step 12: Beta test with 5-10 athletes
- Admin page for managing invite codes (Kam requested)
- Connect custom domain app.athletecreatorlab.com

**Known issues to verify next session:**
- Invite code signup flow (should be fixed with latest push)
- Signup creates athlete profile via client-side Supabase (may hit RLS issues like invite codes did, may need server-side API route)
- Google OAuth not tested yet
- Email confirmation was toggled off in Supabase auth settings

**DB password for psql:** Use connection string with aws-1-us-east-1 (not aws-0)

**Why:** Tracking progress so next conversation can pick up without re-reading everything.
**How to apply:** Check this file at start of next session to know where we left off.

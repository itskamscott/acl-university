# ACL+ — Project Brief

**Owner:** Kam Scott, Founder and CEO, Athlete Creator Lab
**Last updated:** April 21, 2026
**Status:** Phase 1 build — Brand CRM + AI Lab Partner

This document is the source of truth for the project. When Claude Code has a question about scope, stack, or direction, the answer is here first. If the answer isn't here, stop and ask Kam before guessing.

---

## 1. What we're building

A web application that helps college athletes in the Athlete Creator Lab community run their NIL businesses. The app eventually handles three jobs:

1. Content creation and management for the athlete's personal brand
2. Brand discovery, outreach, and relationship management (CRM)
3. Contract and deliverable management once a deal is signed

Plus a persistent AI assistant called **AI Lab Partner** that has context across all three modules.

**Phase 1 ships the Brand CRM and the Lab Partner only.** Modules 1 and 3 come later. Do not build them.

The product name is `ACL+` (chosen April 2026). The parent brand is `Athlete Creator Lab (ACL)` and the community lives at https://skool.com/athletecreatorlab.

---

## 2. Who this is for

College athletes across D1, D2, and D3 programs. The majority are underclassmen with little business experience. They are not technical. They are busy. They want tools that are fast, clean, and obvious.

Design and copy assumptions:
- Mobile-first. Most athletes will open this on their phone between classes and practice.
- Short copy. No long paragraphs in the UI.
- Plain language. No jargon. If there's a word an 18-year-old wouldn't use, change it.
- Fast. If a page takes more than 2 seconds to load, something is wrong.

---

## 3. Tech stack (locked in)

Do not substitute any of these without Kam's approval.

| Layer | Tool | Why |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Most documented, Claude Code handles it well |
| Styling | Tailwind CSS | Fast, consistent, pairs with Next.js |
| UI components | shadcn/ui | Clean defaults, easy to customize |
| Database | Supabase (Postgres) | Managed, has auth built in, free tier |
| Auth | Supabase Auth | Email magic link + Google OAuth |
| AI | Anthropic API, Claude Sonnet 4.5 | For Lab Partner |
| Hosting | Vercel | Free tier, connects to GitHub, connects to custom domain |
| Version control | Git + GitHub | Standard |
| Domain | app.athletecreatorlab.com | Subdomain of existing domain |

Environment variables the project will need:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never expose)
- `ANTHROPIC_API_KEY` (server-side only, never expose)

Always use `.env.local` for local dev. Never commit keys to Git.

---

## 4. Phase 1 scope: Brand CRM + Lab Partner

### 4.1 Brand CRM module

The athlete needs to find local brands, track outreach, and move prospects through a pipeline until a deal is signed (at which point a contract gets handed off to Phase 3, which doesn't exist yet).

**Core features:**

1. **Brand database (the athlete's personal list).** Each athlete maintains their own list of brands they're targeting. Fields per brand:
   - Business name
   - Category (restaurant, fitness, retail, auto, healthcare, real estate, other)
   - Location (city, state)
   - Website
   - Instagram handle
   - Primary contact name
   - Primary contact email
   - Primary contact phone
   - Notes (free text)
   - Status (one of: `prospect`, `contacted`, `in_conversation`, `negotiating`, `deal_closed`, `not_a_fit`)
   - Date added
   - Last touch date

2. **Add brand flow.** Athlete can add a brand manually via form. Later (not Phase 1) we'll add scraping and AI enrichment.

3. **Pipeline view.** Kanban-style board with columns for each status. Drag to change status. Mobile version is a vertical scroll of status groups, not drag-and-drop.

4. **Brand detail page.** Clicking a brand opens a full view with:
   - All fields above, editable inline
   - Activity log: every outreach, note, status change, timestamped
   - Quick actions: Log outreach, Add note, Change status

5. **Outreach log.** Each outreach event records:
   - Date
   - Channel (email, DM, call, in-person, other)
   - Notes on what was said
   - Response received? (yes/no/pending)
   - Next follow-up date

6. **Follow-up reminders.** Dashboard shows "brands to follow up on today" based on the next follow-up date. No email notifications in Phase 1. Just in-app.

7. **Simple filters on pipeline view.** Filter by status, category, location. That's it.

**Not in Phase 1 (note these and don't build them):**
- Email integration (sending emails from the app)
- Brand scraping / lead enrichment
- Automated outreach sequences
- Team features / sharing brands between athletes
- Contracts (separate module, Phase 3)

### 4.2 AI Lab Partner

An always-available AI assistant. Appears as a chat panel accessible from anywhere in the app (sidebar on desktop, bottom sheet on mobile).

**What it does in Phase 1:**

1. **Answers questions about NIL, brand outreach, content, and athlete business.** General expertise.

2. **Has context on the athlete's brand CRM.** When the athlete asks something like "what brands haven't I followed up with in 2 weeks?" or "help me draft an outreach email to the coffee shop I just added," the Lab Partner can see the athlete's CRM data.

3. **Drafts content.** Outreach emails, DMs, follow-up messages, pitch decks (text only in Phase 1). Athlete copies and pastes.

4. **Persistent memory within a session, and across sessions per athlete.** The Lab Partner remembers what the athlete has discussed before. Implementation: store conversation history per athlete in Supabase, load last N messages (start with 20) into context on each new message.

5. **Named "AI Lab Partner" everywhere in the UI.** Not "Claude", not "AI Assistant", not "Chatbot".

**Technical approach for context injection:**

On every message sent to the Lab Partner, the backend:
1. Pulls the athlete's 20 most recent CRM entries (brand + status + last touch)
2. Pulls the athlete's last 20 messages with the Lab Partner
3. Builds a system prompt that includes athlete name, current date, and CRM snapshot
4. Sends conversation history + new message to Anthropic API
5. Returns response, saves it to message history

**System prompt for the Lab Partner (draft — refine during build):**

> You are AI Lab Partner, the personal NIL and business assistant for an athlete inside Athlete Creator Lab (ACL). You help them find and close local brand partnerships, draft outreach, manage their pipeline, and think strategically about their personal brand. You are direct, practical, and talk like a trusted older teammate who runs a business — not like a corporate chatbot. Short answers by default. Longer only when asked or when it genuinely helps.
>
> You have access to the athlete's current brand CRM. Use it when relevant. Don't reference it when it's not.
>
> Never pretend to have information you don't have. If the athlete asks about something outside their data, say so and help them think through it.

**Not in Phase 1:**
- Voice input / output
- Image generation
- Action-taking (the Lab Partner can draft but can't send emails or update the CRM on its own yet)
- Multi-turn tool use / agents

---

## 5. Data model (Phase 1)

Four tables in Supabase. Use `uuid` for all primary keys. Use `created_at` and `updated_at` timestamps on every table.

### `athletes`
- `id` (uuid, pk)
- `auth_user_id` (uuid, fk to Supabase auth.users)
- `full_name` (text)
- `email` (text, unique)
- `sport` (text)
- `school` (text)
- `graduation_year` (int)
- `phone` (text, nullable)
- `created_at`, `updated_at`

### `brands`
- `id` (uuid, pk)
- `athlete_id` (uuid, fk to athletes)
- `business_name` (text)
- `category` (text, enum via check constraint)
- `city` (text, nullable)
- `state` (text, nullable)
- `website` (text, nullable)
- `instagram_handle` (text, nullable)
- `contact_name` (text, nullable)
- `contact_email` (text, nullable)
- `contact_phone` (text, nullable)
- `notes` (text, nullable)
- `status` (text, enum: prospect, contacted, in_conversation, negotiating, deal_closed, not_a_fit)
- `next_followup_date` (date, nullable)
- `created_at`, `updated_at`

### `brand_activities`
- `id` (uuid, pk)
- `brand_id` (uuid, fk to brands)
- `athlete_id` (uuid, fk to athletes)
- `activity_type` (text, enum: outreach, note, status_change)
- `channel` (text, nullable — only for outreach: email, dm, call, in_person, other)
- `content` (text)
- `response_received` (boolean, nullable — only for outreach)
- `created_at`

### `lab_partner_messages`
- `id` (uuid, pk)
- `athlete_id` (uuid, fk to athletes)
- `role` (text: user or assistant)
- `content` (text)
- `created_at`

**Row-level security:** Every table except `athletes` must have RLS enabled. Athletes can only see their own rows. This is non-negotiable.

---

## 6. UI structure

### Routes

```
/                          -> marketing landing (simple for now)
/login                     -> Supabase auth
/signup                    -> Supabase auth + create athlete profile
/dashboard                 -> overview: today's followups, pipeline summary, quick actions
/brands                    -> pipeline view (kanban)
/brands/new                -> add brand form
/brands/[id]               -> brand detail page
/lab-partner               -> full-screen Lab Partner chat
/settings                  -> athlete profile, sign out
```

The Lab Partner is also available as a floating panel on every authenticated route (not just `/lab-partner`).

### Navigation

Desktop: left sidebar with Dashboard, Brands, Lab Partner, Settings.
Mobile: bottom tab bar with the same four items.

### Design direction

- Clean. White/off-white background. Dark text. One accent color (TBD — Kam will pick; placeholder is ACL brand orange if that exists, otherwise a neutral blue).
- Typography: Inter or similar sans-serif. Bigger than you think on mobile.
- No gradients, no glassmorphism, no decorative illustrations. This is a work tool.
- Lots of white space. Don't cram.

---

## 7. Build order (Phase 1)

Do these in order. Do not skip ahead. Do not start a step until the previous one is working and committed to Git.

1. **Project initialization.** Next.js app, Tailwind, shadcn/ui, Git, GitHub, Vercel deploy pipeline. Verify deployment works with a "Hello ACL" placeholder page.

2. **Supabase setup.** Create tables with the schema above, enable RLS, wire up the Supabase client. Verify connection from the Next.js app.

3. **Auth flow.** Email magic link signup and login. Create athlete profile on first signup. Protected routes.

4. **Dashboard shell.** Navigation (sidebar + mobile bottom bar), layout, placeholder content.

5. **Brand CRM: list + add + detail.** Build the three core screens. No kanban yet — just a simple list first. Prove the data layer works.

6. **Brand CRM: pipeline view.** Kanban on desktop, grouped scroll on mobile.

7. **Brand CRM: activity log + follow-ups.** Outreach logging, notes, status changes, and the "follow-ups for today" widget on the dashboard.

8. **Lab Partner: basic chat.** Full-screen version at `/lab-partner`. Anthropic API integration. Message history stored in Supabase.

9. **Lab Partner: CRM context injection.** Pull athlete's brands into the system prompt. Test with real questions.

10. **Lab Partner: floating panel.** Make it accessible from every page.

11. **Polish pass.** Copy, empty states, error states, loading states, mobile responsiveness, performance.

12. **Beta test.** Ship to 5 to 10 athletes in the ACL community. Collect feedback. Fix.

---

## 8. Hard constraints

Claude Code must follow these. Violations get rolled back.

1. **Never commit secrets.** All API keys in `.env.local`. `.env.local` is in `.gitignore`. Double-check before every commit.

2. **Never skip RLS.** Every new table gets RLS the day it's created. Test it with a second fake user to prove isolation.

3. **Mobile must work.** Every screen. Test at 375px width before marking anything "done."

4. **No feature creep.** If it's not in this brief, don't build it. Flag it and ask.

5. **Ship in small commits.** One feature per commit. Commit messages describe what works after the commit, not what was done.

6. **The Lab Partner is always "AI Lab Partner" in the UI.** Never leak "Claude" or "Anthropic" into the interface. In the backend code it's fine.

7. **Ask before installing new packages.** Every `npm install` of a new dependency gets surfaced to Kam first with a one-sentence reason.

8. **Tailwind only for styling.** No CSS-in-JS libraries, no separate CSS files except `globals.css`.

9. **Server components by default, client components only when needed.** Next.js App Router best practice.

10. **Write code like someone else will maintain it.** Clear names, small functions, comments on anything clever.

---

## 9. Out of scope for Phase 1 (explicit)

Do not build any of these. If Kam mentions them, point at this section.

- Content module (creating/scheduling posts, content calendar)
- Contract module (deliverables, deadlines, signatures)
- Payments
- Team features (coaches, parents, agents)
- Public athlete profiles
- Brand scraping or auto-enrichment
- Email sending from the platform
- Notifications (email, SMS, push)
- Admin dashboard for ACL staff
- Analytics / reporting dashboards beyond what the CRM inherently shows
- Native mobile app

---

## 10. Success criteria for Phase 1

We're done with Phase 1 when:

1. An athlete can sign up, log in, and land on their dashboard in under 60 seconds.
2. They can add a brand, log outreach against it, and move it through the pipeline.
3. They can chat with the AI Lab Partner and get useful answers that reference their actual CRM data.
4. Everything works on an iPhone in Safari.
5. Five real ACL athletes have used it for a week without major complaints.
6. The app is live at app.athletecreatorlab.com.

---

## 11. Open questions for Kam to answer before build starts

Claude Code should flag these in its first read-through and ask before proceeding.

1. **Accent color and logo.** Do you want to use ACL's existing brand colors? Share hex codes and a logo file.
2. **Signup gatekeeping.** Should anyone be able to sign up, or only athletes with an ACL invite code? If invite-only, how do invites work?
3. **Sport list.** Should the sport field be free-text or a dropdown with a fixed list?
4. **School list.** Same question — free text or a curated list?
5. **Lab Partner tone samples.** Do you want to feed in examples of how you want it to talk? (Kam has a humanizer skill and voice guidelines — consider pointing Claude Code at them.)

---

End of brief.

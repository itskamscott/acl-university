# Brand Vault (Door 1)

Athletes browse brand-partner offers at `/vault`, reveal one discount code at a time (capped at **3 per calendar month, UTC**), and get sent to the brand's site to redeem.

There is no brand-facing UI in v1. Offers are managed by ACL admins at `/admin/brand-partners` (or directly via the Supabase dashboard if you'd rather).

## Adding a new brand partner

1. Sign in as an admin and go to **Admin → Brand Vault** (or `/admin/brand-partners`).
2. Click **+ New brand** and fill in:
   - **Brand name** (required) — public-facing brand name, e.g. `Gymshark`.
   - **Logo URL** (optional) — any https URL. Square images render best (40–48px). If empty, athletes see a single-letter fallback.
   - **Website URL** (required) — where the **Shop now** button sends the athlete. Must be `https`.
   - **Offer headline** (required) — short marketing line, e.g. `15% off your first order`. Shown on the card under the brand name.
   - **Offer description** (optional) — fuller copy with terms, e.g. `New customers only. Excludes accessories.`.
   - **Discount code** (required) — the code revealed to athletes. Displayed verbatim.
   - **Display order** — lower numbers sort first. The form pre-fills `max + 10` so you can drop a brand between two existing ones later.
   - **Active** — leave checked to publish, uncheck to hide without deleting reveal history.
3. Click **Add brand**. The athlete-facing `/vault` page revalidates automatically.

## Editing, hiding, deleting

- **Edit** — pencil icon on the row. Changing the discount code mid-month means athletes who already revealed will see the *new* code on their next visit, since reveals only store who/what/when, not the code value at reveal time.
- **Hide** — the **Hide / Activate** button toggles `is_active`. Hidden brands disappear from `/vault` but stay in the admin list. Reveal history is preserved.
- **Delete** — trash icon. The FK is `ON DELETE CASCADE`, so deleting a brand wipes its reveal rows too. The UI confirms with the reveal count before deleting; **prefer Hide over Delete** to keep attribution.

## How gating works

A reveal is only inserted if:

1. The athlete's profile has all of: `full_name`, `sport`, `school`, `instagram_handle`, `shipping_address`, and a verified email (`auth.users.email_confirmed_at IS NOT NULL`).
2. They've used fewer than **3 reveals** since the start of the current UTC calendar month.
3. They haven't already revealed this brand. Re-opening a brand they already revealed shows the same code without consuming a new reveal.

All three checks are enforced atomically inside the `reveal_brand_code(p_brand_partner_id uuid)` RPC (`supabase/migrations/013_brand_vault.sql`). Even a malicious client can't bypass them — the RPC always derives `athlete_id` from `auth.uid()`.

Errors raised by the RPC map to typed errors in `src/app/(authenticated)/vault/actions.ts`:

| SQLSTATE | Meaning |
| --- | --- |
| `P0001` | Athlete row not found for this auth user |
| `P0002` | Brand inactive or doesn't exist |
| `P0003` | Profile incomplete |
| `P0004` | Monthly cap reached |

## Local testing

```bash
supabase db reset    # applies all migrations + seeds 3 example brands
```

Then sign in as a test athlete, visit `/vault`, and try revealing.

## What's NOT in v1

- No brand-facing dashboard — admins use Supabase directly.
- No analytics or attribution tracking.
- No email notifications when new brands are added.
- No campaigns / Door 2 features.
- No shipping or inventory management.

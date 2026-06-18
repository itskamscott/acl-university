// One-shot pre-launch schema check. Reads .env.local, hits remote Supabase
// with the service-role key, and reports which migrations are applied.
// Usage: node scripts/verify-prod-schema.mjs

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(join(here, "..", ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, "")];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const checks = [];
function pass(label) { checks.push({ ok: true, label }); }
function fail(label, msg) { checks.push({ ok: false, label, msg }); }

async function checkColumn(table, column, migration) {
  const { error } = await supabase.from(table).select(column).limit(1);
  if (error) {
    if (/does not exist|column .* does not exist/i.test(error.message)) {
      fail(`${table}.${column} (migration ${migration})`, error.message);
    } else {
      fail(`${table}.${column} (migration ${migration})`, `unexpected: ${error.message}`);
    }
  } else {
    pass(`${table}.${column} (migration ${migration})`);
  }
}

async function checkTable(table, migration) {
  const { error } = await supabase.from(table).select("*").limit(1);
  if (error) {
    if (/does not exist|relation .* does not exist|schema cache/i.test(error.message)) {
      fail(`table ${table} (migration ${migration})`, error.message);
    } else {
      fail(`table ${table} (migration ${migration})`, `unexpected: ${error.message}`);
    }
  } else {
    pass(`table ${table} (migration ${migration})`);
  }
}

async function checkRpc(name, args, migration) {
  // We expect this to error with the RPC's typed error, NOT a "function not found".
  const { error } = await supabase.rpc(name, args);
  if (error && /could not find the function|does not exist/i.test(error.message)) {
    fail(`rpc ${name} (migration ${migration})`, error.message);
  } else {
    // Even if it returns a logical error like P0001/P0002, the function exists.
    pass(`rpc ${name} (migration ${migration})`);
  }
}

console.log("Verifying remote Supabase schema...\n");

// Migration 006 — invited_email on invite_codes
await checkColumn("invite_codes", "invited_email", "006");

// Migration 012 — email preferences on athletes
await checkColumn("athletes", "email_follow_up_reminders", "012");
await checkColumn("athletes", "email_weekly_digest", "012");

// Migration 013 — Brand Vault
await checkColumn("athletes", "instagram_handle", "013");
await checkColumn("athletes", "shipping_address", "013");
await checkTable("brand_partners", "013");
await checkTable("reveals", "013");
await checkRpc("reveal_brand_code", { p_brand_partner_id: "00000000-0000-0000-0000-000000000000" }, "013");

const failed = checks.filter((c) => !c.ok);
const passed = checks.filter((c) => c.ok);

for (const c of passed) console.log(`  OK  ${c.label}`);
for (const c of failed) console.log(`  FAIL ${c.label}\n       ${c.msg}`);

console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length === 0 ? 0 : 1);

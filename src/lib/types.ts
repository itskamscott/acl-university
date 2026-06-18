export type BrandCategory =
  | "restaurant"
  | "fitness"
  | "retail"
  | "auto"
  | "healthcare"
  | "real_estate"
  | "other";

export type BrandStatus =
  | "prospect"
  | "contacted"
  | "in_conversation"
  | "negotiating"
  | "deal_closed"
  | "not_a_fit";

export const BRAND_CATEGORIES: { value: BrandCategory; label: string }[] = [
  { value: "restaurant", label: "Restaurant" },
  { value: "fitness", label: "Fitness" },
  { value: "retail", label: "Retail" },
  { value: "auto", label: "Auto" },
  { value: "healthcare", label: "Healthcare" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

export const BRAND_STATUSES: { value: BrandStatus; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "contacted", label: "Contacted" },
  { value: "in_conversation", label: "In Conversation" },
  { value: "negotiating", label: "Negotiating" },
  { value: "deal_closed", label: "Deal Closed" },
  { value: "not_a_fit", label: "Not a Fit" },
];

export interface Brand {
  id: string;
  athlete_id: string;
  business_name: string;
  category: BrandCategory;
  city: string | null;
  state: string | null;
  website: string | null;
  instagram_handle: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  status: BrandStatus;
  next_followup_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandActivity {
  id: string;
  brand_id: string;
  athlete_id: string;
  activity_type: "outreach" | "note" | "status_change";
  channel: "email" | "dm" | "call" | "in_person" | "other" | null;
  content: string;
  response_received: boolean | null;
  created_at: string;
  updated_at: string;
}

export type AthleteTier = "member" | "insider" | "lab_partner" | "founder";

export const ATHLETE_TIERS: { value: AthleteTier; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "insider", label: "Insider" },
  { value: "lab_partner", label: "Lab Partner" },
  { value: "founder", label: "Founder" },
];

export const POD_SIZE_MIN = 5;
export const POD_SIZE_MAX = 8;

export interface Athlete {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  sport: string | null;
  school: string | null;
  graduation_year: number | null;
  phone: string | null;
  instagram_handle: string | null;
  shipping_address: string | null;
  is_admin: boolean;
  tier: AthleteTier;
  credits: number;
  email_follow_up_reminders: boolean;
  email_weekly_digest: boolean;
  email_brand_drops: boolean;
  last_seen_vault_at: string;
  created_at: string;
  updated_at: string;
}

export interface Pod {
  id: string;
  name: string;
  lab_partner_id: string;
  created_at: string;
  archived_at: string | null;
}

export interface PodMembership {
  id: string;
  pod_id: string;
  athlete_id: string;
  joined_at: string;
  left_at: string | null;
}

export type BrandPartnerCategory =
  | "apparel"
  | "food"
  | "tech"
  | "fitness"
  | "beauty"
  | "wellness"
  | "finance"
  | "other";

export const BRAND_PARTNER_CATEGORIES: { value: BrandPartnerCategory; label: string }[] = [
  { value: "apparel", label: "Apparel" },
  { value: "food", label: "Food & Drink" },
  { value: "tech", label: "Tech" },
  { value: "fitness", label: "Fitness" },
  { value: "beauty", label: "Beauty" },
  { value: "wellness", label: "Wellness" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

export interface BrandPartner {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string;
  offer_headline: string;
  offer_description: string | null;
  discount_code: string;
  category: BrandPartnerCategory;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Reveal {
  id: string;
  athlete_id: string;
  brand_partner_id: string;
  revealed_at: string;
}

export const VAULT_MONTHLY_CAP = 3;

export function isProfileCompleteForVault(athlete: Athlete, emailVerified: boolean): boolean {
  return (
    emailVerified &&
    !!athlete.full_name?.trim() &&
    !!athlete.sport?.trim() &&
    !!athlete.school?.trim() &&
    !!athlete.instagram_handle?.trim() &&
    !!athlete.shipping_address?.trim()
  );
}

export interface InviteCode {
  id: string;
  code: string;
  used_by: string | null;
  invited_email: string | null;
  expires_at: string | null;
  created_at: string;
}

export type ContractStatus = "draft" | "active" | "completed" | "cancelled";
export type ContractSource = "manual" | "uploaded" | "generated";

export interface Contract {
  id: string;
  athlete_id: string;
  brand_id: string | null;
  title: string;
  total_value_cents: number | null;
  currency: string;
  signed_at: string | null;
  status: ContractStatus;
  source: ContractSource;
  contract_file_path: string | null;
  generated_content: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const CONTRACT_STATUSES: { value: ContractStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export interface Deliverable {
  id: string;
  contract_id: string;
  athlete_id: string;
  description: string;
  due_date: string | null;
  completed_at: string | null;
  proof_url: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ContractPayment {
  id: string;
  contract_id: string;
  athlete_id: string;
  amount_cents: number;
  currency: string;
  due_date: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentPlatform = "instagram" | "tiktok" | "youtube" | "x" | "other";
export type ContentStatus = "idea" | "drafted" | "scheduled" | "posted";

export interface ContentPost {
  id: string;
  athlete_id: string;
  brand_id: string | null;
  title: string | null;
  platform: ContentPlatform;
  status: ContentStatus;
  planned_for: string | null;
  posted_at: string | null;
  caption: string | null;
  posted_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const CONTENT_PLATFORMS: { value: ContentPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
  { value: "other", label: "Other" },
];

export const CONTENT_STATUSES: { value: ContentStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "drafted", label: "Drafted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "posted", label: "Posted" },
];

export type FeedbackType = "bug" | "feature" | "other";

export interface Feedback {
  id: string;
  athlete_id: string | null;
  athlete_email: string | null;
  athlete_name: string | null;
  type: FeedbackType;
  message: string;
  email_sent: boolean;
  created_at: string;
}

export const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Other" },
];

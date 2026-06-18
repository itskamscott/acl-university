export interface CreditTier {
  id: "starter" | "pro" | "power";
  credits: number;
  priceCents: number;
  label: string;
  tagline: string;
}

export const CREDIT_TIERS: CreditTier[] = [
  {
    id: "starter",
    credits: 100,
    priceCents: 500,
    label: "Starter",
    tagline: "~100 chats",
  },
  {
    id: "pro",
    credits: 400,
    priceCents: 1500,
    label: "Pro",
    tagline: "Best value",
  },
  {
    id: "power",
    credits: 1000,
    priceCents: 3000,
    label: "Power",
    tagline: "For heavy outreach seasons",
  },
];

export function getTier(id: string): CreditTier | undefined {
  return CREDIT_TIERS.find((t) => t.id === id);
}

export function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

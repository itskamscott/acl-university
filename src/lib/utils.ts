import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function describeFollowup(date: string | null, today: string): { label: string; tone: "overdue" | "today" | "future" } | null {
  if (!date) return null;
  if (date < today) {
    return { label: "Overdue", tone: "overdue" };
  }
  if (date === today) {
    return { label: "Today", tone: "today" };
  }
  const label = new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { label, tone: "future" };
}

export function describeTouchedAge(updatedAt: string, now: Date): string {
  const diffMs = now.getTime() - new Date(updatedAt).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1mo ago";
  return `${months}mo ago`;
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, MessageCircle, Settings, Shield, ExternalLink, FileText, Clapperboard, Gift, Zap, UsersRound } from "lucide-react";
import { useCredits } from "@/components/credits-provider";
import { FeedbackButton } from "@/components/feedback-button";
import { SKOOL_COMMUNITY_URL } from "@/lib/links";
import type { AthleteTier, AthleteTeamContext } from "@/lib/types";

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brands", label: "My Brands", icon: Building2 },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/content", label: "Content", icon: Clapperboard },
  { href: "/vault", label: "Brand Vault", icon: Gift },
  { href: "/coach", label: "AI Assistant", icon: MessageCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Mobile bottom-nav labels are tighter than the desktop sidebar — abbreviate
// multi-word labels so they fit at text-[10px] without truncating mid-word.
const MOBILE_LABEL_OVERRIDES: Record<string, string> = {
  "My Brands": "Brands",
  "Brand Vault": "Vault",
  "AI Assistant": "AI",
};

const podNavItem = { href: "/pod", label: "Pod", icon: UsersRound };
const adminNavItem = { href: "/admin", label: "Admin", icon: Shield };

export function AppShell({
  children,
  isAdmin = false,
  tier,
  newVaultCount = 0,
  teamContext,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
  tier?: AthleteTier;
  newVaultCount?: number;
  teamContext?: AthleteTeamContext;
}) {
  const pathname = usePathname();
  const inProgram = tier === "insider" || tier === "lab_partner";
  const navItems = [
    ...baseNavItems,
    ...(inProgram ? [podNavItem] : []),
    ...(isAdmin ? [adminNavItem] : []),
  ];

  const badgeFor = (href: string): number => {
    if (href === "/vault") return newVaultCount;
    return 0;
  };
  const { credits } = useCredits();
  // Full-bleed pages manage their own bottom spacing so the chat input can
  // sit flush against the mobile tab bar with no white gap underneath.
  const isFullBleedMobile = pathname.startsWith("/coach");

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-clip bg-zinc-50 dark:bg-zinc-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="px-5 py-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="ACL+" width={28} height={28} />
            <span className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">ACL+</span>
          </div>
          {teamContext?.team && (
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {teamContext.team.name}
              {teamContext.org?.name ? ` · ${teamContext.org.name}` : ""}
            </p>
          )}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const badge = badgeFor(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-acl-orange/10 text-acl-orange"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-acl-orange" />
                )}
                <item.icon
                  className={`h-[18px] w-[18px] transition-colors ${isActive ? "text-acl-orange" : "text-zinc-400 group-hover:text-zinc-600"}`}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {badge > 0 && (
                  <span className="shrink-0 rounded-full bg-acl-orange px-1.5 py-0.5 text-[10px] font-bold text-white leading-none min-w-[18px] text-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div
          className={`mx-3 rounded-xl p-3 shadow-sm transition-all border ${
            credits === 0
              ? "border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/10"
              : "border-acl-orange/30 dark:border-acl-orange/20 bg-gradient-to-br from-acl-orange/10 via-acl-orange/5 to-transparent"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                credits === 0
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                  : "bg-acl-orange/15 text-acl-orange"
              }`}
            >
              <Zap className="h-3.5 w-3.5" fill="currentColor" />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-base font-bold tabular-nums leading-none ${
                  credits === 0 ? "text-red-600" : "text-acl-black dark:text-zinc-100"
                }`}
              >
                {credits.toLocaleString()}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider font-medium text-zinc-500">
                Credits
              </p>
            </div>
          </div>
          <Link
            href="/settings#credits"
            className={`mt-2.5 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              credits === 0
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-acl-orange text-white hover:bg-acl-orange/90"
            }`}
          >
            {credits === 0 ? "Out of credits — top up" : "Top up"}
          </Link>
        </div>
        <a
          href={SKOOL_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-3 mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100"
        >
          <span>ACL community</span>
          <ExternalLink className="h-3 w-3" />
        </a>
        <div className="mx-3 mb-4">
          <FeedbackButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 md:pl-60">
        <div
          className={`${
            isFullBleedMobile ? "" : "pb-[var(--mobile-nav-h)]"
          } md:pb-0 animate-in fade-in duration-300`}
        >
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex md:hidden h-[var(--mobile-nav-h)] border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const shortLabel = MOBILE_LABEL_OVERRIDES[item.label] ?? item.label;
          const badge = badgeFor(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-no-min-tap
              className={`relative flex flex-1 min-w-0 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-acl-orange" : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-b-full bg-acl-orange" />
              )}
              <div className="relative">
                <item.icon className="h-5 w-5 shrink-0" />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 rounded-full bg-acl-orange px-1 py-0 text-[9px] font-bold text-white leading-[14px] min-w-[14px] text-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-full">{shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { Building2, MessageCircle, FileText, Clapperboard } from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Brand CRM",
    copy: "Track every local business you're pursuing. Kanban pipeline, follow-up reminders, stalled-deal flags.",
  },
  {
    icon: MessageCircle,
    title: "AI Assistant",
    copy: "Your always-on NIL assistant. Drafts outreach, reads your CRM, updates brands and content on your behalf.",
  },
  {
    icon: FileText,
    title: "Contracts",
    copy: "Upload a contract a brand sent you. ACL+ reads it and auto-fills deliverables and payment schedule.",
  },
  {
    icon: Clapperboard,
    title: "Content calendar",
    copy: "Capture ideas, draft captions, schedule posts across every platform. Never miss a gameday.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950">
      {/* Top nav */}
      <header className="flex items-center justify-between px-5 py-5 md:px-10">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="ACL+" width={32} height={32} priority />
          <span className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">ACL+</span>
        </div>
        <Link
          href="/login"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-5 py-16 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-acl-orange">
          Athlete Creator Lab
        </p>
        <h1 className="mt-4 max-w-3xl text-center text-5xl font-bold tracking-tight text-acl-black dark:text-zinc-100 md:text-6xl lg:text-7xl">
          Run your NIL
          <br />
          like a business.
        </h1>
        <p className="mt-6 max-w-xl text-center text-base text-zinc-600 dark:text-zinc-300 md:text-lg">
          Brand CRM, AI Assistant, contract autopilot, and a content calendar —
          one app for every side of your personal brand.
        </p>
        <div className="mt-8 flex flex-col gap-3 w-full max-w-xs sm:flex-row sm:max-w-none sm:w-auto">
          <Link
            href="/signup"
            className="rounded-lg bg-acl-orange px-6 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-acl-orange/90 hover:shadow-md"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-6 py-3 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-200 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            I have an account
          </Link>
        </div>
        <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">Invite-only for ACL community members.</p>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            What&apos;s inside
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-acl-black dark:text-zinc-100 md:text-4xl">
            Everything you need to close local brand deals.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-acl-orange/10 text-acl-orange">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold tracking-tight text-acl-black dark:text-zinc-100">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.copy}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-8 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-zinc-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Athlete Creator Lab</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-acl-black dark:hover:text-zinc-100 transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-acl-black dark:hover:text-zinc-100 transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

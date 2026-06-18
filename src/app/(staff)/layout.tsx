import Link from "next/link";
import Image from "next/image";
import { getStaffProfileOrRedirect } from "@/lib/get-staff";
import { ToastProvider } from "@/components/toast-provider";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/app/(authenticated)/settings/sign-out-button";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getStaffProfileOrRedirect();

  // Resolve the org name when the staffer belongs to one (uni-admin or
  // team-manager that's been org-bound). ACL admins span all orgs.
  let orgName: string | null = null;
  if (profile.org_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.org_id)
      .maybeSingle();
    orgName = data?.name ?? null;
  }

  const roleLabel =
    profile.role === "acl_admin"
      ? "ACL Admin"
      : profile.role === "university_admin"
        ? "Athletic Director"
        : "Coach";

  return (
    <ToastProvider>
      <div className="flex min-h-screen w-full bg-zinc-50 dark:bg-zinc-950">
        {/* Sidebar */}
        <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="px-5 py-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="ACL University" width={28} height={28} />
              <span className="text-base font-bold tracking-tight text-acl-black dark:text-zinc-100">
                ACL Staff
              </span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {roleLabel}
              {orgName ? ` · ${orgName}` : profile.role === "acl_admin" ? " · All Orgs" : ""}
            </p>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            <NavLink href="/teams" label="Teams" />
          </nav>
          <div className="px-3 pb-4">
            <SignOutButton />
          </div>
        </aside>

        {/* Mobile header (no bottom nav for V1 — staff use desktop more) */}
        <header className="md:hidden sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 flex items-center justify-between">
          <Link href="/teams" className="flex items-center gap-2">
            <Image src="/logo.png" alt="ACL" width={24} height={24} />
            <span className="text-sm font-bold">ACL Staff</span>
          </Link>
          <span className="text-[11px] text-zinc-500">{roleLabel}</span>
        </header>

        <main className="flex-1 md:ml-60 px-4 md:px-8 py-6 md:py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-acl-black dark:hover:text-zinc-100"
    >
      {label}
    </Link>
  );
}

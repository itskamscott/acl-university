import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-zinc-950 px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-acl-black dark:text-zinc-100">Not found</h1>
      <p className="mt-2 max-w-xs text-sm text-zinc-500">
        We couldn&apos;t find that page. It may have been moved or never existed.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-acl-orange px-4 py-2 text-sm font-medium text-white hover:bg-acl-orange/90"
      >
        Go to dashboard
      </Link>
    </div>
  );
}

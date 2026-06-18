export default function Loading() {
  return (
    <div className="p-4 md:p-6">
      <div className="h-6 w-32 animate-pulse rounded bg-zinc-200" />
      <div className="mt-2 h-4 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      <div className="mt-6 space-y-2">
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

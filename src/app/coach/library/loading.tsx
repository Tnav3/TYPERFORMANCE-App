export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl p-5" aria-busy="true">
      <div className="mb-4 h-8 w-56 animate-pulse rounded-lg bg-surface-2" />
      <div className="mb-4 h-11 animate-pulse rounded-xl bg-surface-2" />
      <div className="grid gap-2 md:grid-cols-2">
        {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />)}
      </div>
    </main>
  );
}

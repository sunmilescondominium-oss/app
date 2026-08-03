/**
 * Public portal chrome — guests, renters, buyers, repair requesters.
 * Provides a warm ambient background so every portal feels premium and
 * consistent. Individual pages render their own centered card on top.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-amber-50 via-stone-50 to-orange-50" />
      <div aria-hidden className="pointer-events-none fixed -top-32 -right-32 -z-10 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none fixed -bottom-32 -left-32 -z-10 h-80 w-80 rounded-full bg-orange-200/25 blur-3xl" />
      {children}
    </div>
  );
}

/**
 * Localli has no public marketing site yet. Businesses are reached at /[slug];
 * this exists so the root is not a 404 during the demo.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center bg-surface px-5">
      <h1 className="font-display m-0 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">
        Localli
      </h1>
      <p className="mt-2 mb-0 text-[17px] leading-[1.5] text-ink-secondary">
        Booking pages for beauty businesses. Ask your salon for their link.
      </p>
    </main>
  )
}

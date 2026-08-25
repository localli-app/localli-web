import Link from 'next/link'

/**
 * An honest placeholder for a destination that is specified but not built for
 * the demo. Better than a 404 and better than a screen that pretends to work:
 * it names what is missing and points at what does.
 */
export function NotBuiltYet({
  title,
  body,
  links,
}: {
  title: string
  body: string
  links: { href: string; label: string }[]
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 py-16 text-center">
      <div className="h-[72px] w-[72px] rounded-[14px] bg-field" aria-hidden />
      <h2 className="font-display text-[18px] leading-[1.3] font-semibold text-ink">{title}</h2>
      <p className="max-w-[420px] text-[14px] leading-[1.55] text-ink-secondary">{body}</p>
      <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex h-[42px] items-center rounded-[10px] border border-ink/15 bg-surface px-[18px] text-[14px] text-ink transition-colors hover:bg-surface-subtle"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

import type { PublicBusiness, PublicService } from '@/lib/db/queries'
import {
  formatDuration,
  formatMoney,
  formatPhoneForDisplay,
  summariseWeeklyHours,
} from '@/lib/format'
import { SectionLabel } from './primitives'

/**
 * Artboard 1a — the landing.
 *
 * No modal, no cookie wall, no app prompt, no "sign in" in the header. The
 * service list is immediately visible and every row carries its price.
 */
export function LandingScreen({
  business,
  onSelectService,
  heading,
}: {
  business: PublicBusiness
  onSelectService: (service: PublicService) => void
  heading?: React.ReactNode
}) {
  const hoursLine = summariseWeeklyHours(business.hours)

  return (
    <>
      <CoverPhoto photos={business.photos} name={business.name} />

      {heading ?? (
        <header className="px-5 pt-[22px]">
          <h1 className="font-display m-0 text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">
            {business.name}
          </h1>
          {business.description ? (
            <p className="mt-[7px] mb-0 text-[17px] leading-[1.4] text-ink-secondary">
              {business.description}
            </p>
          ) : null}
          {business.isMobile ? (
            <div className="mt-3.5 inline-flex rounded-[9px] bg-field px-3 py-[7px] text-[17px] leading-none text-ink-secondary">
              Travels to you
            </div>
          ) : null}
        </header>
      )}

      <div className="px-5 pt-3">
        {business.categories.map((category) => (
          <section key={category.name}>
            <SectionLabel>{category.name.toUpperCase()}</SectionLabel>
            <div className="flex flex-col">
              {category.services.map((service, index) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  isLast={index === category.services.length - 1}
                  onSelect={() => onSelectService(service)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-[30px] flex flex-col gap-[7px] border-t border-hairline-soft bg-surface-subtle px-5 pt-[22px] pb-[26px]">
        {business.address ? (
          <div className="text-[17px] leading-[1.45] text-ink-secondary">
            {[business.address.line1, business.address.city, business.address.postcode]
              .filter(Boolean)
              .join(', ')}
          </div>
        ) : null}
        {business.phone ? (
          <a
            href={`tel:${business.phone}`}
            className="text-[17px] leading-[1.45] text-ink-secondary"
          >
            {formatPhoneForDisplay(business.phone)}
          </a>
        ) : null}
        {hoursLine ? (
          <div className="text-[17px] leading-[1.45] text-ink-secondary">{hoursLine}</div>
        ) : null}
        <div className="mt-3.5 text-[12px] leading-none text-ink-secondary">Powered by Localli</div>
      </footer>
    </>
  )
}

function ServiceRow({
  service,
  isLast,
  onSelect,
}: {
  service: PublicService
  isLast: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 py-[15px] text-left transition-colors hover:bg-surface-subtle ${
        isLast ? '' : 'border-b border-hairline'
      }`}
    >
      <span className="flex flex-col gap-[3px]">
        <span className="text-[17px] leading-[1.25] font-semibold text-ink">{service.name}</span>
        <span className="text-[17px] leading-none text-ink-muted">
          {formatDuration(service.durationMinutes)}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-[17px] leading-none font-semibold text-ink">
          {formatMoney(service.priceMinor, service.currency)}
        </span>
        <span aria-hidden className="text-[20px] leading-none text-ink-faint">
          ›
        </span>
      </span>
    </button>
  )
}

/**
 * The artboard shows a hatched placeholder labelled "cover photo — salon".
 * That is mockup shorthand, so a real photo renders when one exists and a quiet
 * warm band stands in when it does not — never the placeholder label itself.
 */
function CoverPhoto({ photos, name }: { photos: string[]; name: string }) {
  const photo = photos[0]
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote host is not known at build time; dimensions are fixed so layout does not shift.
      <img
        src={photo}
        alt={`${name} interior`}
        width={430}
        height={172}
        className="h-[172px] w-full object-cover"
      />
    )
  }
  return (
    <div
      aria-hidden
      className="h-[172px] w-full"
      style={{ background: 'linear-gradient(135deg, #e7dfd4 0%, #dfd5c8 100%)' }}
    />
  )
}

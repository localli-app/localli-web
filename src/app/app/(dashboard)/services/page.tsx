import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { getServicesByCategory } from '@/lib/dashboard/directory'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { formatMoney, formatDuration } from '@/lib/format'
import { TopBar } from '@/components/dashboard/TopBar'

/** Read-only for the demo; editing is specified in planning/12-dashboard-spec.md. */
export default async function ServicesPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const categories = await getServicesByCategory(session.businessId)
  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`

  return (
    <>
      <TopBar
        title="Services"
        bookingLinkDisplay={displayLink(bookingLinkUrl)}
        bookingLinkUrl={bookingLinkUrl}
        trailing={
          <Link
            href="/app/setup/services"
            className="flex h-9 items-center rounded-[9px] bg-accent px-4 text-[14px] leading-none font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Add from templates
          </Link>
        }
      />
      <div className="flex-1 px-[18px] py-5 md:px-7 md:py-6">
        {categories.length === 0 ? (
          <p className="text-[14px] text-ink-secondary">No services yet.</p>
        ) : (
          categories.map((category) => (
            <section key={category.name} className="mb-7">
              <h2 className="pb-1.5 text-[13px] leading-none font-semibold tracking-[0.07em] text-ink-muted uppercase">
                {category.name}
              </h2>
              <div className="flex flex-col">
                {category.services.map((service) => (
                  <div
                    key={service.id}
                    className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 border-b border-hairline-soft py-3"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-center gap-2.5">
                        <span className="text-[15px] leading-[1.2] font-semibold text-ink">
                          {service.name}
                        </span>
                        {!service.isActive && (
                          <span className="rounded-md bg-field px-2 py-0.5 text-[12px] leading-none text-ink-muted">
                            Hidden
                          </span>
                        )}
                      </span>
                      <span className="text-[13px] leading-none text-ink-muted">
                        {formatDuration(service.durationMinutes)}
                        {session.isMobile && (service.setupMinutes > 0 || service.packdownMinutes > 0) && (
                          <> · +{service.setupMinutes + service.packdownMinutes} min setup and pack-down</>
                        )}
                      </span>
                    </span>
                    <span className="text-[15px] leading-none font-semibold text-ink">
                      {formatMoney(service.priceMinor, session.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
        <p className="text-[13px] leading-[1.5] text-ink-muted">
          Editing services from here is specified but not built for the demo. Add from templates
          works.
        </p>
      </div>
    </>
  )
}

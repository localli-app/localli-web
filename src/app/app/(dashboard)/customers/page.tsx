import { redirect } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { getStaffSession } from '@/lib/auth/staff-session'
import { getCustomerList } from '@/lib/dashboard/directory'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { formatMoney } from '@/lib/format'
import { TopBar } from '@/components/dashboard/TopBar'

export default async function CustomersPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const customers = await getCustomerList(session.businessId)
  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`
  const tz = session.timezone

  return (
    <>
      <TopBar
        title="Customers"
        subtitle={customers.length > 0 ? `${customers.length} at ${session.businessName}` : undefined}
        bookingLinkDisplay={displayLink(bookingLinkUrl)}
        bookingLinkUrl={bookingLinkUrl}
      />
      <div className="flex-1 px-[18px] py-5 md:px-7 md:py-6">
        {customers.length === 0 ? (
          <p className="text-[14px] leading-[1.55] text-ink-secondary">
            Customers are created automatically from every booking, guest or not. As soon as
            someone books, they appear here.
          </p>
        ) : (
          <div className="flex flex-col">
            <div className="hidden grid-cols-[1.4fr_1fr_100px_90px_110px] gap-3 border-b border-hairline pb-2.5 text-[12px] leading-none font-semibold tracking-[0.05em] text-ink-muted md:grid">
              <span>NAME</span>
              <span>PHONE</span>
              <span>VISITS</span>
              <span>SPEND</span>
              <span>LAST VISIT</span>
            </div>
            {customers.map((customer) => {
              const name =
                customer.displayName ??
                [customer.firstName, customer.lastName].filter(Boolean).join(' ') ??
                'Customer'
              return (
                <div
                  key={customer.customerId}
                  className="flex flex-col gap-1 border-b border-hairline-soft py-3 md:grid md:grid-cols-[1.4fr_1fr_100px_90px_110px] md:items-center md:gap-3"
                >
                  <span className="text-[15px] leading-none font-semibold text-ink md:text-[14px]">
                    {name}
                  </span>
                  <span className="text-[13px] text-ink-secondary md:text-[14px]">
                    {customer.phone ?? customer.email ?? '—'}
                  </span>
                  <span className="text-[13px] text-ink-secondary md:text-[14px]">
                    {customer.totalBookings} visit{customer.totalBookings === 1 ? '' : 's'}
                  </span>
                  <span className="text-[13px] text-ink-secondary md:text-[14px]">
                    {formatMoney(customer.totalSpendMinor, session.currency)}
                  </span>
                  <span className="text-[13px] text-ink-muted md:text-[14px]">
                    {customer.lastBookedAt
                      ? formatInTimeZone(customer.lastBookedAt, tz, 'd MMM yyyy')
                      : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-5 text-[13px] leading-[1.5] text-ink-muted">
          This list is scoped to {session.businessName}. Where a customer books elsewhere on Localli
          is not your data and is never shown here.
        </p>
      </div>
    </>
  )
}

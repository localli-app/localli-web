import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { getStaffList } from '@/lib/dashboard/directory'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { summariseWeeklyHours } from '@/lib/format'
import { TopBar } from '@/components/dashboard/TopBar'

/**
 * For a solo business this screen is almost empty, which is correct. Do not
 * make a one-person business feel like it is using software built for a chain.
 */
export default async function StaffPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const members = await getStaffList(session.businessId)
  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`

  return (
    <>
      <TopBar
        title="Staff"
        bookingLinkDisplay={displayLink(bookingLinkUrl)}
        bookingLinkUrl={bookingLinkUrl}
      />
      <div className="flex-1 px-[18px] py-5 md:px-7 md:py-6">
        <div className="flex flex-col gap-2.5">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline p-4"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-field text-[15px] font-semibold text-ink">
                  {member.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[15px] leading-none font-semibold text-ink">{member.name}</span>
                  <span className="text-[13px] leading-none text-ink-muted">
                    {member.role === 'owner' ? 'Owner' : member.role === 'manager' ? 'Manager' : 'Staff'}
                    {member.hours.length > 0 && <> · {summariseWeeklyHours(member.hours)}</>}
                  </span>
                </span>
              </span>
              <span
                className={`rounded-md px-2.5 py-1 text-[12px] leading-none ${
                  member.isBookable ? 'bg-field text-ink-secondary' : 'bg-field text-ink-muted'
                }`}
              >
                {member.isBookable ? 'Bookable' : 'Not bookable'}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[13px] leading-[1.5] text-ink-muted">
          Adding staff and editing working hours is specified but not built for the demo.
        </p>
      </div>
    </>
  )
}

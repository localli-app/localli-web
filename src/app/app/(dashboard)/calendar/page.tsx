import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { TopBar } from '@/components/dashboard/TopBar'
import { NotBuiltYet } from '@/components/dashboard/NotBuiltYet'

/**
 * Specified in planning/12-dashboard-spec.md (Screen 2) but deliberately not
 * built for the demo: week grid, drag-to-reschedule and block-time are a large
 * surface, and Today plus Bookings already cover what Friday needs.
 */
export default async function CalendarPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`

  return (
    <>
      <TopBar
        title="Calendar"
        bookingLinkDisplay={displayLink(bookingLinkUrl)}
        bookingLinkUrl={bookingLinkUrl}
      />
      <NotBuiltYet
        title="The week view isn't built yet"
        body="Drag-to-reschedule, staff columns and blocking out time all live here. Until then, Today shows the agenda with gaps, and Bookings covers past and future."
        links={[
          { href: '/app', label: 'Go to Today' },
          { href: '/app/bookings', label: 'Go to Bookings' },
        ]}
      />
    </>
  )
}

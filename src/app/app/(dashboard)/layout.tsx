import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { getAttentionCount } from '@/lib/dashboard/bookings'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { MobileTabBar } from '@/components/dashboard/MobileTabBar'

export default async function DashboardLayout({ children }: LayoutProps<'/app'>) {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`
  const attentionCount = await getAttentionCount(session.businessId)

  return (
    // The shell is exactly one viewport tall and never scrolls itself. Only the
    // content column scrolls, so the sidebar and the header stay put — the
    // header carries the booking link, which owners reach for constantly.
    <div className="flex h-dvh overflow-hidden bg-surface">
      <Sidebar
        businessName={session.businessName}
        bookingLinkDisplay={displayLink(bookingLinkUrl)}
        bookingLinkUrl={bookingLinkUrl}
        staffName={session.staffName}
        staffRole={session.role === 'owner' ? 'Owner' : session.role === 'manager' ? 'Manager' : 'Staff'}
        attentionCount={attentionCount}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        <MobileTabBar bookingLinkUrl={bookingLinkUrl} />
      </div>
    </div>
  )
}

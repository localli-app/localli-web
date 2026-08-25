import { redirect } from 'next/navigation'
import { count, eq } from 'drizzle-orm'
import { getStaffSession } from '@/lib/auth/staff-session'
import { getAttentionCount } from '@/lib/dashboard/bookings'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { MobileTabBar } from '@/components/dashboard/MobileTabBar'
import { SetupPrompt } from '@/components/dashboard/SetupPrompt'

/** Names what is still missing, so the prompt is actionable rather than nagging. */
async function outstandingSetup(businessId: string): Promise<string[] | null> {
  const business = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) })
  if (!business || business.onboardingCompletedAt) return null

  const [[services], [hours]] = await Promise.all([
    db.select({ n: count() }).from(s.services).where(eq(s.services.businessId, businessId)),
    db.select({ n: count() }).from(s.businessHours).where(eq(s.businessHours.businessId, businessId)),
  ])

  const missing: string[] = []
  if (Number(services?.n ?? 0) === 0) missing.push('services')
  if (Number(hours?.n ?? 0) === 0) missing.push('opening hours')
  if (!business.addressLocationId) missing.push('your address')
  return missing
}

export default async function DashboardLayout({ children }: LayoutProps<'/app'>) {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`
  const [attentionCount, missing] = await Promise.all([
    getAttentionCount(session.businessId),
    outstandingSetup(session.businessId),
  ])

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
        {missing !== null && <SetupPrompt missing={missing} />}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        <MobileTabBar bookingLinkUrl={bookingLinkUrl} />
      </div>
    </div>
  )
}

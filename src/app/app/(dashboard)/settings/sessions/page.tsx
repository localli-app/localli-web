import { redirect } from 'next/navigation'
import { getStaffSession, listStaffSessions } from '@/lib/auth/staff-session'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { TopBar } from '@/components/dashboard/TopBar'
import { SessionList } from '@/components/dashboard/SessionList'

export default async function SessionsPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const sessions = await listStaffSessions(session.staffId, session.sessionId)
  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`

  return (
    <>
      <TopBar
        title="Devices"
        subtitle={`${sessions.length} signed in`}
        bookingLinkDisplay={displayLink(bookingLinkUrl)}
        bookingLinkUrl={bookingLinkUrl}
      />
      <div className="flex-1 px-[18px] py-5 md:px-7 md:py-6">
        <p className="mb-4 max-w-[640px] text-[14px] leading-[1.55] text-ink-secondary">
          Everywhere you&rsquo;re signed in to Localli. If you don&rsquo;t recognise something here
          — or you left a phone at a job — sign it out.
        </p>
        <SessionList
          initial={sessions.map((s) => ({
            id: s.id,
            issuedAt: s.issuedAt.toISOString(),
            lastSeenAt: s.lastSeenAt.toISOString(),
            ip: s.ip,
            userAgent: s.userAgent,
            isCurrent: s.isCurrent,
          }))}
        />
      </div>
    </>
  )
}

import { redirect } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { getStaffSession } from '@/lib/auth/staff-session'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { WizardStep } from '@/components/dashboard/wizard'
import { HoursStep } from '@/components/dashboard/setup/HoursStep'

export default async function SetupHoursPage({ searchParams }: PageProps<'/app/setup/hours'>) {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const params = await searchParams
  const unpinned = params.unpinned === '1'

  const rows = await db
    .select()
    .from(s.businessHours)
    .where(eq(s.businessHours.businessId, session.businessId))
    .orderBy(asc(s.businessHours.weekday))

  return (
    <WizardStep
      step="hours"
      title="When are you open?"
      lead="We've started you off with Tuesday to Saturday. Change anything that's wrong."
    >
      {unpinned && (
        <p
          role="status"
          className="mt-4 rounded-[10px] bg-accent-tint px-3.5 py-3 text-[14px] leading-[1.5] text-accent-hover"
        >
          We saved your address but couldn&rsquo;t place it on the map, so your travel area
          isn&rsquo;t set yet. You can pin it any time from Settings — bookings still work in the
          meantime.
        </p>
      )}
      <HoursStep
        initialHours={rows.map((h) => ({
          weekday: h.weekday,
          opensLocal: h.opensLocal.slice(0, 5),
          closesLocal: h.closesLocal.slice(0, 5),
        }))}
      />
    </WizardStep>
  )
}

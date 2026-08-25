import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { getStaffSession } from '@/lib/auth/staff-session'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { WizardStep } from '@/components/dashboard/wizard'
import { AddressStep } from '@/components/dashboard/setup/AddressStep'

export default async function SetupAddressPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const business = await db.query.businesses.findFirst({
    where: eq(s.businesses.id, session.businessId),
  })
  if (!business) redirect('/app')

  const address = business.addressLocationId
    ? await db.query.locations.findFirst({ where: eq(s.locations.id, business.addressLocationId) })
    : null

  const [area] = await db
    .select({ radiusMetres: s.serviceAreas.radiusMetres })
    .from(s.serviceAreas)
    .where(and(eq(s.serviceAreas.businessId, session.businessId), eq(s.serviceAreas.kind, 'radius')))
    .limit(1)

  return (
    <WizardStep
      step="address"
      title={session.isMobile ? 'Where do you start your day?' : 'Where do clients find you?'}
      lead={
        session.isMobile
          ? 'We use this as your base when working out whether you can reach a job in time.'
          : 'This appears on your booking page and in the directions customers get.'
      }
    >
      <AddressStep
        isMobile={session.isMobile}
        initial={
          address ? { line1: address.line1, city: address.city, postcode: address.postcode } : null
        }
        initialRadiusMetres={area?.radiusMetres ?? null}
      />
    </WizardStep>
  )
}

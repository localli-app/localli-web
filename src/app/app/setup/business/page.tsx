import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getStaffSession } from '@/lib/auth/staff-session'
import { db } from '@/lib/db/client'
import * as s from '@/lib/db/schema'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { WizardStep } from '@/components/dashboard/wizard'
import { BusinessNameStep } from '@/components/dashboard/setup/BusinessNameStep'

export default async function SetupBusinessPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const business = await db.query.businesses.findFirst({
    where: eq(s.businesses.id, session.businessId),
  })
  if (!business) redirect('/app')

  return (
    <WizardStep
      step="business"
      title="What's your business called?"
      lead="This is the name customers see, and it sets your booking link."
    >
      <BusinessNameStep
        initialName={business.name}
        initialSlug={business.slug}
        linkOrigin={displayLink(appBaseUrl())}
      />
    </WizardStep>
  )
}

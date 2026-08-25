import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { WizardStep } from '@/components/dashboard/wizard'
import { WhereStep } from '@/components/dashboard/setup/WhereStep'

export default async function SetupWherePage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  return (
    <WizardStep
      step="where"
      title="Where do you work?"
      lead="This changes what we ask next, so it's worth getting right."
    >
      <WhereStep initialIsMobile={session.isMobile} />
    </WizardStep>
  )
}

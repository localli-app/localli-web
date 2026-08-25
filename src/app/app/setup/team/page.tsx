import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { WizardStep } from '@/components/dashboard/wizard'
import { TeamStep } from '@/components/dashboard/setup/TeamStep'

export default async function SetupTeamPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  return (
    <WizardStep
      step="team"
      title="Anyone else on the team?"
      lead="Most people setting up are on their own. You can add people any time."
    >
      <TeamStep ownerName={session.staffName} />
    </WizardStep>
  )
}

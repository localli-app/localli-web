import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { SERVICE_TEMPLATES } from '@/lib/dashboard/service-templates'
import { WizardStep } from '@/components/dashboard/wizard'
import { ServiceTemplatePicker } from '@/components/dashboard/ServiceTemplatePicker'

/**
 * Step 5, the one drawn in the design canvas (artboard 1f).
 *
 * Service templates carry the whole flow: an owner facing an empty "add your
 * first service" form abandons, while an owner ticking three boxes and typing
 * three prices finishes.
 */
export default async function SetupServicesPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const currencySymbol = session.currency === 'GBP' ? '£' : session.currency === 'USD' ? '$' : '€'

  return (
    <WizardStep
      step="services"
      title="What do you offer?"
      lead="Pick from the list and set your prices. You can add more later."
    >
      <ServiceTemplatePicker
        categories={SERVICE_TEMPLATES}
        currencySymbol={currencySymbol}
        nextHref="/app/setup/team"
        skipHref="/app/setup/team"
      />
    </WizardStep>
  )
}

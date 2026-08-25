import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { SERVICE_TEMPLATES } from '@/lib/dashboard/service-templates'
import { ServiceTemplatePicker } from '@/components/dashboard/ServiceTemplatePicker'

const TOTAL_STEPS = 6
const THIS_STEP = 5

/**
 * Onboarding step 5 of 6 — the only step drawn in the design canvas
 * (artboard 1f). Steps 1-4 and 6 are specified in
 * planning/12-dashboard-spec.md but not yet built.
 *
 * The wizard is a conversion funnel, not an admin form. Target is under
 * fifteen minutes, finishable on a phone, without reading anything.
 */
export default async function SetupServicesPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const currencySymbol = session.currency === 'GBP' ? '£' : session.currency === 'USD' ? '$' : '€'

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-[58px] items-center justify-between border-b border-hairline bg-surface px-[18px] md:px-7">
        <span className="flex items-center gap-2.5">
          <span className="h-6 w-6 rounded-lg bg-accent" aria-hidden />
          <span className="text-[14px] leading-none font-semibold text-ink">Localli setup</span>
        </span>
        <Link href="/app" className="text-[14px] leading-none text-ink-muted hover:text-ink">
          Save and finish later
        </Link>
      </header>

      <div className="flex justify-center px-[18px] py-8 md:px-7 md:pt-10 md:pb-14">
        <div className="w-full max-w-[760px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center" aria-hidden>
              {Array.from({ length: TOTAL_STEPS }).map((step, index) => {
                const number = index + 1
                const done = number < THIS_STEP
                const current = number === THIS_STEP
                return (
                  <span key={number} className="flex items-center">
                    <span
                      className={`rounded-full ${
                        current
                          ? 'h-3.5 w-3.5 border-[2.5px] border-accent bg-surface'
                          : done
                            ? 'h-3 w-3 bg-accent'
                            : 'h-3 w-3 border-2 border-[#D9CFC2] bg-surface'
                      }`}
                    />
                    {number < TOTAL_STEPS && (
                      <span
                        className={`h-0.5 w-6 md:w-11 ${done ? 'bg-accent' : 'bg-[#D9CFC2]'}`}
                      />
                    )}
                  </span>
                )
              })}
            </span>
            <span className="ml-3 text-[14px] leading-none font-semibold text-ink-muted">
              Step {THIS_STEP} of {TOTAL_STEPS}
            </span>
          </div>

          <h1 className="font-display mt-[26px] text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink md:text-[30px]">
            What do you offer?
          </h1>
          <p className="mt-2.5 text-[16px] leading-[1.5] text-ink-secondary">
            Pick from the list and set your prices. You can add more later.
          </p>

          <ServiceTemplatePicker
            categories={SERVICE_TEMPLATES}
            currencySymbol={currencySymbol}
          />
        </div>
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { getBusinessSettings } from '@/lib/dashboard/directory'
import { appBaseUrl, displayLink } from '@/lib/dashboard/links'
import { summariseWeeklyHours } from '@/lib/format'
import { TopBar } from '@/components/dashboard/TopBar'
import { DangerZone } from '@/components/dashboard/DangerZone'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline-soft py-3 last:border-b-0">
      <span className="text-[14px] text-ink-muted">{label}</span>
      <span className="text-right text-[14px] text-ink">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-[14px] border border-hairline p-5">
      <h2 className="mb-1 text-[15px] leading-none font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

/** Read-only for the demo. Every writable setting that can affect slots must bump availabilityVersion. */
export default async function SettingsPage() {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  const settings = await getBusinessSettings(session.businessId)
  if (!settings) redirect('/app')

  const { business, address, hours } = settings
  const s = business.bookingSettings
  const bookingLinkUrl = `${appBaseUrl()}/${session.businessSlug}`

  return (
    <>
      <TopBar
        title="Settings"
        bookingLinkDisplay={displayLink(bookingLinkUrl)}
        bookingLinkUrl={bookingLinkUrl}
      />
      <div className="flex-1 px-[18px] py-5 md:px-7 md:py-6">
        <div className="max-w-[760px]">
          <Section title="Business details">
            <Row label="Name" value={business.name} />
            <Row label="Booking link" value={displayLink(bookingLinkUrl)} />
            <Row label="Description" value={business.description ?? '—'} />
            <Row label="Phone" value={business.phone ?? '—'} />
            <Row
              label="Address"
              value={address ? [address.line1, address.city, address.postcode].filter(Boolean).join(', ') : '—'}
            />
            <Row label="Timezone" value={business.timezone} />
            <Row label="Currency" value={business.currency} />
          </Section>

          <Section title="Opening hours">
            <Row label="Weekly pattern" value={summariseWeeklyHours(hours) || 'Not set'} />
          </Section>

          <Section title="Booking rules">
            <Row label="Minimum notice" value={`${s.minNoticeMinutes} minutes`} />
            <Row label="How far ahead" value={`${s.maxAdvanceDays} days`} />
            <Row label="Slot granularity" value={`${s.slotGranularityMinutes} minutes`} />
            <Row label="Required contact field" value={s.contactField === 'phone' ? 'Mobile number' : 'Email'} />
            <Row label="Require last name" value={s.requireLastName ? 'Yes' : 'No'} />
            <Row label="Assignment rule" value={s.assignmentRule.replace(/_/g, ' ')} />
          </Section>

          <Section title="Cancellation policy">
            <Row label="Free cancellation window" value={`${s.cancellationWindowHours} hours before`} />
            <Row label="Auto-complete after" value={`${s.autoCompleteAfterMinutes} minutes`} />
          </Section>

          {business.isMobileEnabled && (
            <Section title="Service areas and travel">
              <Row label="Mobile business" value="Yes — you travel to clients" />
              <Row label="Areas and travel limits" value="Managed in the seed for the demo" />
            </Section>
          )}

          <Section title="Devices">
            <Row label="Signed-in devices" value="Manage on the Devices screen" />
          </Section>

          <DangerZone slug={session.businessSlug} isOwner={session.role === 'owner'} />

          <p className="text-[13px] leading-[1.5] text-ink-muted">
            Editing is read-only for the demo. Any change that can affect available slots must bump
            the availability version, which is why it is not a plain form.
          </p>
        </div>
      </div>
    </>
  )
}

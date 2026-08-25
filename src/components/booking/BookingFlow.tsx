'use client'

import { useState } from 'react'
import type { PublicBusiness, PublicService } from '@/lib/db/queries'
import { formatDuration, formatLongDateTime, formatMoney } from '@/lib/format'
import { AddressStep, type ChosenAddress } from './AddressStep'
import { ConfirmedScreen, type ConfirmedBooking } from './ConfirmedScreen'
import { DetailsStep, type CustomerDetails } from './DetailsStep'
import { LandingScreen } from './LandingScreen'
import { Screen, ServiceSummaryBar } from './primitives'
import { TimeStep, type SlotView } from './TimeStep'

type Step = 'service' | 'address' | 'time' | 'details' | 'confirmed'

/**
 * The four-taps-and-one-form flow from planning/03a-booking-flow.md, following
 * the artboards in the "Localli mobile booking flow" design canvas.
 *
 * Plain local state, no client-side routing library — the public page is on a
 * strict JS budget. The initial render is the service list, so the server sends
 * complete landing HTML and first paint needs no client JS.
 *
 * The staff step (tap 2 in the spec) is skipped here because the seeded
 * business has a single bookable staff member, which the spec requires. It
 * needs adding before a multi-staff salon uses this.
 */
export function BookingFlow({
  business,
  source,
  sourceDetail,
}: {
  business: PublicBusiness
  source: string
  sourceDetail: string | null
}) {
  const [step, setStep] = useState<Step>('service')
  const [service, setService] = useState<PublicService | null>(null)
  const [address, setAddress] = useState<ChosenAddress | null>(null)
  const [slot, setSlot] = useState<SlotView | null>(null)
  const [booking, setBooking] = useState<ConfirmedBooking | null>(null)
  const [contactLabel, setContactLabel] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function chooseService(chosen: PublicService) {
    setService(chosen)
    setStep(business.isMobile ? 'address' : 'time')
  }

  async function confirm(details: CustomerDetails) {
    if (!service || !slot) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Customers double-tap on slow connections.
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          businessSlug: business.slug,
          serviceId: service.id,
          staffId: slot.staffId,
          startsAt: slot.startsAt,
          customer: {
            firstName: details.firstName,
            phone: details.phone,
            email: details.email,
          },
          serviceAddress: address
            ? {
                line1: address.line1,
                postcode: address.postcode,
                lat: address.lat,
                lng: address.lng,
                accessNotes: address.accessNotes,
              }
            : null,
          note: details.note,
          source,
          sourceDetail,
          marketingConsent: false,
        }),
      })

      const payload = (await response.json()) as {
        data?: ConfirmedBooking
        error?: { code: string; message: string }
      }

      if (payload.data) {
        setBooking(payload.data)
        setContactLabel(details.phone ?? details.email)
        setStep('confirmed')
        return
      }

      if (payload.error?.code === 'SLOT_TAKEN') {
        setError('That time was just booked. Please choose another.')
        setStep('time')
        setSlot(null)
        return
      }
      setError(payload.error?.message ?? 'Something went wrong. Please try again.')
    } catch {
      setError('We could not reach Localli. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const priceLabel = service ? formatMoney(service.priceMinor, service.currency) : ''
  const summaryDetail = service
    ? `${formatDuration(service.durationMinutes)}${slot ? ` · with ${slot.staffName}` : ''}`
    : ''
  const whereLine = address ? [address.line1, address.postcode].filter(Boolean).join(', ') : null

  if (step === 'confirmed' && booking) {
    return (
      <Screen>
        <ConfirmedScreen
          booking={booking}
          timezone={business.timezone}
          whereLine={whereLine}
          contactLabel={contactLabel}
        />
      </Screen>
    )
  }

  return (
    <Screen>
      {step !== 'service' && service ? (
        <>
          <BackBar
            onBack={() => {
              setError(null)
              if (step === 'address') setStep('service')
              else if (step === 'time') setStep(business.isMobile ? 'address' : 'service')
              else if (step === 'details') setStep('time')
            }}
          />
          <ServiceSummaryBar
            serviceName={service.name}
            detail={summaryDetail}
            price={priceLabel}
          />
        </>
      ) : null}

      {step === 'service' ? (
        <LandingScreen business={business} onSelectService={chooseService} />
      ) : null}

      {step === 'address' && service ? (
        <AddressStep
          businessSlug={business.slug}
          businessName={business.name}
          onContinue={(chosen) => {
            setAddress(chosen)
            setStep('time')
          }}
        />
      ) : null}

      {step === 'time' && service ? (
        <TimeStep
          businessSlug={business.slug}
          serviceId={service.id}
          timezone={business.timezone}
          isMobile={business.isMobile}
          destination={address ? { lat: address.lat, lng: address.lng } : null}
          priceLabel={priceLabel}
          onChoose={(chosen) => {
            setSlot(chosen)
            setStep('details')
          }}
        />
      ) : null}

      {step === 'details' && service && slot ? (
        <DetailsStep
          summary={{
            serviceLine: `${service.name} with ${slot.staffName}`,
            priceLabel,
            whenLine: formatLongDateTime(new Date(slot.startsAt), business.timezone),
            whereLine,
          }}
          contactField={business.settings.contactField}
          submitting={submitting}
          errorMessage={error}
          onConfirm={confirm}
        />
      ) : null}

      {step === 'time' && error ? (
        <p className="px-5 pb-4 text-[17px] leading-[1.4] text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </Screen>
  )
}

/** A plain back affordance. No "sign in", no account, nothing else in the header. */
function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-2 pt-2">
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-[44px] min-w-[44px] items-center gap-1 px-3 text-[17px] leading-none text-accent"
      >
        <span aria-hidden>‹</span> Back
      </button>
    </div>
  )
}

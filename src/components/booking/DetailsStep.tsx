'use client'

import { useState } from 'react'
import { ActionBar, PrimaryButton, ScreenTitle, SummaryCard } from './primitives'

export interface CustomerDetails {
  firstName: string
  phone: string | null
  email: string | null
  note: string | null
}

/**
 * Artboard 1f — the details screen.
 *
 * Three fields maximum: name, ONE contact field, and an optional collapsed note.
 * There is no password, no account, no confirm-email, and no verification step.
 * Every extra field here is measurable abandonment.
 */
export function DetailsStep({
  summary,
  contactField,
  submitting,
  errorMessage,
  onConfirm,
}: {
  summary: { serviceLine: string; priceLabel: string; whenLine: string; whereLine: string | null }
  contactField: 'phone' | 'email'
  submitting: boolean
  errorMessage: string | null
  onConfirm: (details: CustomerDetails) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [useEmail, setUseEmail] = useState(contactField === 'email')
  const [contact, setContact] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  const nameValid = firstName.trim().length > 0
  const contactValid = useEmail
    ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.trim())
    : contact.replace(/\D/g, '').length >= 6
  const canSubmit = nameValid && contactValid && !submitting

  function submit() {
    setTouched(true)
    if (!canSubmit) return
    onConfirm({
      firstName: firstName.trim(),
      phone: useEmail ? null : contact.trim(),
      email: useEmail ? contact.trim() : null,
      note: note.trim() || null,
    })
  }

  return (
    <>
      <div className="px-5 pt-4">
        <ScreenTitle>Almost done</ScreenTitle>

        <div className="mt-5">
          <SummaryCard>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] leading-[1.3] font-semibold text-ink">
                {summary.serviceLine}
              </span>
              <span className="text-[17px] leading-none font-semibold text-ink">
                {summary.priceLabel}
              </span>
            </div>
            <div className="text-[17px] leading-[1.4] text-ink-secondary">{summary.whenLine}</div>
            {summary.whereLine ? (
              <div className="text-[17px] leading-[1.4] text-ink-muted">{summary.whereLine}</div>
            ) : null}
          </SummaryCard>
        </div>

        <div className="mt-6 flex flex-col gap-[18px]">
          <label className="flex flex-col gap-2">
            <span className="text-[17px] leading-none text-ink-secondary">First name</span>
            <input
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-invalid={touched && !nameValid}
              className="rounded-[10px] bg-field p-3.5 text-[17px] leading-[1.2] text-ink focus:shadow-[0_0_0_4px_rgb(168_72_31/0.16)] focus:outline-none"
            />
            {touched && !nameValid ? (
              <span className="text-[17px] leading-none text-accent">
                Please enter your first name
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] leading-none text-ink-secondary">
                {useEmail ? 'Email address' : 'Mobile number'}
              </span>
              {/* Email OR phone, never both. Requiring both is a friction tax. */}
              <button
                type="button"
                onClick={() => {
                  setUseEmail((v) => !v)
                  setContact('')
                }}
                className="min-h-[44px] text-[17px] leading-none text-accent"
              >
                {useEmail ? 'Use mobile instead' : 'Use email instead'}
              </button>
            </span>
            <input
              type={useEmail ? 'email' : 'tel'}
              inputMode={useEmail ? 'email' : 'tel'}
              autoComplete={useEmail ? 'email' : 'tel'}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              aria-invalid={touched && !contactValid}
              className="rounded-[10px] bg-field p-3.5 text-[17px] leading-[1.2] text-ink focus:shadow-[0_0_0_4px_rgb(168_72_31/0.16)] focus:outline-none"
            />
            {touched && !contactValid ? (
              <span className="text-[17px] leading-none text-accent">
                {useEmail ? 'Please check that email address' : 'Please check that number'}
              </span>
            ) : null}
          </label>

          {noteOpen ? (
            <label className="flex flex-col gap-2 border-t border-hairline pt-4">
              <span className="text-[17px] leading-none text-ink-secondary">
                Anything we should know?
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="min-h-[76px] rounded-[10px] bg-field p-3.5 text-[17px] leading-[1.35] text-ink focus:shadow-[0_0_0_4px_rgb(168_72_31/0.16)] focus:outline-none"
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="flex min-h-[44px] w-full cursor-pointer items-center justify-between border-t border-hairline py-3.5 text-[17px] leading-none text-ink"
            >
              <span>Anything we should know?</span>
              <span className="text-ink-muted">Optional +</span>
            </button>
          )}
        </div>
      </div>

      <ActionBar>
        {errorMessage ? (
          <p className="mt-0 mb-3.5 text-[17px] leading-[1.4] text-accent text-pretty" role="alert">
            {errorMessage}
          </p>
        ) : (
          <p className="mt-0 mb-3.5 text-[17px] leading-[1.5] text-ink-secondary text-pretty">
            We&rsquo;ll {useEmail ? 'email' : 'text'} you a confirmation. No account needed.
          </p>
        )}
        <PrimaryButton onClick={submit} disabled={submitting}>
          {submitting ? 'Confirming…' : 'Confirm booking'}
        </PrimaryButton>
        <p className="mt-3.5 mb-0 text-center text-[17px] leading-none text-ink-muted">
          Free cancellation up to 24 hours before
        </p>
      </ActionBar>
    </>
  )
}

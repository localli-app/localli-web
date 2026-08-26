'use client'

import Script from 'next/script'
import { useState } from 'react'

/**
 * Invisible Turnstile, rendered only when a site key is configured.
 *
 * The widget writes its response into a hidden input named `turnstileToken`,
 * which the plain form post carries to the server. In invisible mode nothing is
 * shown to the person signing up — planning/06-architecture.md is explicit that
 * a visible challenge in normal use is a defect.
 *
 * The form still submits if the script fails to load: the server treats a
 * missing token as a refusal only when Turnstile is configured AND reachable,
 * so a blocked CDN degrades to the rate limits rather than a locked door.
 */
export function TurnstileField({ siteKey }: { siteKey: string | null }) {
  const [ready, setReady] = useState(false)

  if (!siteKey) return null

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onLoad={() => setReady(true)}
      />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-response-field-name="turnstileToken"
        data-size="invisible"
        aria-hidden={!ready}
      />
    </>
  )
}

/**
 * Outbound email.
 *
 * Uses Postmark when POSTMARK_SERVER_TOKEN is set, and otherwise logs the
 * message to the server console. The fallback is deliberate rather than a stub:
 * a sending domain needs SPF and DKIM records that take time to propagate
 * (planning/10-build-order.md), and nothing else should be blocked waiting for
 * DNS. Swapping in real delivery is a config change, not a code change.
 *
 * Receipt deliverability is a strategic concern, not an ops detail: if receipts
 * land in spam the customer graph never activates. Keep transactional and
 * marketing on separate streams and separate subdomains when this goes live.
 */

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
  /** Postmark message stream. Transactional mail must never share a stream with marketing. */
  stream?: string
}

export interface SendResult {
  delivered: boolean
  transport: 'postmark' | 'console'
  id?: string
}

const POSTMARK_ENDPOINT = 'https://api.postmarkapp.com/email'

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN
  const from = process.env.POSTMARK_FROM_EMAIL

  if (!token || !from) {
    // Printed in full so a magic link is usable straight from the terminal.
    console.log(
      [
        '',
        '─── EMAIL (not sent: POSTMARK_SERVER_TOKEN unset) ─────────────',
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        '',
        message.text.trim(),
        '───────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    )
    return { delivered: false, transport: 'console' }
  }

  const response = await fetch(POSTMARK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({
      From: from,
      To: message.to,
      Subject: message.subject,
      HtmlBody: message.html,
      TextBody: message.text,
      MessageStream: message.stream ?? 'outbound',
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    // Never surface a provider error to the caller: the request-link endpoint
    // must respond identically whether or not delivery succeeded.
    console.error(`Postmark rejected a message (${response.status}): ${detail.slice(0, 300)}`)
    return { delivered: false, transport: 'postmark' }
  }

  const payload = (await response.json().catch(() => ({}))) as { MessageID?: string }
  return { delivered: true, transport: 'postmark', id: payload.MessageID }
}

import { formatLongDateTime, formatMoney } from '../../format'

/**
 * Artboard 1j — the receipt email.
 *
 * This is the most commercially important message in the system: it is what
 * turns a guest booking into a customer identity. It is designed as a DOCUMENT
 * the customer might actually want, not a notification, because that is the
 * only reason they would open it.
 *
 * Table-based layout with inline styles, deliberately: email clients have no
 * reliable flexbox or grid, and most strip <style> blocks.
 */

export interface ReceiptEmailInput {
  customerFirstName: string
  businessName: string
  businessAddress: string | null
  businessPhone: string | null
  serviceName: string
  staffName: string
  startsAt: Date
  timezone: string
  priceMinor: number
  currency: string
  /** Magic link: opens the receipt and this customer's own history, nothing else. */
  receiptUrl: string
  /** Prefilled rebook link for the same service and staff member. */
  rebookUrl: string
}

const INK = '#201c18'
const INK_SECONDARY = '#5e564f'
const INK_MUTED = '#6b625a'
const ACCENT = '#a8481f'
const CANVAS = '#efe9e1'
const HAIRLINE = 'rgba(32,28,24,0.12)'
const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, Helvetica, Arial, sans-serif"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderReceiptEmail(input: ReceiptEmailInput): { subject: string; html: string; text: string } {
  const when = formatLongDateTime(input.startsAt, input.timezone)
  const price = formatMoney(input.priceMinor, input.currency)
  const name = escapeHtml(input.customerFirstName)
  const business = escapeHtml(input.businessName)

  const subject = `Your visit to ${input.businessName}`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};font-family:${FONT};">
  <!-- Preheader: the one line shown in the inbox list before opening. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(`${input.serviceName} with ${input.staffName} — ${price}`)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">
    <tr>
      <td align="center" style="padding:24px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;">
          <tr>
            <td style="padding:36px 40px;">
              <div style="font-size:20px;line-height:1;font-weight:600;color:${INK};letter-spacing:-0.01em;">${business}</div>
              <div style="height:1px;background:${HAIRLINE};margin:22px 0 26px;"></div>

              <p style="margin:0;font-size:17px;line-height:1.5;color:${INK};">Thanks for coming in, ${name}.</p>

              <div style="margin-top:26px;">
                <div style="font-size:17px;line-height:1.35;font-weight:600;color:${INK};">${escapeHtml(input.serviceName)} with ${escapeHtml(input.staffName)}</div>
                <div style="margin-top:8px;font-size:17px;line-height:1.4;color:${INK_SECONDARY};">${escapeHtml(when)}</div>
                <div style="margin-top:8px;font-size:22px;line-height:1.2;font-weight:600;color:${INK};">${escapeHtml(price)}</div>
              </div>

              <div style="margin-top:30px;">
                <a href="${escapeHtml(input.rebookUrl)}" style="display:inline-block;height:52px;line-height:52px;padding:0 30px;border-radius:12px;background:${ACCENT};color:#ffffff;font-size:17px;font-weight:600;text-decoration:none;">Book your next appointment</a>
              </div>

              <p style="margin:26px 0 0;font-size:17px;line-height:1.5;color:${INK_MUTED};">
                View this receipt and your booking history on
                <a href="${escapeHtml(input.receiptUrl)}" style="color:${ACCENT};text-decoration:none;">Localli</a>
              </p>

              <div style="height:1px;background:${HAIRLINE};margin:28px 0 20px;"></div>
              <div style="font-size:17px;line-height:1.6;color:${INK_MUTED};">
                ${business}${input.businessAddress ? `, ${escapeHtml(input.businessAddress)}` : ''}
                ${input.businessPhone ? `<br>${escapeHtml(input.businessPhone)}` : ''}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  // A plain-text alternative materially improves deliverability, and receipts
  // landing in spam would break the entire quiet-account strategy.
  const text = [
    `${input.businessName}`,
    ``,
    `Thanks for coming in, ${input.customerFirstName}.`,
    ``,
    `${input.serviceName} with ${input.staffName}`,
    `${when}`,
    `${price}`,
    ``,
    `Book your next appointment: ${input.rebookUrl}`,
    `View this receipt and your booking history: ${input.receiptUrl}`,
    ``,
    [input.businessName, input.businessAddress].filter(Boolean).join(', '),
    input.businessPhone ?? '',
  ]
    .join('\n')
    .trim()

  return { subject, html, text }
}

/**
 * The business magic-link email.
 *
 * Deliberately plain. It has one job — get them back into a browser, signed in
 * — and anything else on the page competes with that. The link is the only
 * call to action, and the copy states the expiry so a stale link in an inbox
 * is not confusing later.
 */

export interface LoginLinkEmailInput {
  url: string
  /** True when this address has no business yet, so the copy can differ. */
  isNewAccount: boolean
  expiryMinutes: number
}

export function renderLoginLinkEmail(input: LoginLinkEmailInput): {
  subject: string
  html: string
  text: string
} {
  const { url, isNewAccount, expiryMinutes } = input

  const subject = isNewAccount ? 'Set up your Localli booking page' : 'Your Localli sign-in link'
  const heading = isNewAccount ? 'Let’s get you set up' : 'Sign in to Localli'
  const lead = isNewAccount
    ? 'Tap the button and we’ll walk you through it. It takes about ten minutes and there’s no password to choose.'
    : 'Tap the button to sign in. There’s no password to remember.'
  const buttonLabel = isNewAccount ? 'Start setting up' : 'Sign in'

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#EFE9E1;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;color:#201C18">
    <div style="max-width:520px;margin:0 auto;padding:24px">
      <div style="background:#ffffff;border-radius:10px;padding:32px 36px">
        <div style="font-size:20px;font-weight:600;letter-spacing:-0.01em">Localli</div>
        <div style="height:1px;background:rgba(32,28,24,0.12);margin:20px 0 24px"></div>
        <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600">${heading}</h1>
        <p style="margin:12px 0 0;font-size:16px;line-height:1.5;color:#5E564F">${lead}</p>
        <div style="margin:28px 0 0">
          <a href="${url}" style="display:inline-block;padding:14px 26px;border-radius:12px;background:#A8481F;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none">${buttonLabel}</a>
        </div>
        <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#6B625A">
          This link works once and expires in ${expiryMinutes} minutes.
          If you didn’t ask for it, you can ignore this email — nothing has been created.
        </p>
        <div style="height:1px;background:rgba(32,28,24,0.12);margin:26px 0 18px"></div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6B625A">
          If the button doesn’t work, paste this into your browser:<br>
          <span style="color:#8C3A18;word-break:break-all">${url}</span>
        </p>
      </div>
    </div>
  </body>
</html>`

  const text = `${heading}

${lead}

${buttonLabel}: ${url}

This link works once and expires in ${expiryMinutes} minutes.
If you didn't ask for it, you can ignore this email — nothing has been created.`

  return { subject, html, text }
}

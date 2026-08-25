import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'
import { turnstileSiteKey } from '@/lib/auth/turnstile'
import { TurnstileField } from '@/components/dashboard/TurnstileField'

/**
 * Sits OUTSIDE the (dashboard) route group so it is not behind the session
 * check — otherwise signing out would redirect-loop.
 *
 * There is no password field here and there never will be. The same form
 * serves signup and sign-in: the magic link creates the account if there
 * isn't one, so there is no separate "create account" path to choose between.
 */
export default async function SignInPage({ searchParams }: PageProps<'/app/signin'>) {
  const session = await getStaffSession()
  if (session) redirect('/app')

  const params = await searchParams
  const expired = params.expired === '1'
  const failed = params.error === '1'
  const isDev = process.env.NODE_ENV !== 'production'
  const siteKey = turnstileSiteKey()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-[420px] rounded-[18px] border border-hairline bg-surface p-7">
        <div className="flex items-center gap-2.5">
          <span className="h-[26px] w-[26px] rounded-lg bg-accent" aria-hidden />
          <span className="text-[14px] leading-none font-semibold text-ink">Localli</span>
        </div>

        <h1 className="font-display mt-6 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">
          Sign in or get started
        </h1>
        <p className="mt-2.5 text-[15px] leading-[1.5] text-ink-secondary">
          Enter your email and we&rsquo;ll send you a link. No password — this product
          doesn&rsquo;t have them.
        </p>

        {failed && (
          <p
            role="status"
            className="mt-4 rounded-[10px] bg-accent-tint px-3.5 py-3 text-[14px] leading-[1.5] text-accent-hover"
          >
            Something went wrong finishing your sign-in. Nothing was lost — request a new link and
            try again.
          </p>
        )}

        {expired && (
          <p
            role="status"
            className="mt-4 rounded-[10px] bg-accent-tint px-3.5 py-3 text-[14px] leading-[1.5] text-accent-hover"
          >
            That link has already been used or has expired. Links last 15 minutes — here&rsquo;s a
            fresh start.
          </p>
        )}

        <form className="mt-6 flex flex-col gap-3" action="/api/auth/business/request-link" method="post">
          <label className="flex flex-col gap-2">
            <span className="text-[14px] text-ink-secondary">Your email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="sam@glowstudio.co.uk"
              className="h-12 rounded-[10px] bg-field px-3.5 text-[16px] text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
          <TurnstileField siteKey={siteKey} />
          <button
            type="submit"
            className="flex h-12 items-center justify-center rounded-[10px] bg-accent text-[15px] font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Email me a link
          </button>
        </form>

        <p className="mt-4 text-[13px] leading-[1.5] text-ink-muted">
          New here? The same link sets you up — there&rsquo;s nothing separate to create.
        </p>

        {isDev && (
          <div className="mt-6 border-t border-hairline pt-5">
            <p className="text-[13px] tracking-[0.05em] text-ink-muted uppercase">Development</p>
            <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">
              Without a Postmark token the link is printed to the server console instead of being
              emailed.
            </p>
            <Link
              href="/api/dev/login?slug=glow-studio"
              prefetch={false}
              className="mt-3 flex h-11 items-center justify-center rounded-[10px] border border-border-strong text-[15px] font-semibold text-ink transition-colors hover:bg-surface-subtle"
            >
              Skip: sign in as Glow Studio
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}

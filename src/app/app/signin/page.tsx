import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'

/**
 * Sits OUTSIDE the (dashboard) route group so it is not behind the session
 * check — otherwise signing out would redirect-loop.
 *
 * There is no password field here and there never will be. For the demo the
 * link step is stood in for by a dev-only route.
 */
export default async function SignInPage() {
  const session = await getStaffSession()
  if (session) redirect('/app')

  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-[420px] rounded-[18px] border border-hairline bg-surface p-7">
        <div className="flex items-center gap-2.5">
          <span className="h-[26px] w-[26px] rounded-lg bg-accent" aria-hidden />
          <span className="text-[14px] leading-none font-semibold text-ink">Localli</span>
        </div>

        <h1 className="font-display mt-6 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">
          Sign in
        </h1>
        <p className="mt-2.5 text-[15px] leading-[1.5] text-ink-secondary">
          We&rsquo;ll email you a link. No password — this product doesn&rsquo;t have them.
        </p>

        <form className="mt-6 flex flex-col gap-3" action="/api/auth/business/request-link" method="post">
          <label className="flex flex-col gap-2">
            <span className="text-[14px] text-ink-secondary">Your email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="sam@glowstudio.co.uk"
              className="h-12 rounded-[10px] bg-field px-3.5 text-[16px] text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
          <button
            type="submit"
            disabled
            className="flex h-12 items-center justify-center rounded-[10px] bg-accent text-[15px] font-semibold text-white disabled:opacity-40"
          >
            Email me a link
          </button>
          <p className="text-[13px] leading-[1.5] text-ink-muted">
            Magic-link delivery is wired on Wednesday, alongside Postmark. Until then, use the
            dev entrance below.
          </p>
        </form>

        {isDev && (
          <div className="mt-6 border-t border-hairline pt-5">
            <p className="text-[13px] tracking-[0.05em] text-ink-muted uppercase">Development</p>
            <Link
              href="/api/dev/login?slug=glow-studio"
              prefetch={false}
              className="mt-3 flex h-11 items-center justify-center rounded-[10px] border border-border-strong text-[15px] font-semibold text-ink transition-colors hover:bg-surface-subtle"
            >
              Sign in as Glow Studio
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}

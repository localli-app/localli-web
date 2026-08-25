import Link from 'next/link'

/**
 * "Check your inbox." Deliberately a dead end with two ways out — resend, or
 * change the address — because those are the only two things that go wrong.
 */
export default async function CheckInboxPage({ searchParams }: PageProps<'/app/check-inbox'>) {
  const params = await searchParams
  const email = typeof params.email === 'string' ? params.email : null

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-[420px] rounded-[18px] border border-hairline bg-surface p-7">
        <div className="flex items-center gap-2.5">
          <span className="h-[26px] w-[26px] rounded-lg bg-accent" aria-hidden />
          <span className="text-[14px] leading-none font-semibold text-ink">Localli</span>
        </div>

        <h1 className="font-display mt-6 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">
          Check your inbox
        </h1>
        <p className="mt-2.5 text-[15px] leading-[1.5] text-ink-secondary">
          {email ? (
            <>
              We&rsquo;ve sent a link to <span className="font-semibold text-ink">{email}</span>.
              Open it on any device and you&rsquo;ll be signed in.
            </>
          ) : (
            <>We&rsquo;ve sent you a link. Open it on any device and you&rsquo;ll be signed in.</>
          )}
        </p>
        <p className="mt-3 text-[14px] leading-[1.5] text-ink-muted">
          It expires in 15 minutes and works once.
        </p>

        {email && (
          <form className="mt-6" action="/api/auth/business/request-link" method="post">
            <input type="hidden" name="email" value={email} />
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center rounded-[10px] border border-border-strong text-[15px] font-semibold text-ink transition-colors hover:bg-surface-subtle"
            >
              Send it again
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link
            href="/app/signin"
            className="text-[14px] text-ink-muted underline-offset-2 hover:underline"
          >
            Use a different email
          </Link>
        </div>
      </div>
    </main>
  )
}

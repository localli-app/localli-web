import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStaffSession } from '@/lib/auth/staff-session'

/**
 * The wizard runs full-page, outside the dashboard shell: no sidebar, no tab
 * bar, one decision per screen. Its own header carries the only escape hatch.
 */
export default async function SetupLayout({ children }: LayoutProps<'/app/setup'>) {
  const session = await getStaffSession()
  if (!session) redirect('/app/signin')

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-[58px] items-center justify-between border-b border-hairline bg-surface px-[18px] md:px-7">
        <span className="flex items-center gap-2.5">
          <span className="h-6 w-6 rounded-lg bg-accent" aria-hidden />
          <span className="text-[14px] leading-none font-semibold text-ink">Localli setup</span>
        </span>
        <Link href="/app" className="text-[14px] leading-none text-ink-muted hover:text-ink">
          Save and finish later
        </Link>
      </header>
      {children}
    </div>
  )
}

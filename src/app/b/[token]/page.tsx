import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ManageBookingScreen } from '@/components/booking/ManageBookingScreen'
import { getBookingByAccessToken } from '@/lib/booking/manage'

export const metadata: Metadata = {
  title: 'Your booking',
  // A booking link should never be indexed or forwarded into search results.
  robots: { index: false, follow: false },
}

/**
 * Artboard 1i — manage booking, reached from any confirmation, reminder or
 * receipt link. No login, no password, no account.
 */
export default async function ManageBookingPage({ params }: PageProps<'/b/[token]'>) {
  const { token } = await params
  const booking = await getBookingByAccessToken(token)

  // 404 for an unknown or revoked token, never 403 — a 403 would confirm the
  // token format was right.
  if (!booking) notFound()

  return <ManageBookingScreen booking={{ ...booking, accessToken: token }} />
}

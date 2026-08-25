import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BookingFlow } from '@/components/booking/BookingFlow'
import { getPublicBusinessBySlug } from '@/lib/db/queries'

/**
 * The public booking page. Unauthenticated, server-rendered, and the hot path.
 *
 * Every entry point carries a source in the URL (?s=gmb|qr|ig|sms|web), because
 * Google will not report custom-link performance to the business and we can.
 */

const VALID_SOURCES = new Set(['gmb', 'qr', 'ig', 'sms', 'web', 'direct'])

export async function generateMetadata({ params }: PageProps<'/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const business = await getPublicBusinessBySlug(slug)
  if (!business) return { title: 'Not found' }
  return {
    title: `Book with ${business.name}`,
    description: business.description ?? `Book an appointment with ${business.name}.`,
  }
}

export default async function BookingPage({ params, searchParams }: PageProps<'/[slug]'>) {
  const { slug } = await params
  const query = await searchParams

  const business = await getPublicBusinessBySlug(slug)
  if (!business) notFound()

  const rawSource = typeof query.s === 'string' ? query.s : undefined
  const source = rawSource && VALID_SOURCES.has(rawSource) ? rawSource : 'direct'
  const sourceDetail = typeof query.sd === 'string' ? query.sd.slice(0, 120) : null

  return <BookingFlow business={business} source={source} sourceDetail={sourceDetail} />
}

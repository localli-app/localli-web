import type { NextRequest } from 'next/server'
import { getStaffSession } from '@/lib/auth/staff-session'
import { qrPrintPdf } from '@/lib/dashboard/qr'
import { appBaseUrl } from '@/lib/dashboard/links'

/** A5 counter card at print resolution, with the business name already set. */
export async function GET(request: NextRequest) {
  const session = await getStaffSession()
  if (!session) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in first.' } }, { status: 401 })
  }

  const source = request.nextUrl.searchParams.get('s') ?? 'qr'
  const url = `${appBaseUrl(request)}/${session.businessSlug}?s=${encodeURIComponent(source)}`

  const pdf = await qrPrintPdf({ url, businessName: session.businessName })

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${session.businessSlug}-counter-card.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}

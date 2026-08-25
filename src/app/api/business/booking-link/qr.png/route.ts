import type { NextRequest } from 'next/server'
import { getStaffSession } from '@/lib/auth/staff-session'
import { qrPngBuffer } from '@/lib/dashboard/qr'
import { appBaseUrl } from '@/lib/dashboard/links'

export async function GET(request: NextRequest) {
  const session = await getStaffSession()
  if (!session) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in first.' } }, { status: 401 })
  }

  const source = request.nextUrl.searchParams.get('s') ?? 'qr'
  // The same image serves the on-screen preview and the download; only the
  // disposition differs, so `inline=1` renders instead of prompting a save.
  const inline = request.nextUrl.searchParams.get('inline') === '1'

  const url = `${appBaseUrl(request)}/${session.businessSlug}?s=${encodeURIComponent(source)}`
  const png = await qrPngBuffer(url, inline ? 512 : 1024)

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': inline
        ? 'inline'
        : `attachment; filename="${session.businessSlug}-qr.png"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}

import type { NextRequest } from 'next/server'
import { getStaffSession } from '@/lib/auth/staff-session'
import { recordAuthEvent } from '@/lib/auth/audit'
import { customersToCsv, exportBusinessData } from '@/lib/dashboard/account'

/**
 * GDPR export. "Owners want their data and giving it to them freely is part of
 * the promise" — planning/12-dashboard-spec.md.
 *
 * `?format=csv` returns just the customer list, which is the part anyone
 * actually opens in a spreadsheet.
 */
export async function GET(request: NextRequest) {
  const session = await getStaffSession()
  if (!session) {
    return Response.json({ error: { code: 'INVALID_TOKEN', message: 'Sign in first.' } }, { status: 401 })
  }

  const data = await exportBusinessData(session.businessId)
  if (!data) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Business not found.' } }, { status: 404 })
  }

  await recordAuthEvent({
    kind: 'data_exported',
    email: session.staffEmail,
    staffId: session.staffId,
    businessId: session.businessId,
    headers: request.headers,
    detail: {
      format: request.nextUrl.searchParams.get('format') ?? 'json',
      customers: data.customers.length,
      bookings: data.bookings.length,
    },
  })

  const stamp = new Date().toISOString().slice(0, 10)

  if (request.nextUrl.searchParams.get('format') === 'csv') {
    return new Response(customersToCsv(data.customers), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${session.businessSlug}-customers-${stamp}.csv"`,
      },
    })
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${session.businessSlug}-export-${stamp}.json"`,
    },
  })
}

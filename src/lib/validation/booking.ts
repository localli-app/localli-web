import { z } from 'zod'

/** ISO date, business-local, "YYYY-MM-DD". */
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')

export const latLngSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

export const availabilityQuerySchema = z
  .object({
    serviceId: z.uuid(),
    staffId: z.uuid().nullish(),
    from: localDateSchema,
    to: localDateSchema,
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((v) => v.from <= v.to, { message: '`from` must not be after `to`', path: ['from'] })
  .refine(
    (v) => {
      // Max 31 days per the API spec, so a client cannot ask for a year in one call.
      const from = new Date(`${v.from}T00:00:00Z`).getTime()
      const to = new Date(`${v.to}T00:00:00Z`).getTime()
      return (to - from) / 86_400_000 <= 30
    },
    { message: 'Range must be 31 days or fewer', path: ['to'] },
  )
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: 'lat and lng must be provided together',
    path: ['lat'],
  })

export const nextAvailableQuerySchema = z
  .object({
    serviceId: z.uuid(),
    staffId: z.uuid().nullish(),
    from: localDateSchema.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: 'lat and lng must be provided together',
    path: ['lat'],
  })

export const serviceAreaCheckSchema = z.object({
  businessSlug: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const bookingSourceSchema = z.enum([
  'gmb',
  'qr',
  'ig',
  'sms',
  'web',
  'direct',
  'manual',
  'marketplace',
])

export const createBookingSchema = z.object({
  businessSlug: z.string().min(1),
  serviceId: z.uuid(),
  staffId: z.uuid().nullish(),
  startsAt: z.iso.datetime({ offset: true }),
  customer: z
    .object({
      firstName: z.string().trim().min(1, 'Please enter your first name').max(80),
      lastName: z.string().trim().max(80).nullish(),
      // Loose on shape, strict on presence: a customer mistyping their own
      // number should not be blocked mid-flow by our regex.
      phone: z.string().trim().min(6).max(32).nullish(),
      email: z.email().nullish(),
    })
    .refine((c) => Boolean(c.phone) || Boolean(c.email), {
      message: 'Enter a mobile number or an email address',
      path: ['phone'],
    }),
  serviceAddress: z
    .object({
      line1: z.string().trim().min(1),
      city: z.string().trim().nullish(),
      postcode: z.string().trim().nullish(),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accessNotes: z.string().trim().max(500).nullish(),
    })
    .nullish(),
  note: z.string().trim().max(1000).nullish(),
  source: bookingSourceSchema.default('direct'),
  sourceDetail: z.string().trim().max(120).nullish(),
  deviceToken: z.string().trim().max(200).nullish(),
  // Never pre-ticked in any client, and separate from transactional messages.
  marketingConsent: z.boolean().default(false),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

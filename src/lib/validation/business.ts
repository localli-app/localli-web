import { z } from 'zod'

/** Reserved so a business slug can never shadow an app route. */
const RESERVED_SLUGS = new Set([
  'app',
  'api',
  'me',
  'b',
  'admin',
  'about',
  'help',
  'support',
  'pricing',
  'terms',
  'privacy',
  'signin',
  'signup',
  'static',
  '_next',
])

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'A little longer, please')
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Letters, numbers and hyphens only')
  .refine((v) => !RESERVED_SLUGS.has(v), { message: 'That one is reserved — try another' })

export const businessProfileSchema = z.object({
  name: z.string().trim().min(1, 'What are you called?').max(120).optional(),
  slug: slugSchema.optional(),
  description: z.string().trim().max(300).nullish(),
  phone: z.string().trim().max(32).nullish(),
  timezone: z.string().trim().max(64).optional(),
  isMobileEnabled: z.boolean().optional(),
  address: z
    .object({
      line1: z.string().trim().min(1).max(160),
      city: z.string().trim().max(80).nullish(),
      postcode: z.string().trim().max(16).nullish(),
      lat: z.number().min(-90).max(90).nullish(),
      lng: z.number().min(-180).max(180).nullish(),
    })
    .nullish(),
  /** Mobile only: how far the provider is willing to travel from base. */
  serviceRadiusMetres: z.int().min(500).max(80_000).nullish(),
})

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>

const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 09:00')

export const weeklyHoursSchema = z.object({
  hours: z
    .array(
      z
        .object({
          weekday: z.int().min(0).max(6),
          opensLocal: localTimeSchema,
          closesLocal: localTimeSchema,
        })
        // A window that ends before it starts is a typo, not an overnight shift:
        // overnight is expressed by a close time at or before open, which the
        // engine already understands, so only equality is rejected here.
        .refine((h) => h.opensLocal !== h.closesLocal, {
          message: 'Opening and closing times cannot be identical',
          path: ['closesLocal'],
        }),
    )
    .max(21),
})

export const staffMemberSchema = z.object({
  name: z.string().trim().min(1, 'They need a name').max(80),
  email: z.email().nullish(),
  isBookable: z.boolean().default(true),
})

export const addStaffSchema = z.object({
  staff: z.array(staffMemberSchema).max(20),
})

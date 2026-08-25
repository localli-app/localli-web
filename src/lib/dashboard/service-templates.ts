/**
 * The preloaded service catalogue.
 *
 * Service templates carry the whole onboarding flow. An owner facing an empty
 * "add your first service" form abandons; an owner ticking three boxes and
 * typing three prices finishes. Durations are typical, prices are deliberately
 * absent — the price is the only thing they should have to type.
 *
 * See planning/04-scope-and-mvp.md and planning/12-dashboard-spec.md.
 */

export interface ServiceTemplate {
  key: string
  name: string
  durationMinutes: number
  /** A sensible starting price in minor units, shown as a hint, never assumed. */
  suggestedPriceMinor?: number
  rebookIntervalDays?: number
}

export interface TemplateCategory {
  key: string
  label: string
  services: ServiceTemplate[]
}

export const SERVICE_TEMPLATES: TemplateCategory[] = [
  {
    key: 'hair',
    label: 'Hair',
    services: [
      { key: 'cut-blow-dry', name: 'Cut and Blow Dry', durationMinutes: 75, suggestedPriceMinor: 4500, rebookIntervalDays: 42 },
      { key: 'blow-dry', name: 'Blow Dry', durationMinutes: 45, suggestedPriceMinor: 3000, rebookIntervalDays: 28 },
      { key: 'colour-cut', name: 'Colour and Cut', durationMinutes: 150, suggestedPriceMinor: 12000, rebookIntervalDays: 42 },
      { key: 'balayage', name: 'Balayage', durationMinutes: 180, suggestedPriceMinor: 15000, rebookIntervalDays: 84 },
      { key: 'root-touch-up', name: 'Root Touch-Up', durationMinutes: 90, suggestedPriceMinor: 6500, rebookIntervalDays: 42 },
      { key: 'restyle', name: 'Restyle', durationMinutes: 90, suggestedPriceMinor: 5500, rebookIntervalDays: 56 },
    ],
  },
  {
    key: 'nails',
    label: 'Nails',
    services: [
      { key: 'gel-manicure', name: 'Gel Manicure', durationMinutes: 60, suggestedPriceMinor: 3500, rebookIntervalDays: 28 },
      { key: 'gel-pedicure', name: 'Gel Pedicure', durationMinutes: 60, suggestedPriceMinor: 4000, rebookIntervalDays: 42 },
      { key: 'manicure', name: 'Manicure', durationMinutes: 45, suggestedPriceMinor: 2500, rebookIntervalDays: 28 },
      { key: 'acrylic-full-set', name: 'Acrylic Full Set', durationMinutes: 90, suggestedPriceMinor: 5000, rebookIntervalDays: 28 },
      { key: 'infills', name: 'Infills', durationMinutes: 60, suggestedPriceMinor: 3500, rebookIntervalDays: 21 },
    ],
  },
  {
    key: 'lashes',
    label: 'Lashes',
    services: [
      { key: 'classic-set', name: 'Classic Lash Set', durationMinutes: 120, suggestedPriceMinor: 6000, rebookIntervalDays: 21 },
      { key: 'hybrid-set', name: 'Hybrid Lash Set', durationMinutes: 135, suggestedPriceMinor: 7000, rebookIntervalDays: 21 },
      { key: 'lash-infill', name: 'Lash Infill', durationMinutes: 60, suggestedPriceMinor: 3500, rebookIntervalDays: 21 },
      { key: 'lash-lift', name: 'Lash Lift', durationMinutes: 60, suggestedPriceMinor: 4500, rebookIntervalDays: 42 },
    ],
  },
  {
    key: 'brows',
    label: 'Brows',
    services: [
      { key: 'brow-shape', name: 'Brow Shape', durationMinutes: 30, suggestedPriceMinor: 1800, rebookIntervalDays: 28 },
      { key: 'brow-tint', name: 'Brow Tint', durationMinutes: 30, suggestedPriceMinor: 1500, rebookIntervalDays: 28 },
      { key: 'brow-lamination', name: 'Brow Lamination', durationMinutes: 60, suggestedPriceMinor: 4500, rebookIntervalDays: 42 },
    ],
  },
  {
    key: 'waxing',
    label: 'Waxing',
    services: [
      { key: 'leg-wax', name: 'Half Leg Wax', durationMinutes: 30, suggestedPriceMinor: 2200, rebookIntervalDays: 28 },
      { key: 'underarm-wax', name: 'Underarm Wax', durationMinutes: 15, suggestedPriceMinor: 1200, rebookIntervalDays: 28 },
      { key: 'bikini-wax', name: 'Bikini Wax', durationMinutes: 30, suggestedPriceMinor: 2500, rebookIntervalDays: 28 },
    ],
  },
  {
    key: 'barbering',
    label: 'Barbering',
    services: [
      { key: 'skin-fade', name: 'Skin Fade', durationMinutes: 45, suggestedPriceMinor: 2500, rebookIntervalDays: 21 },
      { key: 'beard-trim', name: 'Beard Trim', durationMinutes: 20, suggestedPriceMinor: 1200, rebookIntervalDays: 14 },
      { key: 'cut-beard', name: 'Cut and Beard', durationMinutes: 60, suggestedPriceMinor: 3200, rebookIntervalDays: 21 },
    ],
  },
  {
    key: 'aesthetics',
    label: 'Aesthetics',
    services: [
      { key: 'facial', name: 'Signature Facial', durationMinutes: 60, suggestedPriceMinor: 5500, rebookIntervalDays: 42 },
      { key: 'dermaplaning', name: 'Dermaplaning', durationMinutes: 45, suggestedPriceMinor: 5000, rebookIntervalDays: 42 },
    ],
  },
  {
    key: 'massage',
    label: 'Massage',
    services: [
      { key: 'swedish-60', name: 'Swedish Massage, 60 min', durationMinutes: 60, suggestedPriceMinor: 5000, rebookIntervalDays: 28 },
      { key: 'deep-tissue-60', name: 'Deep Tissue, 60 min', durationMinutes: 60, suggestedPriceMinor: 5500, rebookIntervalDays: 28 },
    ],
  },
]

export function findTemplate(key: string): { category: TemplateCategory; service: ServiceTemplate } | null {
  for (const category of SERVICE_TEMPLATES) {
    const service = category.services.find((s) => s.key === key)
    if (service) return { category, service }
  }
  return null
}

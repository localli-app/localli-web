/**
 * Eight destinations. Five sit in the phone tab bar, the other three live
 * behind More — so nothing a laptop can do is missing on a phone, it is only
 * repositioned. See planning/12-dashboard-spec.md, "Dashboard navigation".
 */

export interface NavItem {
  key: string
  label: string
  href: string
  /** Whether this appears in the phone bottom bar rather than the More sheet. */
  inTabBar: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'today', label: 'Today', href: '/app', inTabBar: true },
  { key: 'calendar', label: 'Calendar', href: '/app/calendar', inTabBar: true },
  { key: 'bookings', label: 'Bookings', href: '/app/bookings', inTabBar: true },
  { key: 'customers', label: 'Customers', href: '/app/customers', inTabBar: true },
  { key: 'link', label: 'Your link', href: '/app/link', inTabBar: false },
  { key: 'services', label: 'Services', href: '/app/services', inTabBar: false },
  { key: 'staff', label: 'Staff', href: '/app/staff', inTabBar: false },
  { key: 'settings', label: 'Settings', href: '/app/settings', inTabBar: false },
]

export const TAB_BAR_ITEMS = NAV_ITEMS.filter((i) => i.inTabBar)
export const MORE_ITEMS = NAV_ITEMS.filter((i) => !i.inTabBar)

/** Longest matching href wins, so /app doesn't claim /app/bookings. */
export function activeKey(pathname: string): string {
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  return match?.key ?? 'today'
}

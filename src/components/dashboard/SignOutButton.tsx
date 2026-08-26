'use client'

/**
 * Sign out. A plain form POST, so it works without JavaScript and cannot be
 * triggered by a cross-site GET.
 */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  )
}

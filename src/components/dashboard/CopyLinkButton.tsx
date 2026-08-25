'use client'

import { useEffect, useState } from 'react'

/**
 * Owners paste their booking link into DMs all day, so this gets used
 * constantly and needs to confirm it worked without stealing focus.
 */
export function CopyLinkButton({
  value,
  className = '',
  label = 'Copy',
  copiedLabel = 'Copied',
}: {
  value: string
  className?: string
  label?: string
  copiedLabel?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Clipboard is unavailable over plain HTTP on some browsers. Fall back to
      // selecting the text so the owner can copy it by hand rather than being
      // left with a button that silently does nothing.
      const helper = document.createElement('textarea')
      helper.value = value
      helper.setAttribute('readonly', '')
      helper.style.position = 'fixed'
      helper.style.opacity = '0'
      document.body.appendChild(helper)
      helper.select()
      try {
        document.execCommand('copy')
        setCopied(true)
      } finally {
        document.body.removeChild(helper)
      }
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      <span aria-hidden>{copied ? copiedLabel : label}</span>
      <span className="sr-only" role="status">
        {copied ? `${value} copied to clipboard` : label}
      </span>
    </button>
  )
}

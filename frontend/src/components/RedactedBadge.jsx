import { useState } from 'react'
import { HelpCircle, Lock } from 'lucide-react'

export function RedactedBadge({
  children,
  isMasked = true,
  reason = 'Field masked per context-aware privacy policy.',
  label = 'Masked',
  tone = 'amber',
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!isMasked) {
    return <>{children}</>
  }

  return (
    <span
      className={`redacted-wrapper tone-${tone}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip((prev) => !prev)}
      title={reason}
    >
      <span className="redacted-content">{children}</span>
      <span className="redacted-chip">
        <Lock size={10} />
        <small>{label}</small>
      </span>
      {showTooltip && (
        <span className="redacted-tooltip" role="tooltip">
          <HelpCircle size={13} />
          <span>{reason}</span>
        </span>
      )}
    </span>
  )
}

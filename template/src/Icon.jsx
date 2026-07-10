import React from 'react'

// Lucide-style stroke pictograms, 24×24 viewBox, currentColor stroke.
const GLYPHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  // element tools
  heading: <path d="M4 7V4h16v3M9 20h6M12 4v16" />,
  text: <path d="M4 6h16M4 12h16M4 18h10" />,
  square: <rect x="4" y="4" width="16" height="16" rx="2.5" />,
  circle: <circle cx="12" cy="12" r="8.5" />,
  line: <path d="M4 12h13M13 7l5 5-5 5" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
  // alignment — horizontal
  alignLeft: <path d="M4 6h16M4 12h10M4 18h13" />,
  alignCenter: <path d="M4 6h16M7 12h10M5 18h14" />,
  alignRight: <path d="M4 6h16M10 12h10M7 18h13" />,
  // alignment — vertical (bar on edge + block)
  alignTop: (
    <>
      <path d="M4 4h16" />
      <rect x="8.5" y="8" width="7" height="11" rx="1.5" />
    </>
  ),
  alignMiddle: (
    <>
      <path d="M4 12h16" />
      <rect x="8.5" y="6.5" width="7" height="11" rx="1.5" />
    </>
  ),
  alignBottom: (
    <>
      <path d="M4 20h16" />
      <rect x="8.5" y="5" width="7" height="11" rx="1.5" />
    </>
  ),
  // z-order
  bringFront: <path d="M5 4h14M12 20V8M7 12l5-5 5 5" />,
  sendBack: <path d="M5 20h14M12 4v12M7 12l5 5 5-5" />,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  arrow: <path d="M4 12h13M13 7l5 5-5 5" />,
  comment: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  reopen: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  reply: <path d="M9 17l-6-5 6-5M3 12h12a4 4 0 0 1 4 4v3" />,
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
  undo: <path d="M9 14 4 9l5-5M4 9h11a4 4 0 1 1 0 8h-1" />,
  redo: <path d="m15 14 5-5-5-5M20 9H9a4 4 0 1 0 0 8h1" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    </>
  ),
  group: (
    <>
      <path d="M8 3H6a2 2 0 0 0-2 2v2M16 3h2a2 2 0 0 1 2 2v2M8 21H6a2 2 0 0 1-2-2v-2M16 21h2a2 2 0 0 0 2-2v-2" />
    </>
  ),
  // object alignment
  alLeft: (
    <>
      <path d="M4 3v18" />
      <rect x="7" y="6" width="11" height="4" rx="1" />
      <rect x="7" y="14" width="7" height="4" rx="1" />
    </>
  ),
  alCenterH: (
    <>
      <path d="M12 3v18" />
      <rect x="6.5" y="6" width="11" height="4" rx="1" />
      <rect x="8.5" y="14" width="7" height="4" rx="1" />
    </>
  ),
  alRight: (
    <>
      <path d="M20 3v18" />
      <rect x="6" y="6" width="11" height="4" rx="1" />
      <rect x="10" y="14" width="7" height="4" rx="1" />
    </>
  ),
  alTop: (
    <>
      <path d="M3 4h18" />
      <rect x="6" y="7" width="4" height="11" rx="1" />
      <rect x="14" y="7" width="4" height="7" rx="1" />
    </>
  ),
  alMiddleV: (
    <>
      <path d="M3 12h18" />
      <rect x="6" y="6.5" width="4" height="11" rx="1" />
      <rect x="14" y="8.5" width="4" height="7" rx="1" />
    </>
  ),
  alBottom: (
    <>
      <path d="M3 20h18" />
      <rect x="6" y="6" width="4" height="11" rx="1" />
      <rect x="14" y="10" width="4" height="7" rx="1" />
    </>
  ),
  distH: (
    <>
      <path d="M4 3v18M20 3v18" />
      <rect x="9" y="8" width="6" height="8" rx="1" />
    </>
  ),
  distV: (
    <>
      <path d="M3 4h18M3 20h18" />
      <rect x="8" y="9" width="8" height="6" rx="1" />
    </>
  ),
  expand: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  shrink: <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 8 10 8a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M2 2l20 20" />
    </>
  ),
}

export function Icon({ name, size = 18, stroke = 1.75, className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {GLYPHS[name] || null}
    </svg>
  )
}

export function IconButton({
  icon,
  label,
  onClick,
  size = 30,
  iconSize = 17,
  variant = 'ghost',
  className = '',
  ...rest
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${variant} ${className}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  )
}

// Brand mark: black rounded square holding two offset white frames (stacked slates).
export function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="#111111" />
      <rect x="6.5" y="6" width="8.5" height="11" rx="2" stroke="#ffffff" strokeWidth="1.6" />
      <rect x="10" y="8.5" width="8.5" height="11" rx="2" fill="#111111" stroke="#ffffff" strokeWidth="1.6" />
    </svg>
  )
}

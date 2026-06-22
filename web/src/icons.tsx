// Inline SVG icons (no emoji anywhere in the app). Inherit currentColor.
type P = { className?: string; size?: number };
const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none" });

export const ClockIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const CheckIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

export const CrossIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const MinusIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 12h12" />
  </svg>
);

export const MarkerIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const BroadcastIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2.5" />
    <path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9M4.7 4.7a10.3 10.3 0 000 14.6M19.3 4.7a10.3 10.3 0 010 14.6" />
  </svg>
);

export const HelpIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9.2a2.8 2.8 0 015.4 1c0 1.9-2.8 2.5-2.8 2.5" />
    <path d="M12 17h.01" />
  </svg>
);

export const RadioIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 6L7 9" />
    <rect x="3" y="9" width="18" height="11" rx="2" />
    <circle cx="16" cy="14.5" r="2.5" />
    <path d="M7 13.5h3" />
  </svg>
);

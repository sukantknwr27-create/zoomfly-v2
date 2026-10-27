// Small line icons, drawn inline so there is nothing extra to download.
type P = { className?: string }
const base = { viewBox: '0 0 24 24', className: 'icon', 'aria-hidden': true as const }
const cls = (c?: string) => (c ? `icon ${c}` : 'icon')

export const IconShield = ({ className }: P) => (<svg {...base} className={cls(className)}><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>)
export const IconSeat = ({ className }: P) => (<svg {...base} className={cls(className)}><path d="M7 4h6a2 2 0 012 2v6H7V6a2 2 0 012-2z" /><path d="M5 12h14v3a2 2 0 01-2 2H7a2 2 0 01-2-2v-3z" /><path d="M8 17v3M16 17v3" /></svg>)
export const IconTag = ({ className }: P) => (<svg {...base} className={cls(className)}><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="8.5" r="1.2" /></svg>)
export const IconWallet = ({ className }: P) => (<svg {...base} className={cls(className)}><path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" /><path d="M4 7l11-3v3" /><circle cx="16" cy="13.5" r="1.2" /></svg>)
export const IconCalendar = ({ className }: P) => (<svg {...base} className={cls(className)}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>)
export const IconPin = ({ className }: P) => (<svg {...base} className={cls(className)}><path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>)
export const IconClock = ({ className }: P) => (<svg {...base} className={cls(className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>)
export const IconSearch = ({ className }: P) => (<svg {...base} className={cls(className)}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>)
export const IconCheck = ({ className }: P) => (<svg {...base} className={cls(className)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>)
export const IconStar = ({ className }: P) => (<svg {...base} className={cls(className)}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5z" /></svg>)
export const IconMenu = ({ className }: P) => (<svg {...base} className={cls(className)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>)
export const IconUsers = ({ className }: P) => (<svg {...base} className={cls(className)}><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5" /><path d="M16 5.5a3 3 0 010 6M18.5 14c1.6.7 2.5 2.1 2.5 4" /></svg>)
export const IconMountain = ({ className }: P) => (<svg {...base} className={cls(className)}><path d="M3 19l6-11 4 7 2-3 6 7H3z" /></svg>)
export const IconCompass = ({ className }: P) => (<svg {...base} className={cls(className)}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" /></svg>)

// Minimal stroke icon set. All 16px, 1.75 stroke, currentColor.
const Icon = ({ d, size = 16, stroke = 1.75, fill, children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d ? <path d={d} /> : children}
  </svg>
);

const IconUpload   = (p) => <Icon {...p} d="M12 3v14M6 9l6-6 6 6M4 21h16"/>;
const IconDownload = (p) => <Icon {...p} d="M12 3v14M6 13l6 6 6-6M4 21h16"/>;
const IconCheck    = (p) => <Icon {...p} d="M4 12l5 5L20 6"/>;
const IconX        = (p) => <Icon {...p} d="M6 6l12 12M6 18L18 6"/>;
const IconArrow    = (p) => <Icon {...p} d="M5 12h14M13 5l7 7-7 7"/>;
const IconBack     = (p) => <Icon {...p} d="M19 12H5M11 5l-7 7 7 7"/>;
const IconLink     = (p) => <Icon {...p} d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>;
const IconClock    = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
const IconHeart    = (p) => <Icon {...p} d="M12 20s-8-4.5-8-11a5 5 0 018-4 5 5 0 018 4c0 6.5-8 11-8 11z"/>;
const IconDumbbell = (p) => <Icon {...p}><path d="M2 12h2M20 12h2M6 6v12M18 6v12M9 9h6v6H9z"/></Icon>;
const IconWarn     = (p) => <Icon {...p}><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18h.01"/></Icon>;
const IconInfo     = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></Icon>;
const IconSearch   = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></Icon>;
const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></Icon>;
const IconMoon     = (p) => <Icon {...p} d="M21 13a9 9 0 11-10-10 7 7 0 0010 10z"/>;
const IconSun      = (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></Icon>;
const IconHistory  = (p) => <Icon {...p}><path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3"/><path d="M3 4v5h5M12 7v5l3 2"/></Icon>;
const IconZap      = (p) => <Icon {...p} d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>;
const IconWatch    = (p) => <Icon {...p}><circle cx="12" cy="12" r="6"/><path d="M9 3h6l-1 3M9 21h6l-1-3M12 9v3l2 2"/></Icon>;
const IconFile     = (p) => <Icon {...p} d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6"/>;
const IconChevDown = (p) => <Icon {...p} d="M6 9l6 6 6-6"/>;
const IconChevRight= (p) => <Icon {...p} d="M9 6l6 6-6 6"/>;
const IconSparkle  = (p) => <Icon {...p} d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6zM19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/>;
const IconLock     = (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></Icon>;
const IconFlame    = (p) => <Icon {...p} d="M12 2s5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-5 0 2 1 3 2 3s1-1 1-3-2-3 0-5z"/>;
const IconRefresh  = (p) => <Icon {...p} d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5"/>;
const IconGrip     = (p) => <Icon {...p}><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></Icon>;
const IconPlus     = (p) => <Icon {...p} d="M12 5v14M5 12h14"/>;

Object.assign(window, {
  Icon, IconUpload, IconDownload, IconCheck, IconX, IconArrow, IconBack,
  IconLink, IconClock, IconHeart, IconDumbbell, IconWarn, IconInfo, IconSearch,
  IconSettings, IconMoon, IconSun, IconHistory, IconZap, IconWatch, IconFile,
  IconChevDown, IconChevRight, IconSparkle, IconLock, IconFlame, IconRefresh,
  IconGrip, IconPlus,
});

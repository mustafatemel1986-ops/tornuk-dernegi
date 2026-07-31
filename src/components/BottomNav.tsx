import type { TabId } from '../types'

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'ana', label: 'Ana', icon: 'home' },
  { id: 'aidat', label: 'Aidat', icon: 'wallet' },
  { id: 'duyurular', label: 'Duyuru', icon: 'bell' },
  { id: 'etkinlikler', label: 'Etkinlik', icon: 'calendar' },
  { id: 'menu', label: 'Menü', icon: 'menu' },
]

export function BottomNav({
  active,
  onChange,
  duyuruBadge,
}: {
  active: TabId
  onChange: (tab: TabId) => void
  duyuruBadge?: boolean
}) {
  return (
    <nav className="bottom-nav" aria-label="Ana menü">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`bottom-nav-item ${active === tab.id ? 'is-active' : ''}`}
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            <NavIcon name={tab.icon} />
            {tab.id === 'duyurular' && duyuruBadge ? <i className="nav-dot" /> : null}
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

function NavIcon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      )
    case 'wallet':
      return (
        <svg {...common}>
          <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2" />
          <rect x="3" y="8" width="18" height="11" rx="2" />
          <path d="M16 13.5h2" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      )
  }
}

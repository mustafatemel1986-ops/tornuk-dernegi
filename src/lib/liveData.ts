import type { AnnouncementsData, EventsData, MembershipData } from '../types'

const MEMBERS_KEY = 'tornuk-live-members'
const DUYURU_KEY = 'tornuk-live-duyurular'
const ETKINLIK_KEY = 'tornuk-live-etkinlikler'
export const DATA_UPDATED_EVENT = 'tornuk-data-updated'

/**
 * Canlı veri kaynağı: GitHub raw (Pages CDN gecikmesini baypas eder).
 * Admin yayınları gh-pages’e yazılır; raw hemen güncellenir.
 */
export const LIVE_DATA_BASE =
  'https://raw.githubusercontent.com/mustafatemel1986-ops/tornuk-dernegi/gh-pages/data'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data))
  window.dispatchEvent(new Event(DATA_UPDATED_EVENT))
}

/** Yalnızca admin paneli taslağı — üye ekranları bunu okumaz. */
export function getLiveMembers(): MembershipData | null {
  return read<MembershipData>(MEMBERS_KEY)
}

export function setLiveMembers(data: MembershipData) {
  write(MEMBERS_KEY, data)
}

export function getLiveAnnouncements(): AnnouncementsData | null {
  return read<AnnouncementsData>(DUYURU_KEY)
}

export function setLiveAnnouncements(data: AnnouncementsData) {
  write(DUYURU_KEY, data)
}

export function getLiveEvents(): EventsData | null {
  return read<EventsData>(ETKINLIK_KEY)
}

export function setLiveEvents(data: EventsData) {
  write(ETKINLIK_KEY, data)
}

export function clearLiveData() {
  localStorage.removeItem(MEMBERS_KEY)
  localStorage.removeItem(DUYURU_KEY)
  localStorage.removeItem(ETKINLIK_KEY)
  window.dispatchEvent(new Event(DATA_UPDATED_EVENT))
}

async function fetchJson<T>(file: string): Promise<T> {
  const url = `${LIVE_DATA_BASE}/${file}?t=${Date.now()}&r=${Math.random()}`
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  })
  if (!res.ok) throw new Error(`${file} yüklenemedi (${res.status})`)
  return res.json() as Promise<T>
}

/**
 * Üye ekranları her zaman GitHub raw’dan okur (CDN/SW önbelleği yok).
 */
export async function loadMembershipData(): Promise<MembershipData> {
  return fetchJson<MembershipData>('uyeler.json')
}

export async function loadAnnouncementsData(): Promise<AnnouncementsData> {
  return fetchJson<AnnouncementsData>('duyurular.json')
}

export async function loadEventsData(): Promise<EventsData> {
  return fetchJson<EventsData>('etkinlikler.json')
}

export function hasLiveDraft(): boolean {
  return Boolean(getLiveMembers() || getLiveAnnouncements() || getLiveEvents())
}

/** Hangisi daha yeni? Admin yüklemede bayat taslağı ayıklamak için. */
export function pickNewerData<T extends { updatedAt?: string }>(
  live: T | null,
  server: T,
): { data: T; fromLive: boolean } {
  if (!live) return { data: server, fromLive: false }
  const liveT = Date.parse(live.updatedAt || '') || 0
  const serverT = Date.parse(server.updatedAt || '') || 0
  if (liveT > serverT) return { data: live, fromLive: true }
  return { data: server, fromLive: false }
}

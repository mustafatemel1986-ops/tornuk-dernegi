import type { AnnouncementsData, EventsData, MembershipData } from '../types'

const MEMBERS_KEY = 'tornuk-live-members'
const DUYURU_KEY = 'tornuk-live-duyurular'
const ETKINLIK_KEY = 'tornuk-live-etkinlikler'
export const DATA_UPDATED_EVENT = 'tornuk-data-updated'

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

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}?t=${Date.now()}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`${path} yüklenemedi`)
  return res.json() as Promise<T>
}

/** Önce bu cihazdaki admin taslağı, yoksa sunucu dosyası. */
export async function loadMembershipData(): Promise<MembershipData> {
  return getLiveMembers() ?? (await fetchJson<MembershipData>('data/uyeler.json'))
}

export async function loadAnnouncementsData(): Promise<AnnouncementsData> {
  return getLiveAnnouncements() ?? (await fetchJson<AnnouncementsData>('data/duyurular.json'))
}

export async function loadEventsData(): Promise<EventsData> {
  return getLiveEvents() ?? (await fetchJson<EventsData>('data/etkinlikler.json'))
}

export function hasLiveDraft(): boolean {
  return Boolean(getLiveMembers() || getLiveAnnouncements() || getLiveEvents())
}

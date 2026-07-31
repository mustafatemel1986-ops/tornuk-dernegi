export type YearAidatStatus = 'odendi' | 'borclu'

export type YearAidat = {
  year: number
  status: YearAidatStatus
  debtAmount: number
  note?: string
}

export type MemberRecord = {
  idHash: string
  displayName: string
  debtAmount: number
  debtMonths: string[]
  lastPayment: string | null
  notes: string
  /** Yıllık aidat durumu: ödendi / borçlu */
  yearHistory?: YearAidat[]
}

export type MembershipData = {
  associationName: string
  updatedAt: string
  monthlyFee: number
  currency: string
  members: MemberRecord[]
}

export type Announcement = {
  id: string
  title: string
  date: string
  summary: string
  body: string
}

export type AnnouncementsData = {
  updatedAt: string
  items: Announcement[]
}

export type EventItem = {
  id: string
  title: string
  date: string
  time: string
  place: string
  description: string
}

export type EventsData = {
  updatedAt: string
  items: EventItem[]
}

export type AssociationData = {
  name: string
  shortDescription: string
  address: string
  phone: string
  email: string
  workingHours: string
  board: { role: string; name: string }[]
  donation: {
    bankName: string
    accountName: string
    iban: string
    note: string
  }
  documents: {
    id: string
    title: string
    description: string
    url: string
  }[]
  faq: { q: string; a: string }[]
}

export type TabId = 'ana' | 'aidat' | 'duyurular' | 'etkinlikler' | 'menu'

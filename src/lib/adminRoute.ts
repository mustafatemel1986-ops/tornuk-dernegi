type LocationLike = Pick<Location, 'pathname' | 'search' | 'hash'>

/** Admin paneli için esnek adres algılama. */
export function isAdminRoute(location: LocationLike = window.location): boolean {
  const { pathname, search, hash } = location

  if (hash === '#admin' || hash.startsWith('#/admin') || hash.startsWith('#admin?')) {
    return true
  }

  const path = pathname.replace(/\/+$/, '')
  if (path.endsWith('/admin')) return true

  const params = new URLSearchParams(search)
  const admin = params.get('admin')
  if (admin === '1' || admin === 'true' || admin === 'yes') return true

  // Yanlış kodlanmış adresler: ?admin%3D1  veya  ?admin%3D1=
  for (const key of params.keys()) {
    if (key === 'admin' || key === 'admin=1' || key.startsWith('admin=')) return true
  }

  const raw = `${search}${hash}`.toLowerCase()
  return raw.includes('admin=1') || raw.includes('admin%3d1')
}

/** Temiz admin adresine yönlendir. */
export function getAdminHref(baseUrl = import.meta.env.BASE_URL): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${base}#admin`
}

export function normalizeAdminUrl() {
  if (!isAdminRoute()) return
  if (window.location.hash === '#admin') return

  const url = new URL(window.location.href)
  url.searchParams.delete('admin')
  // Bozuk anahtarları temizle
  for (const key of [...url.searchParams.keys()]) {
    if (key === 'admin=1' || key.startsWith('admin=')) url.searchParams.delete(key)
  }
  url.hash = 'admin'
  window.history.replaceState({}, '', url)
}

export const PUBLISH_API_URL =
  (import.meta.env.VITE_PUBLISH_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://tornuk-publish.tornuk-dernegi.workers.dev'

/**
 * TC numaralarını repoda düz metin tutmamak için SHA-256 hash.
 * Salt istemci tarafında olduğu için banka düzeyinde güvenlik değildir;
 * JSON dosyasında TC'nin açıkça görünmesini engeller.
 */
const SALT = 'tornuk-dernegi-aidat-v1'

export async function hashTc(tc: string): Promise<string> {
  const payload = `${SALT}:${tc.trim()}`
  const data = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

import { enableNotificationsAfterInstall } from '../lib/notifications'

export function NotifyPermissionGate({
  open,
  onDone,
}: {
  open: boolean
  onDone: () => void
}) {
  if (!open) return null

  async function allow() {
    await enableNotificationsAfterInstall()
    onDone()
  }

  function later() {
    onDone()
  }

  return (
    <div className="install-guide" role="dialog" aria-labelledby="notify-gate-title">
      <div className="install-guide-card">
        <h2 id="notify-gate-title">Bildirimlere izin verin</h2>
        <p>
          Yeni duyurularda telefonunuza uyarı gelsin. İzin vermeniz yeterli — başka bir uygulamaya
          gitmenize gerek yok.
        </p>
        <div className="admin-actions">
          <button type="button" className="btn btn-primary" onClick={() => void allow()}>
            İzin ver
          </button>
          <button type="button" className="btn btn-ghost" onClick={later}>
            Daha sonra
          </button>
        </div>
      </div>
    </div>
  )
}

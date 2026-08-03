/** Kısa bildirim sesi (harici dosya gerekmez). */
export function playNotifySound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    const beep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration + 0.02)
    }

    beep(880, 0, 0.14)
    beep(1174, 0.16, 0.18)

    window.setTimeout(() => {
      void ctx.close()
    }, 600)
  } catch {
    // Ses desteklenmiyorsa sessiz geç
  }
}

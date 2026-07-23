/**
 * Procedural WebAudio SFX — no audio files.
 * AudioContext unlock and mute arrive through rabbit/sdk.
 */
import * as sdk from '../rabbit/sdk'
import { CONFIG } from '../game.config'

let ctx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    sdk.audio.register(ctx)
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  return ctx
}

export function setMuted(value: boolean): void {
  muted = value
}

function playTone(startHz: number, endHz: number, seconds: number, volume = 0.22, type: OscillatorType = 'triangle'): void {
  if (muted) return
  try {
    const c = getCtx()
    const now = c.currentTime
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(startHz, now)
    osc.frequency.linearRampToValueAtTime(endHz, now + seconds)
    gain.gain.setValueAtTime(volume * CONFIG.audio.sfxVolume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds)
    osc.connect(gain).connect(c.destination)
    osc.start(now)
    osc.stop(now + seconds)
  } catch {
    // Audio unavailable — the game keeps running silently.
  }
}

/** Short UI blip. */
export function playClickSfx(): void {
  playTone(660, 880, 0.12, 0.25)
}

/** Coin/build confirmation. */
export function playBuildSfx(): void {
  playTone(380, 720, 0.16, 0.24, 'square')
}

/** Tower projectile release. */
export function playShotSfx(): void {
  playTone(520, 360, 0.08, 0.12)
}

/** Monster defeat. */
export function playDefeatSfx(): void {
  playTone(180, 90, 0.18, 0.2, 'sawtooth')
}

/** Rabbit keep damage. */
export function playLeakSfx(): void {
  playTone(140, 70, 0.28, 0.28, 'sawtooth')
}

/** Win/game-over fanfare. */
export function playFanfareSfx(): void {
  playTone(440, 660, 0.14, 0.22)
  window.setTimeout(() => playTone(660, 990, 0.18, 0.2), 90)
}

/** Reusable decaying white-noise burst for future medieval impacts. */
export function makeNoiseBurst(c: AudioContext, seconds: number): AudioBufferSourceNode {
  const bufferSize = c.sampleRate * seconds
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  const source = c.createBufferSource()
  source.buffer = buffer
  return source
}

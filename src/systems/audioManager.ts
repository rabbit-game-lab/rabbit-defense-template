/**
 * Procedural WebAudio SFX — no audio files.
 * AudioContext unlock and mute arrive through rabbit/sdk.
 */
import * as sdk from '../rabbit/sdk.js'
import type { TowerType } from '../data/towerDefense.js'
import { CONFIG } from '../game.config.js'
import {
  createDefaultAudioSettings,
  type AudioSettings,
  normalizeAudioSettings as normalizeAudioSettingsRules,
} from './audioSettingsRules.js'

let ctx: AudioContext | null = null
let audioSettings: AudioSettings = createDefaultAudioSettings()
let runtimeMuted: boolean | null = null

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    sdk.audio.register(ctx)
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  return ctx
}

function getEffectiveVolume(toneVolume: number): number {
  if (audioSettings.muted) return 0
  return toneVolume * CONFIG.audio.sfxVolume * audioSettings.soundVolume
}

export function applyAudioSettings(next: Partial<AudioSettings>): AudioSettings {
  audioSettings = normalizeAudioSettingsRules({
    ...audioSettings,
    ...next,
    ...(runtimeMuted !== null
      ? {
          muted: runtimeMuted,
        }
      : {}),
  })
  return getAudioSettings()
}

export function getAudioSettings(): AudioSettings {
  return {
    muted: audioSettings.muted,
    soundVolume: audioSettings.soundVolume,
  }
}

export function setRuntimeMuted(value: boolean): void {
  runtimeMuted = value
  setMuted(value)
}

export function clearRuntimeMuteOverride(): void {
  runtimeMuted = null
}

export function setMuted(value: boolean): void {
  runtimeMuted = value
  audioSettings = normalizeAudioSettingsRules({
    ...audioSettings,
    muted: value,
  })
}

export function setSoundVolume(value: number): void {
  audioSettings = normalizeAudioSettingsRules({
    ...audioSettings,
    soundVolume: value,
  })
}

function playTone(startHz: number, endHz: number, seconds: number, volume = 0.22, type: OscillatorType = 'triangle'): void {
  try {
    const effectiveVolume = getEffectiveVolume(volume)
    if (effectiveVolume === 0) return
    const c = getCtx()
    const now = c.currentTime
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(startHz, now)
    osc.frequency.linearRampToValueAtTime(endHz, now + seconds)
    gain.gain.setValueAtTime(effectiveVolume, now)
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

/** Recognizable projectile release per tower type. */
export function playShotSfx(type: TowerType = 'arrow'): void {
  if (type === 'frost') {
    playTone(840, 620, 0.11, 0.13, 'sine')
    return
  }
  if (type === 'bomb') {
    playTone(210, 105, 0.16, 0.17, 'square')
    return
  }
  playTone(620, 390, 0.07, 0.11, 'triangle')
}

/** Monster defeat. */
export function playDefeatSfx(): void {
  playTone(180, 90, 0.18, 0.2, 'sawtooth')
}

/** Rabbit keep damage. */
export function playLeakSfx(): void {
  playTone(140, 70, 0.28, 0.28, 'sawtooth')
}

/** Final boss arrival warning. */
export function playBossArrivalSfx(): void {
  playTone(130, 130, 0.22, 0.24, 'sawtooth')
  window.setTimeout(() => playTone(98, 82, 0.3, 0.22, 'square'), 170)
}

/** Whole-run defeat cue, distinct from an enemy defeat. */
export function playRunDefeatSfx(): void {
  playTone(260, 120, 0.32, 0.25, 'sawtooth')
  window.setTimeout(() => playTone(150, 58, 0.42, 0.2, 'triangle'), 150)
}

/** Victory fanfare. */
export function playFanfareSfx(): void {
  playTone(440, 660, 0.14, 0.22)
  window.setTimeout(() => playTone(660, 990, 0.18, 0.2), 90)
}

/** Reusable decaying white-noise burst for future effects. */
export function makeNoiseBurst(c: AudioContext, seconds: number): AudioBufferSourceNode {
  const bufferSize = c.sampleRate * seconds
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  const source = c.createBufferSource()
  source.buffer = buffer
  return source
}

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  advanceEnemyAlongPath,
  canAffordTower,
  chooseTowerTarget,
  cycleTargetMode,
  computeTowerUpgrade,
  createTowerUpgradePreview,
  resolveTowerUpgradeRequest,
  resolvePlacementDrop,
  findNearestPadWithinRadius,
  damageEnemy,
  distanceBetween,
  evaluateSlowImpact,
  formatTowerUpgradePreview,
  refundForTower,
  spendCoins,
} from '../.tmp-tests/src/systems/towerDefenseRules.js'

import {
  createRunState,
  finishRun,
  getRunStatus,
  isRunActive,
} from '../.tmp-tests/src/systems/runState.js'

import {
  createWaveState,
  prepareFirstWave,
  createWaveProgressSnapshot,
  isWaveRunComplete,
  markWaveEnemySpawned,
  nextWaveEnemy,
  scaleEnemyStats,
  summarizeWave,
} from '../.tmp-tests/src/systems/waveRules.js'

import {
  createTimedHudMessage,
  getRunFallbackStatus,
  resolveFeedbackStatus,
  resolveHudStatus,
  formatWaveHud,
  updateHudFeedback,
} from '../.tmp-tests/src/systems/hudRules.js'

import {
  createRunResultTracker,
  deriveWaveStats,
  recordKill,
  recordLeak,
  resolveLeak,
  buildRunResult,
} from '../.tmp-tests/src/systems/runResultRules.js'

import {
  applyOnboardingEvent,
  applyOnboardingPlayerAction,
  applyObjectiveAutoAdvance,
  createOnboardingState,
  getOnboardingInstruction,
} from '../.tmp-tests/src/systems/onboardingRules.js'

import {
  applyRunResultToProfile,
  createEmptyProfile,
  deserializeProfile,
  serializeProfile,
} from '../.tmp-tests/src/systems/profilePersistenceRules.js'
import {
  createDefaultAudioSettings,
  deserializeAudioSettings,
  normalizeAudioSettings,
  serializeAudioSettings,
} from '../.tmp-tests/src/systems/audioSettingsRules.js'
import {
  __setAudioSettingsStorageAdapter,
  getCachedAudioSettings,
  loadAudioSettings,
  resetAudioSettings,
  saveAudioSettings,
} from '../.tmp-tests/src/systems/audioSettingsStore.js'
import {
  applyAudioSettings,
  clearRuntimeMuteOverride,
  getAudioSettings as getAudioSettingsFromManager,
  setMuted,
  setSoundVolume,
} from '../.tmp-tests/src/systems/audioManager.js'
import { initializePersistedAudioSettings } from '../.tmp-tests/src/systems/audioStartup.js'
import {
  createDefaultAccessibilitySettings,
  deserializeAccessibilitySettings,
  normalizeAccessibilitySettings,
  serializeAccessibilitySettings,
} from '../.tmp-tests/src/systems/accessibilitySettingsRules.js'
import {
  __setAccessibilitySettingsStorageAdapter,
  getAccessibilitySettings,
  isReducedEffectsEnabled,
  loadAccessibilitySettings,
  setReducedEffects,
} from '../.tmp-tests/src/systems/accessibilitySettingsStore.js'
import { shouldAnnounce } from '../.tmp-tests/src/accessibility/liveAnnouncements.js'
import {
  clampAudioPercent,
  formatBestProfileResult,
  resolvePanelFillPercent,
  sliderGeometryFromPanel,
} from '../.tmp-tests/src/ui/audioSettingsPanelRules.js'
import {
  EXPECTED_SCENE_ORDER,
  createMenuLifecycleState,
  resolveBootNextScene,
  resolveMenuEscapeAction,
  resolveMenuOptionsAction,
  resolveMenuStartAction,
  isRestartSceneConfigured,
} from '../.tmp-tests/src/scenes/flowContracts.js'
import {
  cellOverlapsCircle,
  cellOverlapsRectangle,
  chebyshevCellDistance,
  evaluateTerrainPlacement,
  parseTerrainCellId,
  placementReasonMessage,
  pointOverlapsPath,
  snapToTerrainCell,
  terrainCellId,
} from '../.tmp-tests/src/systems/terrainPlacementRules.js'
import {
  createTerrainFocusTarget,
  cycleFocusInRegion,
  cycleFocusTarget,
  moveTerrainFocus,
  reconcileFocusTarget,
} from '../.tmp-tests/src/systems/focusNavigationRules.js'
import {
  MAX_ACTIVE_PROJECTILE_TRAILS,
  PROJECTILE_TRAIL_SAMPLE_MS,
  clampPlacementSparkCount,
  isEffectAllowed,
  shouldSampleProjectileTrail,
} from '../.tmp-tests/src/systems/effectPolicyRules.js'
import { TERRAIN_BLOCKERS } from '../.tmp-tests/src/data/terrain.js'

import {
  resolvePauseMenuAction,
  resolvePauseMenuEffect,
} from '../.tmp-tests/src/ui/pauseMenuRules.js'
import {
  calculateResponsiveViewport,
  createOrientationGateState,
  resolveOrientationGate,
} from '../.tmp-tests/src/ui/orientationGateRules.js'

import { refundForTower as refundForTowerEconomy } from '../.tmp-tests/src/systems/towerEconomyRules.js'
import {
  createBaselineStrategies,
  simulateStrategy,
} from '../.tmp-tests/src/systems/balanceSimulator.js'
import { buildTimeoutResult } from '../.tmp-tests/src/systems/balanceSimulationOutcome.js'
import { createSimulationState } from '../.tmp-tests/src/systems/balanceSimulationMath.js'
import {
  ENEMIES as balanceEnemies,
  TOWERS as balanceTowers,
  WAVES as balanceWaves,
} from '../.tmp-tests/src/data/towerDefense.js'
import { IMAGES as themeImages } from '../.tmp-tests/src/data/assets.js'

const path = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]

assert.equal(clampAudioPercent(Number.NaN), 0, 'invalid audio percent falls back safely')
assert.equal(clampAudioPercent(-12), 0, 'audio percent clamps at zero')
assert.equal(clampAudioPercent(33.6), 34, 'audio percent rounds for a stable UI label')
assert.equal(clampAudioPercent(140), 100, 'audio percent clamps at one hundred')
const sliderGeometry = sliderGeometryFromPanel(80, 640)
assert.deepEqual(sliderGeometry, { leftX: 112, width: 576 }, 'slider respects panel margins')
assert.deepEqual(
  resolvePanelFillPercent(25, sliderGeometry),
  { percent: 25, fillPercent: 0.25, thumbX: 256, label: '25%' },
  'slider fill, thumb and label share one normalized value',
)
assert.equal(
  formatBestProfileResult(12, 345, 90_000),
  'Best Dojo HP 12  Best Ryo 345  Fastest 90s',
  'menu profile summary uses ninja-facing labels',
)
assert.deepEqual(EXPECTED_SCENE_ORDER, ['BootScene', 'MainMenuScene', 'GameScene', 'UIScene'])
assert.deepEqual(resolveBootNextScene(false), { type: 'wait' })
assert.deepEqual(resolveBootNextScene(true), { type: 'start', nextScene: 'MainMenuScene' })
assert.deepEqual(
  createMenuLifecycleState(),
  { isStarting: false, isDestroyed: false, focusedButton: 'play' },
  'each menu creation resets transient lifecycle guards',
)
assert.equal(resolveMenuStartAction({ isStarting: false, optionsOpen: false }), 'start')
assert.equal(resolveMenuStartAction({ isStarting: true, optionsOpen: false }), 'block-already-starting')
assert.equal(resolveMenuStartAction({ isStarting: false, optionsOpen: true }), 'block-options-open')
assert.equal(resolveMenuStartAction({ isStarting: false, optionsOpen: false, gameSceneActive: true }), 'block-game-active')
assert.equal(resolveMenuOptionsAction({ isStarting: false, optionsOpen: false }), 'open')
assert.equal(resolveMenuOptionsAction({ isStarting: false, optionsOpen: true }), 'already-open')
assert.equal(resolveMenuOptionsAction({ isStarting: true, optionsOpen: false }), 'block-starting')
assert.equal(resolveMenuEscapeAction({ optionsOpen: true }), 'close-options')
assert.equal(resolveMenuEscapeAction({ optionsOpen: false }), 'ignore')
assert.equal(isRestartSceneConfigured('MainMenuScene'), true)
assert.equal(isRestartSceneConfigured('GameScene'), false)

let feedback = {}
feedback = updateHudFeedback(feedback, 'ambient', 'Scout defeated', 100, 1_000)
feedback = updateHudFeedback(feedback, 'action', 'Tower placed', 200, 1_000)
feedback = updateHudFeedback(feedback, 'critical', 'Dojo breached!', 300, 400)
assert.equal(
  resolveFeedbackStatus(350, feedback, 'Ready'),
  'Dojo breached!',
  'critical feedback cannot be hidden by placement or ambient messages',
)
assert.equal(
  resolveFeedbackStatus(750, feedback, 'Ready'),
  'Tower placed',
  'action feedback returns after the critical warning expires',
)
assert.equal(
  resolveFeedbackStatus(1_250, feedback, 'Ready'),
  'Ready',
  'expired feedback yields to the fallback status',
)
feedback = updateHudFeedback(feedback, 'critical', '   ', 1_300, 1_000)
assert.equal(
  resolveFeedbackStatus(1_300, feedback, 'Ready'),
  'Ready',
  'clearing one lane does not resurrect expired feedback',
)

const trackerBeforeFatalLeak = recordKill(createRunResultTracker(1_000), 2)
const fatalLeak = resolveLeak(trackerBeforeFatalLeak, 2, 3)
assert.equal(fatalLeak.tracker.leaks, 1, 'the fatal enemy is recorded before defeat accounting')
assert.equal(fatalLeak.livesRemaining, 0, 'fatal leak damage clamps lives at zero')
assert.equal(fatalLeak.isFatal, true)
const fatalLeakResult = buildRunResult(
  fatalLeak.tracker,
  4_000,
  'defeat',
  {
    wave: 2,
    totalWaves: 10,
    phase: 'active',
    toSpawnInCurrentWave: 0,
    nextEventMs: 0,
  },
  fatalLeak.livesRemaining,
  25,
)
assert.equal(fatalLeakResult.leaks, 1, 'the defeat snapshot includes the fatal breach')
assert.equal(fatalLeakResult.livesRemaining, 0)

const assertPauseStateMachine = (from, action, to, effect) => {
  assert.deepEqual(resolvePauseMenuAction(from, action), to)
  assert.deepEqual(resolvePauseMenuEffect(from, action), effect)
}
assertPauseStateMachine('running', 'toggle-pause', 'paused', 'pause-game')
for (const action of ['resume', 'open-options', 'request-restart', 'request-menu', 'cancel', 'confirm-restart', 'confirm-menu', 'close-options']) {
  assertPauseStateMachine('running', action, 'running', 'none')
}

assertPauseStateMachine('paused', 'toggle-pause', 'running', 'resume-game')
assertPauseStateMachine('paused', 'resume', 'running', 'resume-game')
assertPauseStateMachine('paused', 'open-options', 'options', 'none')
assertPauseStateMachine('paused', 'request-restart', 'confirm-restart', 'none')
assertPauseStateMachine('paused', 'request-menu', 'confirm-menu', 'none')
for (const action of ['close-options', 'confirm-restart', 'confirm-menu', 'cancel']) {
  assertPauseStateMachine('paused', action, 'paused', 'none')
}

for (const action of ['toggle-pause', 'close-options', 'cancel']) {
  assertPauseStateMachine('options', action, 'paused', 'none')
}
for (const action of ['open-options', 'request-restart', 'request-menu', 'confirm-restart', 'confirm-menu', 'resume']) {
  assertPauseStateMachine('options', action, 'options', 'none')
}

assertPauseStateMachine('confirm-restart', 'confirm-restart', 'running', 'restart-run')
for (const action of ['cancel', 'toggle-pause']) {
  assertPauseStateMachine('confirm-restart', action, 'paused', 'none')
}
for (const action of ['resume', 'request-restart', 'request-menu', 'close-options', 'confirm-menu', 'open-options']) {
  assertPauseStateMachine('confirm-restart', action, 'confirm-restart', 'none')
}

assertPauseStateMachine('confirm-menu', 'confirm-menu', 'running', 'go-main-menu')
for (const action of ['cancel', 'toggle-pause']) {
  assertPauseStateMachine('confirm-menu', action, 'paused', 'none')
}
for (const action of ['request-menu', 'request-restart', 'open-options', 'resume', 'close-options', 'confirm-restart']) {
  assertPauseStateMachine('confirm-menu', action, 'confirm-menu', 'none')
}

const sceneRegistrySource = readFileSync('src/scenes/index.ts', 'utf8')
const bootSceneSource = readFileSync('src/scenes/BootScene.ts', 'utf8')
const menuSceneSource = readFileSync('src/scenes/MainMenuScene.ts', 'utf8')
const gameSceneSource = readFileSync('src/scenes/GameScene.ts', 'utf8')
const combatSystemSource = readFileSync('src/systems/CombatSystem.ts', 'utf8')
const sceneButtonSource = readFileSync('src/ui/createSceneButton.ts', 'utf8')
const audioPanelSource = readFileSync('src/ui/AudioSettingsPanel.ts', 'utf8')
const indexHtmlSource = readFileSync('index.html', 'utf8')
const uiSceneSource = readFileSync('src/scenes/UIScene.ts', 'utf8')
const pauseMenuRulesSource = readFileSync('src/ui/pauseMenuRules.ts', 'utf8')
const pauseMenuControllerSource = readFileSync('src/ui/PauseMenuController.ts', 'utf8')
const uiConfigSource = readFileSync('src/config/ui.config.ts', 'utf8')
assert.match(sceneRegistrySource, /\[BootScene, MainMenuScene, GameScene, UIScene\]/)
assert.match(sceneRegistrySource, /RESTART_SCENE_KEY = 'MainMenuScene'/)
assert.match(bootSceneSource, /resolveBootNextScene\(true\)/)
assert.match(menuSceneSource, /new AudioSettingsPanel/)
assert.match(menuSceneSource, /keydown-TAB/)
assert.match(menuSceneSource, /setMenuFocus/)
assert.match(menuSceneSource, /dataset\.scene = 'main-menu'/)
assert.match(menuSceneSource, /delete this\.game\.canvas\.dataset\.runId/)
assert.match(menuSceneSource, /dataset\.overlay = 'audio-options'/)
assert.match(menuSceneSource, /const lifecycle = createMenuLifecycleState\(\)/)
assert.ok(
  menuSceneSource.indexOf('const lifecycle = createMenuLifecycleState()') <
    menuSceneSource.indexOf("this.game.canvas.dataset.scene = 'main-menu'"),
  'menu transient state resets before controls are recreated',
)
assert.match(gameSceneSource, /dataset\.scene = 'game'/)
assert.match(gameSceneSource, /dataset\.runId = String\(sessionId\)/)
assert.match(sceneButtonSource, /minTouchablePx/)
assert.match(sceneButtonSource, /depth\?: number/)
assert.match(audioPanelSource, /baseDepth \+ PANEL_DEPTH\.panel/)
assert.match(indexHtmlSource, /<main aria-labelledby="game-title">/)
assert.match(indexHtmlSource, /id="game-instructions"/)
assert.match(indexHtmlSource, /id="game-live-status"/)
assert.doesNotMatch(indexHtmlSource, /user-scalable=no/)
assert.match(pauseMenuRulesSource, /export type PauseMenuState/)
assert.match(pauseMenuRulesSource, /resolvePauseMenuAction/)
assert.match(pauseMenuRulesSource, /resolvePauseMenuEffect/)
assert.match(pauseMenuControllerSource, /gameScene\?\.scene\.pause\(\)/)
assert.match(pauseMenuControllerSource, /gameScene\?\.scene\.resume\(\)/)
assert.match(pauseMenuControllerSource, /manager\.start\(GAME_SCENE_KEY\)/)
assert.match(menuSceneSource, /manager\.stop\(GAME_SCENE_KEY\)/)
assert.match(pauseMenuControllerSource, /scene\.scene\.start\(MAIN_MENU_SCENE_KEY\)/)
assert.match(pauseMenuControllerSource, /handleKeyboardEvent\(event: KeyboardEvent\)/)
assert.doesNotMatch(pauseMenuControllerSource, /keyboard\?\.on\('keydown/)
assert.match(uiSceneSource, /pauseMenuController\.handleKeyboardEvent\(event\)/)
assert.match(pauseMenuControllerSource, /setKeyboardFocus/)
assert.match(pauseMenuControllerSource, /new AudioSettingsPanel/)
assert.match(pauseMenuControllerSource, /baseDepth:/)
assert.match(pauseMenuControllerSource, /confirm-restart/)
assert.match(pauseMenuControllerSource, /confirm-menu/)
assert.match(pauseMenuControllerSource, /confirmationReadyAt/)
assert.match(pauseMenuControllerSource, /focusButton\(1\)/)
assert.match(uiSceneSource, /pauseMenuController/)
assert.match(uiSceneSource, /createSceneButton\(this/)
assert.match(uiSceneSource, /dataset\.overlay = marker/)
assert.match(uiSceneSource, /delete this\.game\.canvas\.dataset\.overlay/)
assert.match(uiSceneSource, /setEnabled\(!hud\.result\)/)
assert.match(uiConfigSource, /pauseMenu/)
assert.match(uiConfigSource, /buttonSize: 56/)
assert.ok(
  combatSystemSource.indexOf('this.callbacks.onEnemyLeaked?.()') <
    combatSystemSource.indexOf('this.callbacks.onLivesLose(enemy.leakDamage)'),
  'combat records a breach before fatal damage can create the defeat result',
)

const balanceStrategies = createBaselineStrategies()
assert.deepEqual(
  Object.values(balanceTowers).map((tower) => tower.name),
  ['Shuriken Tower', 'Ice Shrine', 'Fire Mortar'],
  'all tower-facing names follow the ninja theme',
)
assert.deepEqual(
  Object.values(balanceEnemies).map((enemy) => enemy.name),
  ['Scout Mouse', 'Rogue Raccoon', 'Iron Panda', 'Crimson Bear Shogun'],
  'all enemy-facing names follow the ninja theme',
)
assert.deepEqual(
  themeImages.map(({ key }) => key).sort(),
  [
    'enemy-boss',
    'enemy-grunt',
    'enemy-runner',
    'enemy-tank',
    'hidden-dojo',
    'projectile-bomb',
    'projectile-frost',
    'projectile-shuriken',
    'tower-bomb',
    'tower-frost',
    'tower-shuriken',
    'world-board',
  ],
  'the ninja vertical slice declares every gameplay-critical image',
)
assert.equal(balanceWaves.length, 10, 'campaign contains exactly ten waves')
assert.deepEqual(
  balanceWaves.slice(0, 5).map((wave) => wave.enemies),
  [
    ['grunt', 'grunt', 'grunt', 'runner'],
    ['grunt', 'runner', 'grunt', 'runner', 'grunt'],
    ['runner', 'runner', 'grunt', 'grunt', 'tank'],
    ['grunt', 'tank', 'runner', 'grunt', 'runner', 'tank'],
    ['tank', 'grunt', 'runner', 'tank', 'runner', 'grunt', 'tank'],
  ],
  'the five onboarding waves remain unchanged',
)
const bossWaves = balanceWaves
  .map((wave, index) => wave.enemies.includes('warden') ? index + 1 : null)
  .filter((wave) => wave !== null)
assert.deepEqual(bossWaves, [10], 'Crimson Bear Shogun appears only in the final raid')
assert.equal(balanceEnemies.warden.slowResistance, 1, 'Crimson Bear Shogun fully resists new slows')
assert.equal(
  buildTimeoutResult(createSimulationState(), balanceStrategies[0]).outcome,
  'timeout',
  'simulation timeout stays distinct from gameplay defeat',
)
assert.deepEqual(
  balanceStrategies.map((strategy) => strategy.id),
  ['arrow-frost', 'arrow-bomb', 'arrow-focused', 'balanced-three'],
)
const balanceEnemyCount = balanceWaves.reduce((sum, wave) => sum + wave.enemies.length, 0)
for (const strategy of balanceStrategies) {
  const first = simulateStrategy(strategy)
  const second = simulateStrategy(strategy)
  assert.deepEqual(second, first, `${strategy.id} simulation must be deterministic`)
  assert.equal(first.waveSnapshots.length, balanceWaves.length)
  assert.ok(first.finalCoins >= 0)
  assert.ok(first.finalLives >= 0)
  assert.ok(first.totalKills + first.totalLeaks <= balanceEnemyCount)
  assert.ok(first.finalTowers.length <= 6)
  for (const tower of first.finalTowers) {
    assert.ok(tower.level >= 1)
    assert.ok(tower.level <= tower.maxLevel)
  }
  for (const wave of first.waveSnapshots) {
    assert.ok(wave.coinsAtStart >= 0 && wave.coinsAtEnd >= 0)
    assert.ok(wave.livesAtStart >= 0 && wave.livesAtEnd >= 0)
    assert.ok(wave.kills >= 0 && wave.leaks >= 0)
    assert.ok(wave.purchases.every((purchase) => purchase.wave === wave.wave && purchase.cost >= 0))
  }
}

assert.equal(canAffordTower(100, { cost: 75 }), true)
assert.equal(canAffordTower(50, { cost: 75 }), false)
assert.equal(spendCoins(100, 75), 25)
assert.equal(refundForTower({ cost: 80, level: 2, upgradeCost: 50 }), 78)
assert.equal(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
assert.equal(getRunFallbackStatus(false), 'Choose a defense, then place it on a clear grass square.')
assert.equal(getRunFallbackStatus(true), 'Defend Hidden Dojo — build or upgrade between raids.')
assert.deepEqual(
  findNearestPadWithinRadius(
    { x: 5, y: 0 },
    [
      { x: 3, y: 0, occupied: true },
      { x: 10, y: 0, occupied: false },
      { x: 20, y: 0, occupied: false },
    ],
    12,
  ),
  {
    nearestPad: { x: 3, y: 0, occupied: true },
    validPad: undefined,
    valid: false,
  },
  'the nearest occupied pad blocks snapping to a different free pad',
)

const placementSuccess = resolvePlacementDrop(
  { x: 7, y: 0 },
  [
    { x: 3, y: 0, occupied: true },
    { x: 10, y: 0, occupied: false },
    { x: 20, y: 0, occupied: false },
  ],
  12,
  { towerName: 'Arrow Tower', cost: 50 },
  80,
)
assert.equal(placementSuccess.type, 'success')
assert.equal(placementSuccess.spendAmount, 50)
assert.equal(placementSuccess.nextCoins, 30)
assert.equal(placementSuccess.target?.x, 10)

const placementOutside = resolvePlacementDrop(
  { x: 200, y: 200 },
  [
    { x: 3, y: 0, occupied: true },
    { x: 10, y: 0, occupied: false },
    { x: 20, y: 0, occupied: false },
  ],
  12,
  { towerName: 'Arrow Tower', cost: 50 },
  80,
)
assert.equal(placementOutside.type, 'cancelled')
assert.equal(placementOutside.reason, 'outside-range')
assert.equal(placementOutside.spendAmount, 0)
assert.equal(placementOutside.nextCoins, 80)
assert.equal(placementOutside.status, 'Drag cancelled — drop on a glowing circle.')

const placementOccupied = resolvePlacementDrop(
  { x: 3, y: 0 },
  [
    { x: 3, y: 0, occupied: true },
    { x: 10, y: 0, occupied: false },
    { x: 20, y: 0, occupied: false },
  ],
  12,
  { towerName: 'Arrow Tower', cost: 50 },
  80,
)
assert.equal(placementOccupied.type, 'cancelled')
assert.equal(placementOccupied.reason, 'occupied-pad')
assert.equal(placementOccupied.spendAmount, 0)
assert.equal(placementOccupied.nextCoins, 80)
assert.equal(placementOccupied.status, 'That build circle is already occupied.')

const placementInsufficient = resolvePlacementDrop(
  { x: 10, y: 0 },
  [
    { x: 3, y: 0, occupied: true },
    { x: 10, y: 0, occupied: false },
    { x: 20, y: 0, occupied: false },
  ],
  12,
  { towerName: 'Arrow Tower', cost: 50 },
  20,
)
assert.equal(placementInsufficient.type, 'cancelled')
assert.equal(placementInsufficient.reason, 'insufficient-funds')
assert.equal(placementInsufficient.spendAmount, 0)
assert.equal(placementInsufficient.nextCoins, 20)
assert.equal(placementInsufficient.status, 'Need 50 ryo to build Arrow Tower.')
assert.deepEqual(
  advanceEnemyAlongPath({ x: 80, y: 0, pathIndex: 0, progress: 80 }, path, 50),
  { x: 100, y: 30, pathIndex: 1, progress: 30, escaped: false },
)
assert.equal(advanceEnemyAlongPath({ x: 100, y: 90, pathIndex: 1, progress: 90 }, path, 20).escaped, true)

const firstSubpixelStep = advanceEnemyAlongPath(
  { x: 0, y: 0, pathIndex: 0, progress: 0 },
  path,
  0.48,
)
const secondSubpixelStep = advanceEnemyAlongPath(firstSubpixelStep, path, 0.48)
assert.equal(firstSubpixelStep.progress, 0.48, 'subpixel progress is preserved after one tick')
assert.equal(secondSubpixelStep.progress, 0.96, 'subpixel progress accumulates instead of rounding back to zero')

const enemies = [
  { id: 'tank', x: 180, y: 100, hp: 30, pathIndex: 0, progress: 70, escaped: false },
  { id: 'runner', x: 120, y: 100, hp: 10, pathIndex: 0, progress: 95, escaped: false },
  { id: 'dead', x: 110, y: 100, hp: 0, pathIndex: 0, progress: 120, escaped: false },
]
assert.equal(chooseTowerTarget({ x: 100, y: 100, range: 90 }, enemies)?.id, 'runner')

const first = { id: 'first', x: 132, y: 112, hp: 20, pathIndex: 2, progress: 30, escaped: false }
const second = { id: 'second', x: 132, y: 112, hp: 5, pathIndex: 2, progress: 30, escaped: false }
const tieSet = [second, first]
assert.equal(chooseTowerTarget({ x: 132, y: 112, range: 40 }, tieSet)?.id, 'second', 'same priorities preserve stable identity by list order')

const sameProgress = [
  { id: 'later', x: 130, y: 100, hp: 20, pathIndex: 1, progress: 70, escaped: false },
  { id: 'earlier', x: 100, y: 100, hp: 20, pathIndex: 1, progress: 30, escaped: false },
]
assert.equal(chooseTowerTarget({ x: 115, y: 100, range: 40 }, sameProgress)?.id, 'later', 'higher pathIndex then higher progress wins')

// targeting priority modes
const targetPool = [
  { id: 'lead', x: 150, y: 100, hp: 20, pathIndex: 2, progress: 40, escaped: false },
  { id: 'trail', x: 110, y: 100, hp: 60, pathIndex: 1, progress: 10, escaped: false },
  { id: 'mid', x: 130, y: 100, hp: 40, pathIndex: 1, progress: 80, escaped: false },
]
const targetTower = { x: 130, y: 100, range: 90 }
assert.equal(chooseTowerTarget(targetTower, targetPool, 'first')?.id, 'lead', 'first targets furthest along the path')
assert.equal(chooseTowerTarget(targetTower, targetPool, 'last')?.id, 'trail', 'last targets the least advanced enemy')
assert.equal(chooseTowerTarget(targetTower, targetPool, 'strongest')?.id, 'trail', 'strongest targets the highest hp enemy')
assert.equal(chooseTowerTarget(targetTower, targetPool, 'nearest')?.id, 'mid', 'nearest targets the closest enemy')
assert.equal(chooseTowerTarget(targetTower, targetPool)?.id, 'lead', 'omitted mode defaults to first for balance stability')
assert.equal(chooseTowerTarget(targetTower, [], 'strongest'), undefined, 'no enemies yields no target under any mode')

assert.equal(cycleTargetMode('first'), 'last', 'cycling advances to the next mode')
assert.equal(cycleTargetMode('nearest'), 'first', 'cycling wraps around to the start')
assert.equal(cycleTargetMode('first', -1), 'nearest', 'cycling backwards wraps to the end')

assert.deepEqual(
  evaluateSlowImpact({ slowFactor: 1, slowUntil: 0 }, { slowFactor: 0.55, slowUntil: 1200 }, 100),
  { slowFactor: 0.55, slowUntil: 1200 },
  'fresh slow applies its configured factor without resistance (default 0)',
)
assert.deepEqual(
  evaluateSlowImpact({ slowFactor: 0.55, slowUntil: 500 }, { slowFactor: 0.8, slowUntil: 1400 }, 600),
  { slowFactor: 0.8, slowUntil: 1400 },
  'expired slow cannot leak its stronger factor into a new impact',
)
assert.deepEqual(
  evaluateSlowImpact({ slowFactor: 1, slowUntil: 0 }, { slowFactor: 0.55, slowUntil: 1200 }, 100, 0.5),
  { slowFactor: 0.775, slowUntil: 1200 },
  'partial resistance weakens incoming slow',
)
assert.deepEqual(
  evaluateSlowImpact({ slowFactor: 1, slowUntil: 0 }, { slowFactor: 0.55, slowUntil: 1200 }, 100, 1),
  { slowFactor: 1, slowUntil: 0 },
  'full resistance negates all slow',
)
assert.deepEqual(
  evaluateSlowImpact({ slowFactor: 0.55, slowUntil: 900 }, { slowFactor: 0.8, slowUntil: 1500 }, 500),
  { slowFactor: 0.55, slowUntil: 1500 },
  'active stronger slow keeps its factor and extends expiry',
)
assert.deepEqual(
  evaluateSlowImpact({ slowFactor: 0.8, slowUntil: 900 }, { slowFactor: 0.55, slowUntil: 700 }, 500),
  { slowFactor: 0.55, slowUntil: 900 },
  'incoming stronger slow uses the strongest factor and longest expiry',
)
assert.deepEqual(
  damageEnemy({ hp: 12, slowFactor: 0.55, slowUntil: 500 }, 15, 600),
  { hp: 0, killed: true, slowFactor: 1, slowUntil: 0 },
  'damage clears expired slow state',
)
assert.deepEqual(computeTowerUpgrade({ level: 1, damage: 8, range: 90, fireRateMs: 700, upgradeCost: 50, maxLevel: 3 }), {
  level: 2,
  damage: 12,
  range: 100,
  fireRateMs: 630,
  upgradeCost: 75,
  maxLevel: 3,
})

const upgradePreview = createTowerUpgradePreview({
  level: 1,
  damage: 8,
  range: 90,
  fireRateMs: 700,
  upgradeCost: 55,
  maxLevel: 3,
})
assert.deepEqual(upgradePreview, {
  next: {
    level: 2,
    damage: 12,
    range: 100,
    fireRateMs: 630,
    upgradeCost: 83,
    maxLevel: 3,
  },
  delta: {
    damage: 4,
    range: 10,
    fireRateMs: -70,
  },
  cost: 55,
  summary: '+4 Damage · +10 Range · -70ms fire rate',
})

const noSelection = resolveTowerUpgradeRequest(null, 999)
assert.equal(noSelection.type, 'no-selection')
assert.equal(noSelection.reason, 'no-selection')

const unaffordable = resolveTowerUpgradeRequest(
  {
    level: 1,
    damage: 8,
    range: 90,
    fireRateMs: 700,
    upgradeCost: 60,
    maxLevel: 4,
  },
  40,
)
assert.equal(unaffordable.type, 'insufficient-funds')
assert.equal(unaffordable.reason, 'insufficient-funds')
assert.equal(unaffordable.needed, 60)

const affordableUpgrade = resolveTowerUpgradeRequest(
  {
    level: 1,
    damage: 8,
    range: 90,
    fireRateMs: 700,
    upgradeCost: 60,
    maxLevel: 4,
  },
  60,
)
assert.equal(affordableUpgrade.type, 'success')
assert.equal(affordableUpgrade.reason, 'success')
assert.deepEqual(affordableUpgrade.next, {
  level: 2,
  damage: 12,
  range: 100,
  fireRateMs: 630,
  upgradeCost: 90,
  maxLevel: 4,
})
assert.equal(affordableUpgrade.cost, 60)
assert.equal(affordableUpgrade.remainingCoins, 0)

const atMax = resolveTowerUpgradeRequest(
  {
    level: 3,
    damage: 20,
    range: 128,
    fireRateMs: 500,
    upgradeCost: 150,
    maxLevel: 3,
  },
  999,
)
assert.equal(atMax.type, 'max-level')
assert.equal(atMax.reason, 'max-level')
assert.equal(atMax.next.level, 3)
assert.equal(atMax.cost, 0)
assert.equal(atMax.remainingCoins, 999)
assert.equal(atMax.upgradeCost, 150)
assert.equal(atMax.maxed, true)

assert.equal(formatTowerUpgradePreview(upgradePreview), '+4 Damage · +10 Range · -70ms fire rate')

const waves = [
  { enemies: ['a', 'b'], spawnEveryMs: 100 },
  { enemies: ['c'], spawnEveryMs: 50 },
]
const waveState = createWaveState(1000, 300, 3000)
assert.equal(nextWaveEnemy(waveState, 1000, waves), undefined, 'first wave is blocked until a tower is placed')
assert.equal(createWaveProgressSnapshot(waveState, 1000, waves, 0).phase, 'preparing', 'snapshot starts in preparing')
prepareFirstWave(waveState, 1500)
assert.equal(createWaveProgressSnapshot(waveState, 3000, waves, 0).phase, 'preparing', 'snapshot remains in preparing during first countdown')
assert.equal(nextWaveEnemy(waveState, 4499, waves), undefined, 'first tower signal schedules delayed first spawn')
assert.equal(createWaveProgressSnapshot(waveState, 4499, waves, 0).nextEventMs, 1, 'countdown stays deterministic before first wave')
assert.equal(nextWaveEnemy(waveState, 4500, waves), 'a', 'deterministic first-wave countdown of 3000ms')
markWaveEnemySpawned(waveState, 4500, waves)
assert.equal(createWaveProgressSnapshot(waveState, 4500, waves, 0).phase, 'active', 'first spawn puts wave in active phase')
assert.equal(nextWaveEnemy(waveState, 4599, waves), undefined)
assert.equal(nextWaveEnemy(waveState, 4600, waves), 'b')
markWaveEnemySpawned(waveState, 4600, waves)
assert.equal(waveState.waveIndex, 1)
assert.equal(waveState.betweenWaveUntil, 4900)
assert.equal(createWaveProgressSnapshot(waveState, 4850, waves, 0).phase, 'between', 'between phase is explicit and timed')
assert.equal(createWaveProgressSnapshot(waveState, 4850, waves, 0).nextEventMs, 50, 'next event countdown tracks delay before next wave')
assert.equal(nextWaveEnemy(waveState, 4899, waves), undefined)
assert.equal(nextWaveEnemy(waveState, 4900, waves), 'c', 'configured cooldown gates the next wave')
markWaveEnemySpawned(waveState, 4900, waves)
assert.equal(isWaveRunComplete(waveState, waves.length), true)
const completeSnapshot = createWaveProgressSnapshot(waveState, 9999, waves, 0)
assert.equal(completeSnapshot.phase, 'complete', 'complete phase at no waves left and no active enemies')
assert.equal(completeSnapshot.nextEventMs, 0)
assert.equal(completeSnapshot.toSpawnInCurrentWave, 0)
assert.equal(nextWaveEnemy(waveState, 9999, waves), undefined)
assert.deepEqual(
  summarizeWave([{ enemies: ['a', 'a', 'b', 'a', 'c'], spawnEveryMs: 100 }], 0),
  [
    { type: 'a', count: 3 },
    { type: 'b', count: 1 },
    { type: 'c', count: 1 },
  ],
  'wave preview groups by type in first-appearance order',
)
assert.deepEqual(summarizeWave([{ enemies: ['a'], spawnEveryMs: 100 }], 5), [], 'out-of-range wave preview is empty')

assert.deepEqual(scaleEnemyStats({ hp: 26, reward: 9 }, 0), { hp: 26, reward: 9 })
assert.deepEqual(scaleEnemyStats({ hp: 26, reward: 9 }, 2), { hp: 35, reward: 13 })

assert.deepEqual(createTimedHudMessage(' ', 100, 1000), undefined)
assert.deepEqual(createTimedHudMessage('Ready', 1000, 250), { text: 'Ready', expiresAtMs: 1250 })

const now = 1000
const placementMessage = createTimedHudMessage('Place tower here', now, 700)
const combatMessage = createTimedHudMessage('Kill confirmed', now, 1000)
const fallback = 'Stay calm'
assert.equal(resolveHudStatus(now + 100, placementMessage, combatMessage, fallback), 'Place tower here', 'placement dominates while both valid')
assert.equal(resolveHudStatus(now + 700, placementMessage, combatMessage, fallback), 'Kill confirmed', 'expiry boundary falls through to combat')
assert.equal(resolveHudStatus(now + 900, placementMessage, combatMessage, fallback), 'Kill confirmed', 'combat appears when placement has expired')
assert.equal(resolveHudStatus(now + 1300, placementMessage, combatMessage, fallback), fallback, 'fallback used after both temporary messages expire')
assert.equal(resolveHudStatus(now + 1, undefined, undefined, fallback), fallback, 'fallback is always available')

const mkSnapshot = (phase, nextEventMs, toSpawn, wave = 1, totalWaves = 5, active = 0) =>
  formatWaveHud(
    {
      wave,
      totalWaves,
      phase,
      toSpawnInCurrentWave: toSpawn,
      nextEventMs,
    },
    active,
  )

assert.equal(mkSnapshot('preparing', 0, 6), 'Place your first ninja defense')
assert.equal(mkSnapshot('preparing', 1200, 0), 'Raid 1 starts in 2s')
assert.equal(mkSnapshot('active', 2000, 4, 3, 5, 1), 'Raid 3 · 5 left')
assert.equal(mkSnapshot('between', 1000, 4, 4, 5, 0), 'Raid 4 starts in 1s')
assert.equal(mkSnapshot('between', 2000, 4, 4, 5, 1), 'Raid 3 · 1 active · Next 2s')
assert.equal(mkSnapshot('between', 2300, 4, 2, 5, 3), 'Raid 1 · 3 active · Next 3s')
assert.equal(mkSnapshot('complete', 0, 0, 5, 5, 0), 'All raids repelled')

const onboardingConfig = { objectiveAutoAdvanceMs: 1700 }
let onboardingState = createOnboardingState(0, onboardingConfig, false)
assert.equal(onboardingState.step, 'objective')
assert.equal(getOnboardingInstruction(onboardingState.step), 'Objective: protect the Hidden Dojo through all 10 raids.')
assert.match(getOnboardingInstruction('choose'), /Choose a defense card/)
assert.match(getOnboardingInstruction('place'), /Tap a clear grass square/)
assert.match(getOnboardingInstruction('inspect'), /inspect its range/)

onboardingState = applyObjectiveAutoAdvance(onboardingState, 1200).state
assert.equal(onboardingState.step, 'objective')
assert.equal(applyObjectiveAutoAdvance(onboardingState, 1700).state.step, 'choose', 'objective auto-advances after configured delay')

onboardingState = createOnboardingState(0, onboardingConfig, false)
onboardingState = applyOnboardingEvent(onboardingState, 'tower-selected', 2000).state
assert.equal(onboardingState.step, 'objective', 'inspection does not skip choosing')

let transition = applyOnboardingEvent(onboardingState, 'tower-placed', 2500)
assert.equal(transition.didTransition, false, 'placement cannot skip choosing')
assert.equal(transition.state.step, 'objective')

const fastChoice = applyOnboardingPlayerAction(createOnboardingState(0, onboardingConfig, false), 'tower-chosen', 250)
assert.equal(fastChoice.didTransition, true)
assert.equal(fastChoice.state.step, 'place', 'early choice acknowledges the objective and advances')

onboardingState = createOnboardingState(0, onboardingConfig, false)
onboardingState = { ...onboardingState, autoAdvanceAtMs: 1000 }
onboardingState = applyObjectiveAutoAdvance(onboardingState, 1800).state
assert.equal(onboardingState.step, 'choose')
onboardingState = applyOnboardingEvent(onboardingState, 'tower-chosen', 1800).state
assert.equal(onboardingState.step, 'place')
transition = applyOnboardingEvent(onboardingState, 'tower-placed', 1801)
onboardingState = transition.state
assert.equal(transition.didTransition, true)
assert.equal(onboardingState.step, 'inspect', 'tower placement advances to inspection')

transition = applyOnboardingEvent(onboardingState, 'skip', 1900)
assert.equal(transition.didTransition, true)
assert.equal(transition.state.step, 'complete')
assert.equal(applyOnboardingEvent(transition.state, 'skip', 2000).didTransition, false, 'complete is immutable')

const completedConfigState = createOnboardingState(0, onboardingConfig, true)
assert.equal(completedConfigState.step, 'complete')

onboardingState = createOnboardingState(0, onboardingConfig, false)
onboardingState = applyObjectiveAutoAdvance({ ...onboardingState, autoAdvanceAtMs: 0 }, 0).state
onboardingState = applyOnboardingEvent(onboardingState, 'tower-chosen', 0).state
onboardingState = applyOnboardingEvent(onboardingState, 'tower-placed', 0).state
assert.equal(onboardingState.step, 'inspect', 'tower placement advances into inspect')

const finalInspection = applyOnboardingEvent(onboardingState, 'tower-selected', 0)
assert.equal(finalInspection.didTransition, true)
assert.equal(finalInspection.state.step, 'complete', 'inspection completes onboarding without an upgrade')

let skippedFromPlace = createOnboardingState(0, onboardingConfig, false)
skippedFromPlace = applyOnboardingEvent(applyObjectiveAutoAdvance({ ...skippedFromPlace, autoAdvanceAtMs: 0 }, 0).state, 'skip', 0).state
assert.equal(skippedFromPlace.step, 'complete')

const skippedFromObjective = createOnboardingState(0, onboardingConfig, false)
assert.equal(applyOnboardingEvent(skippedFromObjective, 'skip', 0).state.step, 'complete')

const skippedFromInspect = applyOnboardingEvent(onboardingState, 'skip', 0)
assert.equal(skippedFromInspect.didTransition, true)
assert.equal(skippedFromInspect.state.step, 'complete')

const running = createRunState(100)
assert.equal(isRunActive(running), true)
assert.equal(getRunStatus(running), 'running')
const victory = finishRun(running, 'victory', 500)
assert.equal(victory.didTransition, true)
assert.deepEqual(victory.state, { status: 'won', startedAt: 100, endedAt: 500 })
const repeated = finishRun(victory.state, 'defeat', 900)
assert.equal(repeated.didTransition, false, 'terminal transition is idempotent')
assert.equal(repeated.state, victory.state, 'repeated finish preserves the original object and outcome')

// runResultRules
const tracker = createRunResultTracker(100)
assert.deepEqual(
  deriveWaveStats({ wave: 0, phase: 'preparing', toSpawnInCurrentWave: 1, totalWaves: 3, activeEnemies: 0 }),
  {
    wavesReached: 0,
    wavesCleared: 0,
  },
  'run result tracks zero while preparing',
)
let tracked = recordKill(tracker, 3)
tracked = recordLeak(tracked, 2)
tracked = recordKill(tracked, 3)
tracked = recordLeak(tracked)
const runResult = buildRunResult(tracked, 2400, 'victory', { wave: 2, phase: 'active', toSpawnInCurrentWave: 1, totalWaves: 3, activeEnemies: 0 }, 3, 200)
assert.deepEqual(runResult, {
  outcome: 'victory',
  durationMs: 2300,
  wavesReached: 2,
  wavesCleared: 1,
  kills: 6,
  leaks: 3,
  livesRemaining: 3,
  coinsRemaining: 200,
})

// profilePersistenceRules
assert.deepEqual(createEmptyProfile(), {
  schemaVersion: 1,
  onboardingCompleted: false,
  wins: 0,
  defeats: 0,
  bestLives: 0,
  bestCoins: 0,
  fastestWinMs: 0,
})
assert.deepEqual(deserializeProfile(null), createEmptyProfile())
assert.deepEqual(deserializeProfile('bad'), createEmptyProfile())
const compact = {
  v: 0,
  o: 1,
  w: 5,
  d: 2,
  l: 3,
  c: 4,
  f: 900,
}
const profileFromCompact = deserializeProfile(JSON.stringify(compact))
assert.equal(profileFromCompact.onboardingCompleted, true)
assert.equal(profileFromCompact.wins, 5)
assert.equal(profileFromCompact.bestLives, 3)
assert.equal(profileFromCompact.fastestWinMs, 900)
const serialized = serializeProfile(profileFromCompact)
assert.deepEqual(deserializeProfile(serialized), profileFromCompact)

const baseline = createEmptyProfile()
const profileAfterWin = applyRunResultToProfile(baseline, {
  outcome: 'victory',
  wavesCleared: 1,
  wavesReached: 1,
  kills: 2,
  leaks: 1,
  livesRemaining: 6,
  coinsRemaining: 50,
  durationMs: 320,
})
const profileAfterLoss = applyRunResultToProfile(profileAfterWin, {
  outcome: 'defeat',
  wavesCleared: 3,
  wavesReached: 4,
  kills: 3,
  leaks: 4,
  livesRemaining: 0,
  coinsRemaining: 0,
  durationMs: 700,
})
assert.equal(profileAfterWin.wins, 1)
assert.equal(profileAfterWin.defeats, 0)
assert.equal(profileAfterWin.bestLives, 6)
assert.equal(profileAfterWin.bestCoins, 50)
assert.equal(profileAfterWin.fastestWinMs, 320)
assert.equal(profileAfterLoss.defeats, 1)

// audioSettingsRules
assert.deepEqual(createDefaultAudioSettings(), {
  muted: false,
  soundVolume: 0.45,
})

assert.deepEqual(normalizeAudioSettings({}), {
  muted: false,
  soundVolume: 0.45,
})
assert.deepEqual(normalizeAudioSettings({ muted: 'yes', soundVolume: 2 }), {
  muted: false,
  soundVolume: 1,
})
assert.deepEqual(normalizeAudioSettings({ muted: true, soundVolume: -0.3 }), {
  muted: true,
  soundVolume: 0,
})
assert.deepEqual(normalizeAudioSettings({ muted: 1, soundVolume: Number.NaN }), {
  muted: false,
  soundVolume: 0.45,
})
assert.deepEqual(normalizeAudioSettings({ muted: true, soundVolume: Number.POSITIVE_INFINITY }), {
  muted: true,
  soundVolume: 0.45,
})

assert.deepEqual(deserializeAudioSettings(null), createDefaultAudioSettings())
assert.deepEqual(deserializeAudioSettings('bad'), createDefaultAudioSettings())
assert.deepEqual(deserializeAudioSettings('{"muted":true,"soundVolume":0.9}'), {
  muted: true,
  soundVolume: 0.9,
})
assert.deepEqual(deserializeAudioSettings('{"soundVolume":2}'), {
  muted: false,
  soundVolume: 1,
})
assert.deepEqual(deserializeAudioSettings('{"muted":1,"soundVolume":0}'), {
  muted: false,
  soundVolume: 0,
})
assert.deepEqual(deserializeAudioSettings('{"muted":true,"soundVolume":"high"}'), {
  muted: true,
  soundVolume: 0.45,
})

const serializedAudio = serializeAudioSettings({ muted: true, soundVolume: 0.66 })
assert.deepEqual(deserializeAudioSettings(serializedAudio), {
  muted: true,
  soundVolume: 0.66,
})

// Concurrency: a load should not overwrite a newer save that completes first.
const concurrentAudioStorage = {
  values: new Map(),
  release: null,
  releasePromise: null,
}
concurrentAudioStorage.releasePromise = new Promise((resolve) => {
  concurrentAudioStorage.release = resolve
})
concurrentAudioStorage.values.set('rabbit-defense-audio-settings', JSON.stringify({ muted: false, soundVolume: 0.2 }))
const concurrentAdapter = {
  async getItem(key) {
    await concurrentAudioStorage.releasePromise
    return concurrentAudioStorage.values.get(key) ?? null
  },
  async setItem(key, value) {
    concurrentAudioStorage.values.set(key, value)
  },
}
__setAudioSettingsStorageAdapter(concurrentAdapter)

const inFlightLoad = loadAudioSettings()
const savedWhileLoading = await saveAudioSettings({ muted: true, soundVolume: 0.9 })
concurrentAudioStorage.release()
const loadResultAfterConcurrentSave = await inFlightLoad
assert.deepEqual(savedWhileLoading, { muted: true, soundVolume: 0.9 }, 'audio save remains durable while a storage load is pending')
assert.deepEqual(loadResultAfterConcurrentSave, savedWhileLoading, 'concurrent load result does not lose the newer save')
assert.deepEqual(getCachedAudioSettings(), savedWhileLoading, 'concurrent save remains cached when load resolves late')

// Adapter changes during in-flight load should invalidate stale storage reads.
const staleAdapter = {
  values: new Map([
    ['rabbit-defense-audio-settings', JSON.stringify({ muted: true, soundVolume: 0.4 })],
  ]),
  release: null,
  releasePromise: null,
}
staleAdapter.releasePromise = new Promise((resolve) => {
  staleAdapter.release = resolve
})
const delayedOldAdapter = {
  async getItem(key) {
    await staleAdapter.releasePromise
    return staleAdapter.values.get(key) ?? null
  },
  async setItem(key, value) {
    staleAdapter.values.set(key, value)
  },
}
const switchedAdapter = {
  async getItem() {
    return JSON.stringify({ muted: false, soundVolume: 0.6 })
  },
  async setItem() {
    return undefined
  },
}
__setAudioSettingsStorageAdapter(delayedOldAdapter)
const staleLoad = loadAudioSettings()
__setAudioSettingsStorageAdapter(switchedAdapter)
staleAdapter.release()
assert.deepEqual(await staleLoad, { muted: false, soundVolume: 0.6 }, 'stale load does not overwrite state after adapter switch')

// audioSettingsStore
function createMemoryAudioAdapter() {
  const values = new Map()
  return {
    async getItem(key) {
      return values.get(key) ?? null
    },
    async setItem(key, value) {
      values.set(key, value)
    },
    values,
  }
}

const memoryAudioAdapter = createMemoryAudioAdapter()
__setAudioSettingsStorageAdapter(memoryAudioAdapter)

const loadedFromFreshStorage = await loadAudioSettings()
assert.deepEqual(loadedFromFreshStorage, createDefaultAudioSettings())
const savedSettings = await saveAudioSettings({ muted: true, soundVolume: 0.7 })
assert.deepEqual(savedSettings, { muted: true, soundVolume: 0.7 })
const cachedAgain = await loadAudioSettings()
assert.deepEqual(cachedAgain, savedSettings)
await saveAudioSettings({ muted: false, soundVolume: 0.2 })
assert.equal(memoryAudioAdapter.values.get('rabbit-defense-audio-settings') !== undefined, true)
cachedAgain.soundVolume = 1
assert.equal((await loadAudioSettings()).soundVolume, 0.2, 'store returns cloned audio settings')
assert.equal(getCachedAudioSettings()?.soundVolume, 0.2)

const resetSettings = await resetAudioSettings()
assert.deepEqual(resetSettings, createDefaultAudioSettings())

const readErrorAdapter = {
  getItem: async () => {
    throw new Error('read fail')
  },
  setItem: async () => undefined,
}
__setAudioSettingsStorageAdapter(readErrorAdapter)
assert.deepEqual(await loadAudioSettings(), createDefaultAudioSettings(), 'read errors fall back to defaults')

const writeErrorAdapter = {
  getItem: async () => null,
  async setItem() {
    throw new Error('write fail')
  },
}
__setAudioSettingsStorageAdapter(writeErrorAdapter)
const writeErrorSettings = await saveAudioSettings({ muted: true, soundVolume: 0.9 })
assert.deepEqual(writeErrorSettings, { muted: true, soundVolume: 0.9 }, 'write errors are swallowed and still return settings')

// audioManager
applyAudioSettings({ muted: true, soundVolume: 0 })
assert.deepEqual(getAudioSettingsFromManager(), { muted: true, soundVolume: 0 })
setMuted(false)
assert.equal(getAudioSettingsFromManager().muted, false)
setSoundVolume(1.3)
assert.equal(getAudioSettingsFromManager().soundVolume, 1)
setSoundVolume(-0.5)
assert.equal(getAudioSettingsFromManager().soundVolume, 0)
const liveSettingsFromManager = getAudioSettingsFromManager()
liveSettingsFromManager.soundVolume = 0.1
assert.notEqual(getAudioSettingsFromManager().soundVolume, 0.1, 'audioManager exposes defensive clones')

clearRuntimeMuteOverride()

let persistedSettingsCalls = 0
const persistedSettingsResult = await initializePersistedAudioSettings({
  loadAudioSettings: async () => {
    persistedSettingsCalls += 1
    return { muted: true, soundVolume: 0.25 }
  },
  applyAudioSettings: (settings) => {
    assert.deepEqual(settings, { muted: true, soundVolume: 0.25 })
    applyAudioSettings(settings)
    assert.equal(persistedSettingsCalls, 1)
  },
})
assert.equal(persistedSettingsCalls, 1)
assert.equal(persistedSettingsResult, undefined)

clearRuntimeMuteOverride()
setMuted(true)
await initializePersistedAudioSettings({
  loadAudioSettings: async () => ({ muted: false, soundVolume: 0.2 }),
  applyAudioSettings: (settings) => {
    assert.deepEqual(settings, { muted: false, soundVolume: 0.2 })
    applyAudioSettings(settings)
  },
})
assert.equal(getAudioSettingsFromManager().muted, true, 'explicit runtime mute from platform callbacks is preserved across startup load')
assert.equal(getAudioSettingsFromManager().soundVolume, 0.2, 'persisted startup load still applies volume while runtime mute is active')

let startupResolve = null
let startupResolved = false
const startupGate = new Promise((resolve) => {
  startupResolve = resolve
})
clearRuntimeMuteOverride()
const startupDuringLoad = initializePersistedAudioSettings({
  loadAudioSettings: async () => {
    await startupGate
    startupResolved = true
    return { muted: false, soundVolume: 0.35 }
  },
  applyAudioSettings: (settings) => {
    assert.deepEqual(settings, { muted: false, soundVolume: 0.35 })
    applyAudioSettings(settings)
  },
})
setMuted(false)
startupResolve?.()
await startupDuringLoad
assert.equal(startupResolved, true, 'startup load callback resolves before override assertion check')
assert.equal(getAudioSettingsFromManager().muted, false, 'runtime mute set during startup load controls the result')
assert.equal(getAudioSettingsFromManager().soundVolume, 0.35, 'startup still applies sound volume when muted by runtime override')

clearRuntimeMuteOverride()
await initializePersistedAudioSettings({
  loadAudioSettings: async () => ({ muted: false, soundVolume: 0.66 }),
  applyAudioSettings: (settings) => {
    assert.deepEqual(settings, { muted: false, soundVolume: 0.66 })
    applyAudioSettings(settings)
  },
})
await initializePersistedAudioSettings({
  loadAudioSettings: async () => ({ muted: true, soundVolume: 0.12 }),
  applyAudioSettings: (settings) => {
    assert.deepEqual(settings, { muted: true, soundVolume: 0.12 })
    applyAudioSettings(settings)
  },
})
assert.equal(getAudioSettingsFromManager().muted, true, 'startup application does not become a runtime mute override')

let fallbackApplied = false
await initializePersistedAudioSettings({
  loadAudioSettings: async () => {
    throw new Error('storage read failed')
  },
  applyAudioSettings: (settings) => {
    fallbackApplied = true
    assert.deepEqual(settings, createDefaultAudioSettings())
    applyAudioSettings(settings)
  },
})
assert.equal(fallbackApplied, true)

// accessibility settings + announcement throttling
assert.deepEqual(createDefaultAccessibilitySettings(), { reducedEffects: false })
assert.deepEqual(createDefaultAccessibilitySettings(true), { reducedEffects: true })
assert.deepEqual(normalizeAccessibilitySettings({ reducedEffects: true }), {
  reducedEffects: true,
})
assert.deepEqual(normalizeAccessibilitySettings({ reducedEffects: 'yes' }, true), {
  reducedEffects: true,
})
assert.deepEqual(deserializeAccessibilitySettings(null, true), { reducedEffects: true })
assert.deepEqual(deserializeAccessibilitySettings('bad', false), { reducedEffects: false })
const serializedAccessibility = serializeAccessibilitySettings({ reducedEffects: true })
assert.deepEqual(deserializeAccessibilitySettings(serializedAccessibility), {
  reducedEffects: true,
})

const accessibilityValues = new Map()
__setAccessibilitySettingsStorageAdapter({
  async getItem(key) {
    return accessibilityValues.get(key) ?? null
  },
  async setItem(key, value) {
    accessibilityValues.set(key, value)
  },
})
assert.deepEqual(await loadAccessibilitySettings(), { reducedEffects: false })
assert.deepEqual(await setReducedEffects(true), { reducedEffects: true })
assert.equal(isReducedEffectsEnabled(), true)
const accessibilityClone = getAccessibilitySettings()
accessibilityClone.reducedEffects = false
assert.equal(isReducedEffectsEnabled(), true, 'accessibility store returns defensive clones')

const throttleHistory = new Map([['hp-loss', 1000]])
assert.equal(shouldAnnounce('raid-1', 1100, 1200, throttleHistory), true)
assert.equal(shouldAnnounce('hp-loss', 1100, 1200, throttleHistory), false)
assert.equal(shouldAnnounce('hp-loss', 2200, 1200, throttleHistory), true)

// responsive viewport + portrait gate pause ownership
const viewportPolicy = {
  logicalWidth: 800,
  logicalHeight: 480,
  minimumLandscapeWidth: 667,
  minimumLandscapeHeight: 375,
}
assert.deepEqual(calculateResponsiveViewport({ width: 800, height: 480 }, viewportPolicy), {
  presentation: 'landscape-supported',
  shouldBlockInput: false,
  scale: 1,
  canvasWidth: 800,
  canvasHeight: 480,
  offsetX: 0,
  offsetY: 0,
})
assert.deepEqual(calculateResponsiveViewport({ width: 667, height: 375 }, viewportPolicy), {
  presentation: 'landscape-supported',
  shouldBlockInput: false,
  scale: 0.78125,
  canvasWidth: 625,
  canvasHeight: 375,
  offsetX: 21,
  offsetY: 0,
})
assert.equal(
  calculateResponsiveViewport({ width: 390, height: 844 }, viewportPolicy).presentation,
  'portrait-gate',
)
assert.equal(
  calculateResponsiveViewport({ width: 390, height: 844 }, viewportPolicy).shouldBlockInput,
  true,
)
assert.equal(
  calculateResponsiveViewport({ width: 600, height: 320 }, viewportPolicy).presentation,
  'landscape-compact',
)

const gateFromRunning = resolveOrientationGate(createOrientationGateState(), true, 'running')
assert.deepEqual(gateFromRunning, {
  state: { active: true, ownsGameplayPause: true },
  effect: 'pause-gameplay',
})
assert.deepEqual(resolveOrientationGate(gateFromRunning.state, false, 'paused'), {
  state: { active: false, ownsGameplayPause: false },
  effect: 'resume-gameplay',
})
const gateFromPaused = resolveOrientationGate(createOrientationGateState(), true, 'paused')
assert.deepEqual(gateFromPaused, {
  state: { active: true, ownsGameplayPause: false },
  effect: 'none',
})
assert.deepEqual(resolveOrientationGate(gateFromPaused.state, false, 'paused'), {
  state: { active: false, ownsGameplayPause: false },
  effect: 'none',
})
assert.deepEqual(resolveOrientationGate(createOrientationGateState(), true, 'inactive'), {
  state: { active: true, ownsGameplayPause: false },
  effect: 'none',
})
assert.deepEqual(resolveOrientationGate(gateFromPaused.state, true, 'running'), {
  state: { active: true, ownsGameplayPause: true },
  effect: 'pause-gameplay',
})

// towerEconomyRules
assert.equal(refundForTowerEconomy({ cost: 40, level: 1, upgradeCost: 25, investedCost: 150 }, 0.6), 90)
assert.equal(refundForTowerEconomy({ cost: 40, level: 2, upgradeCost: 25 }, 0.5), 32)

// terrainPlacementRules
assert.deepEqual(
  snapToTerrainCell(0, 0),
  { column: 0, row: 0, x: 16, y: 16 },
  'the first terrain square is centered at 16,16',
)
assert.deepEqual(
  snapToTerrainCell(799.99, 479.99),
  { column: 24, row: 14, x: 784, y: 464 },
  'the final in-bounds point snaps to the final 32px square',
)
assert.deepEqual(snapToTerrainCell(47.99, 47.99), { column: 1, row: 1, x: 48, y: 48 })
assert.deepEqual(snapToTerrainCell(48, 48), { column: 1, row: 1, x: 48, y: 48 })
const encodedTerrainCell = terrainCellId(snapToTerrainCell(208, 272))
assert.equal(encodedTerrainCell, 'terrain:6:8')
assert.deepEqual(parseTerrainCellId(encodedTerrainCell), {
  column: 6,
  row: 8,
  x: 208,
  y: 272,
})
assert.equal(parseTerrainCellId('terrain:25:0'), null)
assert.equal(parseTerrainCellId('shop:arrow'), null)

const terrainRequest = {
  x: 208,
  y: 272,
  towerType: 'arrow',
  towerCost: 50,
  coins: 100,
  maxTowers: 6,
  placed: [],
  onboardingVisible: false,
}
const clearGrass = evaluateTerrainPlacement(terrainRequest)
assert.equal(clearGrass.valid, true)
assert.equal(clearGrass.reason, null)
assert.equal(clearGrass.requiredSpacingCells, 2)
assert.equal(clearGrass.shortfall, 0)
for (const [x, y] of [[-0.01, 100], [800, 100], [100, -1], [100, 480], [Number.NaN, 50]]) {
  assert.equal(
    evaluateTerrainPlacement({ ...terrainRequest, x, y }).reason,
    'bounds',
    `out-of-world point ${x},${y} is rejected before snapped-cell blockers`,
  )
}
assert.equal(evaluateTerrainPlacement({ ...terrainRequest, x: 400, y: 16 }).reason, 'reserved-ui')
assert.equal(evaluateTerrainPlacement({ ...terrainRequest, x: 80, y: 208 }).reason, 'path')
assert.equal(evaluateTerrainPlacement({ ...terrainRequest, x: 48, y: 368 }).reason, 'scenery')
assert.equal(
  evaluateTerrainPlacement({ ...terrainRequest, x: 400, y: 160, onboardingVisible: true }).reason,
  'reserved-ui',
  'the onboarding panel blocks its covered grass while visible',
)
assert.equal(
  evaluateTerrainPlacement({ ...terrainRequest, x: 400, y: 160, onboardingVisible: false }).valid,
  true,
  'the dynamic onboarding blocker disappears with its panel',
)

for (const blocker of TERRAIN_BLOCKERS) {
  const cell =
    blocker.kind === 'rectangle'
      ? {
          column: 0,
          row: 0,
          x: (blocker.left + blocker.right) / 2,
          y: (blocker.top + blocker.bottom) / 2,
        }
      : { column: 0, row: 0, x: blocker.x, y: blocker.y }
  assert.equal(
    blocker.kind === 'rectangle'
      ? cellOverlapsRectangle(cell, blocker)
      : cellOverlapsCircle(cell, blocker),
    true,
    `${blocker.id} intersects a square covering its center`,
  )
}
assert.equal(
  cellOverlapsRectangle(
    { column: 0, row: 0, x: 84, y: 50 },
    { kind: 'rectangle', id: 'tangent', reason: 'scenery', left: 100, top: 0, right: 120, bottom: 100 },
  ),
  false,
  'exact rectangle tangency remains buildable',
)
assert.equal(
  cellOverlapsCircle(
    { column: 0, row: 0, x: 50, y: 50 },
    { x: 76, y: 50, radius: 10 },
  ),
  false,
  'exact circle tangency remains buildable',
)
const straightPath = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
assert.equal(pointOverlapsPath({ x: 50, y: 37.999 }, straightPath, 38), true)
assert.equal(pointOverlapsPath({ x: 50, y: 38 }, straightPath, 38), false)
assert.equal(pointOverlapsPath({ x: 138, y: 0 }, straightPath, 38), false, 'endpoint tangency is valid')

const anchor = { id: 'existing', type: 'arrow', column: 6, row: 8, x: 208, y: 272 }
assert.equal(
  evaluateTerrainPlacement({ ...terrainRequest, placed: [anchor] }).reason,
  'occupied',
  'occupied takes precedence over spacing, cap, and funds',
)
assert.equal(
  evaluateTerrainPlacement({ ...terrainRequest, x: 240, y: 272, placed: [anchor] }).reason,
  'spacing',
  'arrow towers reject an adjacent square',
)
assert.equal(
  evaluateTerrainPlacement({ ...terrainRequest, x: 240, y: 240, placed: [anchor] }).reason,
  'spacing',
  'diagonals count toward Chebyshev spacing',
)
assert.equal(
  evaluateTerrainPlacement({ ...terrainRequest, x: 272, y: 272, placed: [anchor] }).valid,
  true,
  'arrow towers accept a center delta of two cells',
)
const bombAnchor = { ...anchor, id: 'bomb', type: 'bomb' }
assert.equal(
  evaluateTerrainPlacement({ ...terrainRequest, x: 272, y: 272, placed: [bombAnchor] }).reason,
  'spacing',
  'an arrow built after a mortar uses the mortar spacing',
)
assert.equal(
  evaluateTerrainPlacement({
    ...terrainRequest,
    x: 272,
    y: 272,
    towerType: 'bomb',
    placed: [anchor],
  }).reason,
  'spacing',
  'a mortar built after an arrow uses the mortar spacing',
)
const distantArrowAnchor = { ...anchor, column: 9, x: 304 }
const distantBombAnchor = { ...bombAnchor, column: 9, x: 304 }
for (const [towerType, placed] of [['arrow', [distantBombAnchor]], ['bomb', [distantArrowAnchor]]]) {
  assert.equal(
    evaluateTerrainPlacement({ ...terrainRequest, towerType, placed }).valid,
    true,
    `mixed ${towerType} placement accepts a three-cell center delta`,
  )
}
assert.equal(chebyshevCellDistance(anchor, { column: 8, row: 10 }), 2)

const remoteAnchors = Array.from({ length: 6 }, (_, index) => ({
  id: `remote-${index}`,
  type: 'arrow',
  column: 24,
  row: 0,
  x: 784,
  y: 16,
}))
assert.equal(
  evaluateTerrainPlacement({
    ...terrainRequest,
    coins: 0,
    placed: remoteAnchors,
  }).reason,
  'tower-limit',
  'the cap has deterministic precedence over affordability',
)
const fundsEvaluation = evaluateTerrainPlacement({ ...terrainRequest, coins: 17 })
assert.equal(fundsEvaluation.reason, 'insufficient-funds')
assert.equal(fundsEvaluation.shortfall, 33)
assert.equal(placementReasonMessage('insufficient-funds', 33), 'Need 33 more ryo to build this tower.')

// focusNavigationRules
const invalidButFocusable = createTerrainFocusTarget(snapToTerrainCell(80, 208))
assert.deepEqual(invalidButFocusable, { id: 'terrain:2:6', region: 'terrain', enabled: true })
assert.deepEqual(
  moveTerrainFocus(snapToTerrainCell(16, 16), -1, -1),
  snapToTerrainCell(16, 16),
  'terrain keyboard movement clamps safely at the first square',
)
assert.deepEqual(moveTerrainFocus(snapToTerrainCell(208, 272), 1, -1), snapToTerrainCell(240, 240))
const focusTargets = [
  { id: 'shop:arrow', region: 'shop', enabled: true },
  { id: 'shop:frost', region: 'shop', enabled: false },
  invalidButFocusable,
  { id: 'tower:one', region: 'towers', enabled: true },
  { id: 'action:upgrade', region: 'actions', enabled: true },
  { id: 'pause', region: 'pause', enabled: true },
]
assert.equal(cycleFocusTarget(focusTargets, 'shop:arrow', 1)?.id, invalidButFocusable.id)
assert.equal(cycleFocusTarget(focusTargets, 'shop:arrow', -1)?.id, 'pause')
assert.equal(cycleFocusInRegion(focusTargets, 'shop', 'shop:arrow', 1)?.id, 'shop:arrow')
assert.equal(reconcileFocusTarget(focusTargets, 'tower:removed', 'towers')?.id, 'tower:one')
assert.equal(reconcileFocusTarget(focusTargets, 'tower:one')?.id, 'tower:one')

// effectPolicyRules
for (const effect of ['particles', 'projectile-trail', 'firing-pulse', 'tween', 'flash', 'halo', 'camera-shake']) {
  assert.equal(isEffectAllowed(effect, true), false, `${effect} is suppressed immediately`)
  assert.equal(isEffectAllowed(effect, false), true)
}
for (const effect of ['static-warning', 'placement-validity', 'range-indicator', 'hp-change', 'announcement', 'result-content']) {
  assert.equal(isEffectAllowed(effect, true), true, `${effect} survives Reduced Effects`)
}
assert.equal(shouldSampleProjectileTrail(50, 0, 0, false), true)
assert.equal(shouldSampleProjectileTrail(PROJECTILE_TRAIL_SAMPLE_MS - 1, 0, 0, false), false)
assert.equal(shouldSampleProjectileTrail(100, 0, MAX_ACTIVE_PROJECTILE_TRAILS, false), false)
assert.equal(shouldSampleProjectileTrail(100, null, 0, true), false)
assert.equal(clampPlacementSparkCount(10, false), 6)
assert.equal(clampPlacementSparkCount(4.9, false), 4)
assert.equal(clampPlacementSparkCount(4, true), 0)

console.log('audio settings, terrain placement, focus, effect policy, tower defense, wave, run result, persistence, economy, onboarding, HUD, and run state rules passed')

/**
 * Scene registry — the single place where scenes are registered.
 * `main.ts` (DO NOT EDIT) consumes this list, so adding a scene never
 * requires touching the boot file: import it and append it to SCENES.
 */
import Phaser from 'phaser'
import BootScene from './BootScene'
import GameScene from './GameScene'
import UIScene from './UIScene'

export const SCENES: Phaser.Types.Scenes.SceneType[] = [BootScene, GameScene, UIScene]

/**
 * Scene started when the platform sends `rabbit:restart`.
 * Point it at the menu scene once the game has one.
 */
export const RESTART_SCENE_KEY = 'GameScene'

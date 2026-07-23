/**
 * Scene registry — the single place where scenes are registered.
 * `main.ts` (DO NOT EDIT) consumes this list, so adding a scene never
 * requires touching the boot file: import it and append it to SCENES.
 */
import Phaser from 'phaser'
import BootScene from './BootScene'
import MainMenuScene from './MainMenuScene'
import GameScene from './GameScene'
import UIScene from './UIScene'

export const SCENES: Phaser.Types.Scenes.SceneType[] = [BootScene, MainMenuScene, GameScene, UIScene]

/**
 * Scene started when the platform sends `rabbit:restart`.
 * Main menu is the canonical clean entry point.
 */
export const RESTART_SCENE_KEY = 'MainMenuScene'

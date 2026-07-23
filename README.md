# Rabbit Defense

A pixel-art medieval forest tower defense template for Rabbit Game Lab, built from the Rabbit 2D base template with Phaser 3, Vite, and TypeScript.

## Game loop

- Drag towers from the shop onto golden build circles.
- Stop monsters from reaching the rabbit keep.
- Earn coins from defeated enemies.
- Tap an already-selected tower to upgrade it when you have enough coins.
- Survive all 5 fixed waves to win.

## Towers

- **Arrow Tower** — fast single-target shots.
- **Frost Mage** — low damage, slows monsters.
- **Bombard** — slow splash damage.

## Enemies

- **Goblin** — baseline grunt.
- **Imp Runner** — fast but weak.
- **Ogre** — slow tank with more health.

## Commands

```bash
npm install
npm run dev
npm run test:rules
npm run check
npm run build
```

## Rabbit template notes

- Gameplay tuning lives in `src/game.config.ts`.
- Tower/enemy/wave data lives in `src/data/towerDefense.ts`.
- Core pure rules are in `src/systems/towerDefenseRules.ts` and covered by `npm run test:rules`.
- Rabbit platform wiring remains in `src/main.ts` and `src/rabbit/sdk.ts`.

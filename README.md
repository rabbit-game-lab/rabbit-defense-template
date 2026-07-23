# Hidden Dojo Defense

A pixel-art ninja tower-defense template for Rabbit Game Lab, built from the Rabbit 2D base template with Phaser 3, Vite, and TypeScript.

## Game loop

- Drag ninja defenses from the shop onto glowing build seals.
- Stop rival clans from reaching Hidden Dojo.
- Earn ryo from defeated raiders.
- Select a placed defense to upgrade or sell it.
- Survive all 10 fixed raids and defeat the Crimson Bear Shogun.

## Defenses

- **Shuriken Tower** — fast single-target shuriken.
- **Ice Shrine** — low damage, slows raiders.
- **Fire Mortar** — slow splash damage.

## Raiders

- **Scout Mouse** — baseline scout.
- **Rogue Raccoon** — fast but weak.
- **Iron Panda** — slow tank with more health.
- **Crimson Bear Shogun** — final boss that resists new slows.

## Commands

```bash
npm install
npm run dev
npm run test:rules
npm run check
npm run build
```

## Asset license

The runtime art is a curated derivative subset of the CC0 **Ninja Adventure Asset Pack** by Pixel-Boy and AAA. Source, hash, derivative details, and the original license are preserved in [`public/assets/ninja/README.md`](public/assets/ninja/README.md).

## Rabbit template notes

- Gameplay tuning lives in `src/game.config.ts`.
- Defense, raider, and raid data lives in `src/data/towerDefense.ts`.
- Core pure rules are in `src/systems/towerDefenseRules.ts` and covered by `npm run test:rules`.
- Stable source IDs such as `arrow` and `warden` remain unchanged for rules/save compatibility.
- Rabbit platform wiring remains in `src/main.ts` and `src/rabbit/sdk.ts`.

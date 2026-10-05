# Private npm SDK

This template pins `@rabbit-game-lab/sdk` at exactly `1.0.0`. The package supplies shared runtime modules, engine adapters and the `rabbit-check` executable. No SDK source is copied into the template.

## Install

Use Node 24 and an npm account with read access to the private package:

```sh
npm login --scope=@rabbit-game-lab --registry=https://registry.npmjs.org
npm ci
npm run check
npm run build
```

CI reads `secrets.NPM_TOKEN` only for the install step through `NODE_AUTH_TOKEN`. Use a token restricted to reading this package. Do not commit credentials.

## Imports

```ts
import * as sdk from '@rabbit-game-lab/sdk'
import { createKeyboard } from '@rabbit-game-lab/sdk/common/keyboard'
import { defineAssets } from '@rabbit-game-lab/sdk/phaser-2d/assets'
```

The package's `docs/`, `sdk/` and `dist/` contain API documentation, readable sources and type declarations. Never edit installed files.

## Upgrade or roll back

Install the reviewed exact version, then commit both manifests:

```sh
npm install --save-exact @rabbit-game-lab/sdk@1.0.0
npx rabbit-kit sync-docs   # SDK releases after 1.0.1: refresh docs/sdk-reference/
npm exec -- rabbit-kit status --check
npm run check
npm run build
```

Replace `1.0.0` with the target version for an upgrade or rollback. Run the template's tests and canonical iframe harness before review. `npm ci` verifies tarball integrity; `rabbit-check` requires an exact dependency and matching lockfile/installed version. Existing Studio projects retain their immutable template version.

## Rollout prerequisites

Before merging or importing this migration, Rabbit API's Contract Gate must accept package-based SDK layouts. CI, standalone Vercel preview/build installs, the template worker's Vercel Sandbox and Studio cold boots from Starter Files need private read access during installation. A Railway environment variable alone does not pass credentials into Sandbox. Keep credentials out of source archives, Starter Files, logs, agent environments and snapshots. Verify a fresh cold boot before publication.

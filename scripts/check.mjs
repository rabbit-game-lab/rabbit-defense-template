#!/usr/bin/env node
/**
 * rabbit-check (local template copy).
 * The same validation runs locally, in CI and in the import Contract Gate:
 *   1. Contract layout (required files + valid rabbit.json).
 *   2. tsc --noEmit.
 *   3. Forbidden API lint in src/ (except src/rabbit/).
 *   4. File size limit (≤400 lines in src/).
 *   5. No tracked build artifacts (dist/).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const failures = []

// --- 1. Layout ---
const requiredFiles = [
  'rabbit.json',
  'AGENTS.md',
  'index.html',
  'package.json',
  'src/main.ts',
  'src/game.config.ts',
  'src/rabbit/sdk.ts',
  'src/scenes/index.ts',
]
for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`layout: missing ${file}`)
}

try {
  const manifest = JSON.parse(readFileSync(join(root, 'rabbit.json'), 'utf8'))
  if (manifest.contract !== 1) failures.push('rabbit.json: "contract" must be 1')
  if (typeof manifest.stack !== 'string' || manifest.stack.length === 0) {
    failures.push('rabbit.json: missing "stack"')
  }
  if (typeof manifest.embed !== 'object' || manifest.embed === null) {
    failures.push('rabbit.json: missing "embed"')
  }
} catch (error) {
  failures.push(`rabbit.json: invalid (${error.message})`)
}

// --- 2. tsc --noEmit ---
const tsc = spawnSync('npx', ['tsc', '--noEmit'], {
  stdio: 'inherit',
  cwd: root,
  shell: process.platform === 'win32',
})
if (tsc.status !== 0) failures.push('tsc --noEmit failed (see errors above)')

// --- 3 & 4. Forbidden API lint + file size limit ---
const FORBIDDEN = [
  { pattern: /window\.top\b/, reason: 'window.top is forbidden inside the iframe' },
  { pattern: /\blocalStorage\b/, reason: 'use sdk.storage instead of localStorage' },
  { pattern: /\bsessionStorage\b/, reason: 'use sdk.storage instead of sessionStorage' },
  { pattern: /requestFullscreen/, reason: 'fullscreen is not declared in rabbit.json.embed' },
  { pattern: /requestPointerLock/, reason: 'pointerLock is not declared in rabbit.json.embed' },
  { pattern: /\bcreateScript\s*\(/, reason: 'Editor v1 style is forbidden: use ESM classes (extends Script)' },
]
const MAX_LINES = 400

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, files)
    else if (/\.(ts|mts|js|mjs)$/.test(entry)) files.push(full)
  }
  return files
}

const srcDir = join(root, 'src')
if (existsSync(srcDir)) {
  for (const file of walk(srcDir)) {
    const rel = relative(root, file).replaceAll('\\', '/')
    const content = readFileSync(file, 'utf8')
    const lineCount = content.split('\n').length

    if (lineCount > MAX_LINES) {
      failures.push(`size: ${rel} has ${lineCount} lines (max ${MAX_LINES}) — split it`)
    }
    if (rel.startsWith('src/rabbit/')) continue // the SDK implements the wrappers
    for (const { pattern, reason } of FORBIDDEN) {
      if (pattern.test(content)) failures.push(`forbidden api in ${rel}: ${reason}`)
    }
  }
}

// --- 5. No dist/ ---
if (existsSync(join(root, 'dist'))) {
  const gitignore = existsSync(join(root, '.gitignore'))
    ? readFileSync(join(root, '.gitignore'), 'utf8')
    : ''
  if (!/^dist\/?$/m.test(gitignore)) failures.push('dist/ exists and is not in .gitignore')
}

// --- Report ---
if (failures.length > 0) {
  console.error('\n✖ rabbit-check failed:\n')
  for (const failure of failures) console.error(`  ✖ ${failure}`)
  console.error('')
  process.exit(1)
}
console.log('✔ rabbit-check OK (layout, tsc, APIs, sizes)')

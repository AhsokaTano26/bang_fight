import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const check = process.argv.includes('--check')
const execFile = promisify(execFileCallback)
const manifest = JSON.parse(await readFile(path.join(root, 'data/cards-v1.9.json'), 'utf8'))
const sourceRoot = path.join(root, manifest.sourceDirectory)
const publicRoot = path.join(root, 'frontend/public', manifest.assetBase)
const encoding = 'webp-lossless-z9-max2400-thumb384x536-q82-m6-sharpyuv'
const previousCode = await readFile(path.join(root, 'frontend/src/types/card-catalog.generated.ts'), 'utf8').catch(() => '')
const previousJson = previousCode.match(/export const CARD_CATALOG: CatalogEntry\[\] = ([\s\S]*?)\n\nconst byId/)
const previous = new Map((previousJson ? JSON.parse(previousJson[1]) : []).map(card => [card.sourceFile, card]))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const seenIds = new Set()
const seenFiles = new Set()
const entries = new Array(manifest.entries.length)

async function syncFile(destination, contents) {
  if (check) {
    const existing = await readFile(destination).catch(() => null)
    if (!existing || !existing.equals(Buffer.from(contents))) {
      throw new Error(`Out of sync: ${path.relative(root, destination)}. Run node scripts/sync-card-pack.mjs`)
    }
  } else {
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, contents)
  }
}

for (const entry of manifest.entries) {
  for (const id of [entry.id, ...(entry.legacyIds ?? [])]) {
    if (seenIds.has(id)) throw new Error(`Duplicate card ID or alias: ${id}`)
    seenIds.add(id)
  }
  if (seenFiles.has(entry.sourceFile)) throw new Error(`Duplicate source: ${entry.sourceFile}`)
  if (entry.sourceFile.includes('..') || path.isAbsolute(entry.sourceFile)) throw new Error('Invalid source path')
  seenFiles.add(entry.sourceFile)
}

async function convert(entry, index) {
  const source = path.join(sourceRoot, entry.sourceFile)
  const bytes = await readFile(source)
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid PNG: ${entry.sourceFile}`)
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  const scale = Math.min(1, 2400 / Math.max(width, height))
  const fullWidth = Math.round(width * scale)
  const fullHeight = Math.round(height * scale)
  const file = entry.sourceFile.replace(/\.png$/, '.webp')
  const thumbnail = `thumbs/${file}`
  const thumbScale = Math.min(1, 384 / width, 536 / height)
  const thumbnailWidth = Math.round(width * thumbScale)
  const thumbnailHeight = Math.round(height * thumbScale)
  const cached = previous.get(entry.sourceFile)
  let full, thumb
  if (cached?.sha256 === hash(bytes) && cached.imageSha256 &&
      (cached.imageEncoding ?? encoding) === encoding &&
      cached.width === fullWidth && cached.height === fullHeight &&
      cached.thumbnailWidth === thumbnailWidth && cached.thumbnailHeight === thumbnailHeight) {
    const [existingFull, existingThumb] = await Promise.all([
      readFile(path.join(publicRoot, file)).catch(() => null),
      readFile(path.join(publicRoot, thumbnail)).catch(() => null),
    ])
    if (existingFull && existingThumb && hash(existingFull) === cached.imageSha256 && hash(existingThumb) === cached.thumbnailSha256) {
      full = existingFull
      thumb = existingThumb
    }
  }
  if ((!full || !thumb) && check) throw new Error(`Missing or changed WebP asset: ${file}. Run node scripts/sync-card-pack.mjs`)
  if (!full || !thumb) {
  const fullArgs = ['-quiet', '-lossless', '-z', '9']
  if (scale < 1) fullArgs.push('-resize', String(fullWidth), String(fullHeight))
  full = (await execFile('cwebp', [...fullArgs, source, '-o', '-'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 })).stdout
  // Small cards load in hands and lists; lossless originals load only for inspection.
  thumb = (await execFile('cwebp', ['-quiet', '-q', '82', '-m', '6', '-sharp_yuv', '-resize', String(thumbnailWidth), String(thumbnailHeight), source, '-o', '-'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 })).stdout
  }
  await syncFile(path.join(publicRoot, file), full)
  await syncFile(path.join(publicRoot, thumbnail), thumb)
  if (!check) await unlink(path.join(publicRoot, entry.sourceFile)).catch(error => { if (error.code !== 'ENOENT') throw error })
  entries[index] = {
    ...entry,
    imageFile: `${manifest.assetBase}/${file}`,
    thumbnailFile: `${manifest.assetBase}/${thumbnail}`,
    sha256: hash(bytes),
    imageSha256: hash(full),
    thumbnailSha256: hash(thumb),
    width: fullWidth,
    height: fullHeight,
    thumbnailWidth,
    thumbnailHeight,
    imageBytes: full.length,
    thumbnailBytes: thumb.length,
    imageEncoding: encoding,
  }
}

let next = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < manifest.entries.length) {
    const index = next++
    await convert(manifest.entries[index], index)
  }
}))

const sourceFiles = (await readdir(sourceRoot, { recursive: true })).filter(file => file.endsWith('.png'))
if (sourceFiles.length !== entries.length || sourceFiles.some(file => !seenFiles.has(file))) {
  throw new Error('The catalog must include every PNG in the resource pack exactly once')
}

const types = `// Generated by scripts/sync-card-pack.mjs from data/cards-v1.9.json. Do not edit.
export interface CatalogSkill {
  name: string
  description: string
  consumeActionPoint: boolean
}

export interface CatalogEntry {
  id: string
  name: string
  category: 'character' | 'action' | 'strategy' | 'auxiliary' | 'marker' | 'board'
  sourceFile: string
  imageFile: string
  thumbnailFile: string
  sha256: string
  imageSha256: string
  thumbnailSha256: string
  width: number
  height: number
  thumbnailWidth: number
  thumbnailHeight: number
  imageBytes: number
  thumbnailBytes: number
  imageEncoding: string
  description?: string
  legacyIds?: string[]
  faction?: string
  maxHp?: number
  attack?: number
  keywords?: string[]
  skills?: CatalogSkill[]
  strategyType?: 'deployable' | 'instant'
  attribute?: string
  actionType?: 'attack' | 'armorPierce' | 'bigBlock' | 'smallBlock' | 'recovery' | 'bigRecovery' | 'replenish'
  requiresTarget?: boolean
  affectsAll?: boolean
  armorPierce?: boolean
}

export const CARD_PACK_VERSION = ${JSON.stringify(manifest.version)}
export const CARD_FACTIONS: { id: string; name: string; color: string }[] = ${JSON.stringify(manifest.factions, null, 2)}

export const CARD_CATALOG: CatalogEntry[] = ${JSON.stringify(entries, null, 2)}

const byId = new Map<string, CatalogEntry>()
for (const card of CARD_CATALOG) {
  byId.set(card.id, card)
  for (const alias of card.legacyIds ?? []) byId.set(alias, card)
}

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return byId.get(id)
}

/** Update presentation and printed stats while preserving the existing effect handlers and runtime IDs. */
export function withCardMetadata<T extends { id: string; name: string }>(card: T): T {
  const face = getCatalogEntry(card.id)
  if (!face) throw new Error('Missing V1.9 face for ' + card.id)
  const metadata: Record<string, unknown> = { name: face.name, thumbnailFile: face.thumbnailFile }
  for (const key of ['imageFile', 'description', 'maxHp', 'attack'] as const) {
    if (key in card && face[key] !== undefined) metadata[key] = face[key]
  }
  return { ...card, ...metadata }
}
`

for (const file of ['frontend/src/types/card-catalog.generated.ts', 'backend/src/game/card-catalog.generated.ts']) {
  await syncFile(path.join(root, file), types)
}

// The entry page can load its art and band names without the full catalog index.
const showcaseIds = ['AG1001', 'AG1003', 'ROS1001', 'HHW1001', 'AG1004']
const showcase = showcaseIds.map(id => {
  const card = entries.find(entry => entry.id === id)
  return { id: card.id, name: card.name, imageFile: card.thumbnailFile, width: card.thumbnailWidth, height: card.thumbnailHeight }
})
await syncFile(path.join(root, 'frontend/src/types/card-pack-summary.generated.ts'), `// Generated by scripts/sync-card-pack.mjs. Do not edit.
export const CARD_PACK_VERSION = ${JSON.stringify(manifest.version)}
export const CARD_FACTIONS = ${JSON.stringify(manifest.factions, null, 2)}
export const CARD_SHOWCASE = ${JSON.stringify(showcase, null, 2)}
`)

const counts = Object.fromEntries([...new Set(entries.map(card => card.category))].map(category => [category, entries.filter(card => card.category === category).length]))
console.log(`${check ? 'Verified' : 'Synced'} ${entries.length} V1.9 assets and both catalogs: ${JSON.stringify(counts)}`)
console.log(`WebP originals: ${(entries.reduce((sum, card) => sum + card.imageBytes, 0) / 1048576).toFixed(2)} MiB; thumbnails: ${(entries.reduce((sum, card) => sum + card.thumbnailBytes, 0) / 1048576).toFixed(2)} MiB`)

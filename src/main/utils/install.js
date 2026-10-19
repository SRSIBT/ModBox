import fs from 'fs'
import path from 'path'
import os from 'os'
import unzipper from 'unzipper'

// ============================================================
// 最简安装器：install.json -> 复制文件 -> .bak 备份 -> manifest.json
//
// 不做的部分（刻意保持简单）：
//   - 不校验哈希、不做冲突归属判断、不做事务回滚
//   - 目标已存在就生成同目录的 xxx.bak，然后直接覆盖
//   - 卸载只认 manifest.json，不会重新跑 placements
// ============================================================

const RULES_FILE = 'install.json'
const MANIFEST_FILE = 'manifest.json'
const BAK_SUFFIX = '.bak'

const stripControlChars = (value) =>
  [...String(value)].filter((ch) => ch.charCodeAt(0) >= 32).join('')

// 游戏 id 校验：和 routes/mod.js、routes/game.js 保持一致
const isValidGameId = (id) => {
  if (typeof id !== 'string') return false
  if (!id || id !== id.trim()) return false
  if (id === '.' || id === '..') return false
  if (/[\\/]/.test(id)) return false
  if (/[<>:"|?*]/.test(id)) return false
  if (stripControlChars(id) !== id) return false
  if (/[. ]$/.test(id)) return false
  return path.basename(id) === id
}

// 判断 target 是否在 root 里面（包含 root 本身）
const isInside = (root, target) => {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

const toPosix = (value) => value.split(path.sep).join('/')

const readJson = (file, fallback = null) => {
  if (!fs.existsSync(file)) return fallback
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (e) {
    throw new Error(`${path.basename(file)} 解析失败：${e.message}`)
  }
}

const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

const readGame = (repoDir, gameId) => {
  const gameFile = path.join(repoDir, gameId, 'game.json')
  if (!fs.existsSync(gameFile)) throw new Error('游戏不存在')

  const game = readJson(gameFile)
  if (!game?.rootPath) throw new Error('这个游戏还没有设置根目录')
  if (!fs.existsSync(game.rootPath)) throw new Error(`游戏根目录不存在：${game.rootPath}`)

  return { game, gameRoot: path.resolve(game.rootPath) }
}

const readRules = (repoDir, gameId) => {
  const rulesFile = path.join(repoDir, gameId, RULES_FILE)
  if (!fs.existsSync(rulesFile)) {
    throw new Error(`缺少规则文件：${path.relative(repoDir, rulesFile)}`)
  }

  const rules = readJson(rulesFile)
  const placements = rules?.placements || rules?.install?.placements
  if (!Array.isArray(placements) || placements.length === 0) {
    throw new Error('install.json 里没有 placements')
  }

  return { rules, placements }
}

const manifestFile = (repoDir, gameId) => path.join(repoDir, gameId, MANIFEST_FILE)

export const getManifest = (repoDir, gameId) => readJson(manifestFile(repoDir, gameId), {})

// 把 game.json 里的 installed 和磁盘上的 manifest 对齐。
// 这里只改 installed，不碰其它字段，避免把前端正在编辑的数据冲掉。
const setInstalled = (repoDir, gameId, modPath, installed) => {
  const file = path.join(repoDir, gameId, 'game.json')
  try {
    const game = JSON.parse(fs.readFileSync(file, 'utf-8'))
    const mod = (game.mods || []).find((m) => m.path === modPath)
    if (!mod || mod.installed === installed) return
    mod.installed = installed
    fs.writeFileSync(file, JSON.stringify(game, null, 2))
  } catch (e) {
    console.warn(`[install] 更新 game.json 安装状态失败：${e.message}`)
  }
}

// ============================================================
// 规则匹配
// ============================================================

const escapeRegExp = (value) => value.replace(/[|\\{}()[\]^$+?.-]/g, '\\$&')

// 把 * / ** / ? 转成正则；只支持这一小撮就够用了
const globToRegExp = (glob) => {
  let source = '^'

  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]

    if (ch === '*') {
      if (glob[i + 1] === '*') {
        i++
        if (glob[i + 1] === '/') {
          i++
          source += '(?:.*/)?'
        } else {
          source += '.*'
        }
      } else {
        source += '[^/]*'
      }
    } else if (ch === '?') {
      source += '[^/]'
    } else {
      source += escapeRegExp(ch)
    }
  }

  return new RegExp(source + '$', 'i')
}

// 不含 / 的规则（b1、Scripts、*.pak）匹配任意层级的文件名；
// 含 / 的规则（b1/Content/Paks/*.pak）匹配完整相对路径。
const matchPath = (pattern, relPath) => {
  const glob = String(pattern || '').replace(/\\/g, '/').replace(/^\.?\//, '')
  if (!glob) return false

  if (glob.includes('/')) return globToRegExp(glob).test(relPath)

  const name = relPath.split('/').pop()
  return globToRegExp(glob).test(name)
}

const expandTokens = (value, gameRoot, roots, depth = 0) => {
  if (depth > 8) throw new Error('install.json 的 roots 存在循环引用')

  return String(value).replace(/\{(\w+)\}/g, (match, key) => {
    if (key === 'game_root' || key === 'gameRoot' || key === 'root') return gameRoot
    if (roots && Object.prototype.hasOwnProperty.call(roots, key)) {
      return expandTokens(roots[key], gameRoot, roots, depth + 1)
    }
    throw new Error(`install.json 里有未知占位符 {${key}}`)
  })
}

const resolveInto = (rule, gameRoot, roots) => {
  if (!rule?.into) throw new Error(`规则 ${rule?.id || rule?.match || '?'} 缺少 into`)

  const expanded = expandTokens(rule.into, gameRoot, roots)
  const target = path.isAbsolute(expanded)
    ? path.resolve(expanded)
    : path.resolve(gameRoot, expanded)

  if (!isInside(gameRoot, target)) {
    throw new Error(`规则 ${rule?.id || rule?.match || '?'} 的 into 越出了游戏根目录`)
  }
  return target
}

const walkEntries = (root) => {
  const result = []

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      const rel = toPosix(path.relative(root, full))

      if (entry.isDirectory()) {
        result.push({ rel, isDir: true })
        walk(full)
      } else if (entry.isFile()) {
        result.push({ rel, isDir: false })
      }
    }
  }

  walk(root)
  result.sort((a, b) => a.rel.localeCompare(b.rel))
  return result
}

const depthOf = (rel) => rel.split('/').length

const safeTitle = (value) => {
  const name = stripControlChars(String(value || 'mod'))
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/, '')
    .trim()
  return name || 'mod'
}

/**
 * 根据 placements 生成安装计划。
 * 纯函数，不写磁盘，方便单独测。
 */
export const buildPlan = ({ root, placements, gameRoot, title, roots = {} }) => {
  const entries = walkEntries(root)
  const files = entries.filter((entry) => !entry.isDir).map((entry) => entry.rel)
  const claimed = new Set()
  const usedDest = new Map()
  const operations = []
  const warnings = []
  const caseInsensitive = process.platform === 'win32'

  for (const rule of placements) {
    if (!rule || rule.enabled === false) continue

    const mode = rule.mode === 'files' ? 'files' : 'folder'
    const into = resolveInto(rule, gameRoot, roots)
    const candidates = entries
      .filter((entry) => {
        if (mode === 'folder' && !entry.isDir) return false
        if (mode === 'files' && entry.isDir) return false
        return matchPath(rule.match, entry.rel)
      })
      .sort((a, b) => depthOf(a.rel) - depthOf(b.rel) || a.rel.localeCompare(b.rel))

    for (const candidate of candidates) {
      const parts = candidate.rel.split('/')
      const lift = Math.max(0, Number(rule.lift) || 0)
      const sourceRel = lift
        ? parts.slice(0, Math.max(0, parts.length - lift)).join('/')
        : candidate.rel
      const sourceAbs = sourceRel ? path.join(root, ...sourceRel.split('/')) : root

      if (mode === 'folder') {
        if (!fs.existsSync(sourceAbs) || !fs.statSync(sourceAbs).isDirectory()) continue

        const under = sourceRel
          ? files.filter((file) => file === sourceRel || file.startsWith(`${sourceRel}/`))
          : files

        // 整棵树已经被前面的规则投放过，直接跳过
        if (under.length > 0 && under.every((file) => claimed.has(file))) continue

        const destBase = path.join(
          into,
          sourceRel ? path.basename(sourceAbs) : safeTitle(title)
        )

        let added = 0
        for (const rel of under) {
          if (claimed.has(rel)) continue

          const inside = sourceRel ? rel.slice(sourceRel.length + 1) : rel
          if (!inside) continue

          const src = path.join(root, ...rel.split('/'))
          const dst = path.join(destBase, ...inside.split('/'))

          if (!isInside(gameRoot, dst)) throw new Error(`目标路径越界：${dst}`)

          const key = caseInsensitive ? dst.toLowerCase() : dst
          if (usedDest.has(key)) {
            throw new Error(`两个文件被投放到同一位置：${dst}（${usedDest.get(key)} 与 ${rel}）`)
          }
          usedDest.set(key, rel)

          operations.push({ src, dst, source: rel, rule: rule.id || rule.match })
          added++
        }

        // 整个目录都算被处理，后面的 Scripts / *.pak 不再重复投放
        for (const rel of under) claimed.add(rel)
        if (added === 0) warnings.push(`规则 ${rule.id || rule.match} 命中 ${candidate.rel}，但没有新文件`)
      } else {
        if (claimed.has(candidate.rel)) continue

        const src = path.join(root, ...parts)
        const dst = path.join(into, path.basename(candidate.rel))

        if (!isInside(gameRoot, dst)) throw new Error(`目标路径越界：${dst}`)

        const key = caseInsensitive ? dst.toLowerCase() : dst
        if (usedDest.has(key)) {
          throw new Error(`两个文件被投放到同一位置：${dst}（${usedDest.get(key)} 与 ${candidate.rel}）`)
        }
        usedDest.set(key, candidate.rel)

        operations.push({ src, dst, source: candidate.rel, rule: rule.id || rule.match })
        claimed.add(candidate.rel)
      }
    }
  }

  return {
    operations,
    unmatched: files.filter((file) => !claimed.has(file)),
    warnings
  }
}

// ============================================================
// 解压 / 路径
// ============================================================

const extractZip = (zipPath, dest) =>
  new Promise((resolve, reject) => {
    const extract = unzipper.Extract({ path: dest })
    const input = fs.createReadStream(zipPath)

    input.on('error', reject)
    extract.on('error', reject)
    extract.on('close', resolve)
    input.pipe(extract)
  })

const prepareSource = async (repoDir, gameId, modPath) => {
  const modsRoot = path.join(repoDir, gameId, 'mods')
  const source = path.resolve(modsRoot, modPath)

  if (!isInside(modsRoot, source) || source === modsRoot) {
    throw new Error('非法的 Mod 路径')
  }
  if (!fs.existsSync(source)) throw new Error('Mod 文件不存在')

  const stat = fs.statSync(source)
  if (stat.isDirectory()) {
    return { root: source, temp: null, title: path.basename(source) }
  }

  const ext = path.extname(source).toLowerCase()
  if (ext !== '.zip') {
    throw new Error(`目前只支持文件夹和 .zip，暂不支持 ${ext || '这个格式'}`)
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'modbox-zip-'))
  try {
    await extractZip(source, temp)
  } catch (e) {
    fs.rmSync(temp, { recursive: true, force: true })
    throw new Error(`解压失败：${e.message}`)
  }

  return { root: temp, temp, title: path.basename(source, ext) }
}

const gameRelative = (gameRoot, target) => toPosix(path.relative(gameRoot, target))

const gameAbsolute = (gameRoot, rel) => {
  const target = path.resolve(gameRoot, rel)
  if (!isInside(gameRoot, target)) throw new Error(`manifest 里的路径越界：${rel}`)
  return target
}

const pruneEmptyDirs = (dirs, gameRoot) => {
  const sorted = [...new Set(dirs)].sort((a, b) => b.length - a.length)

  for (const dir of sorted) {
    let current = dir
    while (current !== gameRoot && isInside(gameRoot, current)) {
      try {
        if (fs.readdirSync(current).length > 0) break
        fs.rmdirSync(current)
      } catch {
        break
      }
      current = path.dirname(current)
    }
  }
}

// ============================================================
// 安装 / 卸载
// ============================================================

/**
 * 安装一个 Mod。
 * 已安装过的话会先卸载，再按当前规则重装。
 */
export async function installMod({ repoDir, gameId, modPath, onProgress }) {
  if (!isValidGameId(gameId)) throw new Error('无效的游戏 id')
  if (typeof modPath !== 'string' || !modPath) throw new Error('无效的 Mod 路径')

  const { gameRoot } = readGame(repoDir, gameId)
  const { rules, placements } = readRules(repoDir, gameId)

  const manifestPath = manifestFile(repoDir, gameId)
  const manifest = readJson(manifestPath, {})

  // 同一个 Mod 重装：先按旧 manifest 清干净，避免旧文件残留
  if (manifest[modPath]) {
    await uninstallMod({ repoDir, gameId, modPath })
    Object.assign(manifest, readJson(manifestPath, {}))
  }

  const source = await prepareSource(repoDir, gameId, modPath)

  try {
    const plan = buildPlan({
      root: source.root,
      placements,
      gameRoot,
      title: source.title,
      roots: rules.roots || {}
    })

    if (plan.operations.length === 0) {
      const sample = plan.unmatched.slice(0, 5).join('、')
      throw new Error(
        `没有任何文件匹配 placements${sample ? `，未匹配示例：${sample}` : ''}`
      )
    }

    const files = []
    const backups = []

    try {
      for (const operation of plan.operations) {
        fs.mkdirSync(path.dirname(operation.dst), { recursive: true })

        if (fs.existsSync(operation.dst)) {
          if (!fs.statSync(operation.dst).isFile()) {
            throw new Error(`目标已存在且不是文件：${operation.dst}`)
          }

          const backup = operation.dst + BAK_SUFFIX
          fs.copyFileSync(operation.dst, backup)
          backups.push({
            target: gameRelative(gameRoot, operation.dst),
            backup: gameRelative(gameRoot, backup)
          })
        }

        fs.copyFileSync(operation.src, operation.dst)
        files.push(gameRelative(gameRoot, operation.dst))

        if (onProgress) {
          onProgress({
            done: files.length,
            total: plan.operations.length,
            file: gameRelative(gameRoot, operation.dst)
          })
        }
      }
    } catch (e) {
      // 只把已经复制的文件写进 manifest，保证失败后还能点卸载清掉
      if (files.length > 0 || backups.length > 0) {
        manifest[modPath] = {
          modPath,
          installedAt: new Date().toISOString(),
          partial: true,
          error: e.message,
          files,
          backups
        }
        writeJson(manifestPath, manifest)
        setInstalled(repoDir, gameId, modPath, false)
      }
      throw e
    }

    manifest[modPath] = {
      modPath,
      installedAt: new Date().toISOString(),
      files,
      backups
    }
    writeJson(manifestPath, manifest)
    setInstalled(repoDir, gameId, modPath, true)

    return {
      files,
      backups,
      unmatched: plan.unmatched,
      warnings: plan.warnings
    }
  } finally {
    if (source.temp) fs.rmSync(source.temp, { recursive: true, force: true })
  }
}

/**
 * 卸载一个 Mod：删 manifest 里记录的文件，再还原对应的 .bak。
 */
export async function uninstallMod({ repoDir, gameId, modPath }) {
  if (!isValidGameId(gameId)) throw new Error('无效的游戏 id')
  if (typeof modPath !== 'string' || !modPath) throw new Error('无效的 Mod 路径')

  const { gameRoot } = readGame(repoDir, gameId)
  const manifestPath = manifestFile(repoDir, gameId)
  const manifest = readJson(manifestPath, {})
  const entry = manifest[modPath]

  // 旧版本只存了 installed 布尔值，没有 manifest：这里只把状态复位，不猜文件
  if (!entry) {
    setInstalled(repoDir, gameId, modPath, false)
    return { removed: 0, restored: 0, warning: '没有安装记录，只重置了安装状态' }
  }

  const dirs = new Set()
  let removed = 0

  // 先删 Mod 放进去的文件
  for (const rel of entry.files || []) {
    const target = gameAbsolute(gameRoot, rel)
    if (!fs.existsSync(target)) continue
    if (fs.statSync(target).isFile()) {
      fs.rmSync(target, { force: true })
      removed++
    }
    dirs.add(path.dirname(target))
  }

  // 再把安装前备份的 .bak 还原回去
  let restored = 0
  for (const item of entry.backups || []) {
    const backup = gameAbsolute(gameRoot, item.backup)
    const target = gameAbsolute(gameRoot, item.target)

    if (!fs.existsSync(backup)) continue

    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(backup, target)
    fs.rmSync(backup, { force: true })
    dirs.add(path.dirname(target))
    restored++
  }

  pruneEmptyDirs(dirs, gameRoot)

  delete manifest[modPath]
  writeJson(manifestPath, manifest)
  setInstalled(repoDir, gameId, modPath, false)

  return { removed, restored }
}

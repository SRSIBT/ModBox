import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import unzipper from 'unzipper'
import { saveGameMods } from './mod.js'
import { getGame } from './game.js'
import { isInside, readJson, writeJson } from './file.js'

// ============================================================
// 最简安装器：builtinGames.js 的 installRules -> 复制文件 -> .bak 备份 -> manifest.json
//
// 不做的部分（刻意保持简单）：
//   - 不校验哈希、不做冲突归属判断、不做事务回滚
//   - 目标已存在就生成同目录的 xxx.bak，然后直接覆盖
//   - 卸载只认 manifest.json，不会重新跑 placements
// ============================================================

const MANIFEST_FILE = 'manifest.json'
const BAK_SUFFIX = '.bak'

const stripControlChars = (value) =>
  [...String(value)].filter((ch) => ch.charCodeAt(0) >= 32).join('')

const toPosix = (value) => value.split(path.sep).join('/')

const readGame = (repoDir, gameId) => {
  const game = getGame(gameId, { repoDir })
  if (!game) throw new Error('游戏不存在')

  if (!game.rootPath) throw new Error('这个游戏还没有设置根目录')
  if (!fs.existsSync(game.rootPath)) throw new Error(`游戏根目录不存在：${game.rootPath}`)

  return { game, gameRoot: path.resolve(game.rootPath) }
}

// Windows 下游戏没完全退出时，文件会被锁住，删不掉也覆盖不了。
// 这里按游戏根目录找进程，找到就直接拒绝操作，避免卸载到一半。
const findGameProcesses = (gameRoot, exePath = '') =>
  new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([])

    const script = `
$ErrorActionPreference = 'Stop'
$root = $env:MODBOX_GAME_ROOT
$exe = if ($env:MODBOX_GAME_EXE) { [IO.Path]::GetFileNameWithoutExtension($env:MODBOX_GAME_EXE) } else { '' }
try {
  $items = Get-CimInstance Win32_Process |
    Where-Object {
      ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) -or
      ($exe -and $_.Name -ieq "$exe.exe")
    }
} catch {
  $items = @()
  if ($exe) {
    $items = Get-Process -Name $exe -ErrorAction SilentlyContinue |
      ForEach-Object { [pscustomobject]@{ Name = "$($_.ProcessName).exe"; ProcessId = $_.Id; ExecutablePath = $_.Path } }
  }
}
$items | Select-Object Name, ProcessId, ExecutablePath | ConvertTo-Json -Compress
`

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      {
        env: { ...process.env, MODBOX_GAME_ROOT: gameRoot, MODBOX_GAME_EXE: exePath || '' },
        windowsHide: true,
        timeout: 5000
      },
      (error, stdout) => {
        if (error || !stdout.trim()) return resolve([])
        try {
          const data = JSON.parse(stdout)
          resolve(Array.isArray(data) ? data : [data])
        } catch {
          resolve([])
        }
      }
    )
  })

const ensureGameClosed = async (gameRoot, exePath = '') => {
  const processes = await findGameProcesses(gameRoot, exePath)
  if (!processes.length) return

  const names = [...new Set(processes.map((item) => item.Name).filter(Boolean))]
  throw new Error(
    `游戏还在运行：${names.join('、') || '未知进程'}。请彻底退出游戏（包括启动器）后再操作。`
  )
}

const readRules = (repoDir, gameId) => {
  // 安装规则完全由 builtinGames.js 接管
  const game = getGame(gameId, { repoDir })
  const rules = game?.installRules

  if (!Array.isArray(rules?.placements) || rules.placements.length === 0) {
    throw new Error('这个游戏还没有配置安装规则')
  }

  return { rules, placements: rules.placements }
}

const manifestFile = (repoDir, gameId) => path.join(repoDir, gameId, MANIFEST_FILE)

// 新版 manifest：mods 记录每个 Mod 的文件，backups 全局记录被覆盖的原文件
const emptyManifest = () => ({ mods: {}, backups: {} })

const normalizeManifest = (raw) => {
  const result = emptyManifest()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result

  if (raw.mods || raw.backups) {
    result.mods = raw.mods && typeof raw.mods === 'object' ? raw.mods : {}
    result.backups = raw.backups && typeof raw.backups === 'object' ? raw.backups : {}
    return result
  }

  // 兼容旧版扁平 manifest，并把每个 Mod 自己的 .bak 合并到全局备份区
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue
    const entry = { ...value }
    delete entry.backups
    result.mods[key] = entry

    for (const item of value.backups || []) {
      if (!item?.target || !item?.backup) continue
      const backup = result.backups[item.target]
      if (backup) {
        if (!backup.owners.includes(key)) backup.owners.push(key)
      } else {
        result.backups[item.target] = { backup: item.backup, owners: [key] }
      }
    }
  }

  return result
}

const readManifest = (repoDir, gameId) =>
  normalizeManifest(readJson(manifestFile(repoDir, gameId), {}))

const writeManifest = (repoDir, gameId, manifest) =>
  writeJson(manifestFile(repoDir, gameId), manifest)

export const getManifest = (repoDir, gameId) => readManifest(repoDir, gameId)

// 把 mods.json 里的 installed 和磁盘上的 manifest 对齐。
// 这里只改 installed，不碰其它字段，避免把前端正在编辑的数据冲掉。
const setInstalled = (repoDir, gameId, modPath, installed) => {
  try {
    const game = getGame(gameId, { repoDir })
    const mods = game?.mods || []
    const mod = mods.find((m) => m.path === modPath)
    if (!mod || mod.installed === installed) return

    mod.installed = installed
    saveGameMods(gameId, mods, { repoDir })
  } catch (e) {
    console.warn(`[install] 更新安装状态失败：${e.message}`)
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
  const glob = String(pattern || '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
  if (!glob) return false

  // ^ 前缀：去掉 ^，用完整 relPath 精确匹配（只匹配顶层）
  if (glob.startsWith('^')) {
    return globToRegExp(glob.slice(1)).test(relPath)
  }

  if (glob.includes('/')) return globToRegExp(glob).test(relPath)

  const name = relPath.split('/').pop()
  return globToRegExp(glob).test(name)
}

const expandTokens = (value, gameRoot, roots, depth = 0) => {
  if (depth > 8) throw new Error('内置安装规则的 roots 存在循环引用')

  return String(value).replace(/\{(\w+)\}/g, (match, key) => {
    if (key === 'game_root' || key === 'gameRoot' || key === 'root') return gameRoot
    if (roots && Object.prototype.hasOwnProperty.call(roots, key)) {
      return expandTokens(roots[key], gameRoot, roots, depth + 1)
    }
    throw new Error(`内置安装规则里有未知占位符 {${key}}`)
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

        const destBase = path.join(into, sourceRel ? path.basename(sourceAbs) : safeTitle(title))

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
        if (added === 0)
          warnings.push(`规则 ${rule.id || rule.match} 命中 ${candidate.rel}，但没有新文件`)
      } else {
        if (claimed.has(candidate.rel)) continue

        const src = path.join(root, ...parts)
        const dst = path.join(into, path.basename(candidate.rel))

        if (!isInside(gameRoot, dst)) throw new Error(`目标路径越界：${dst}`)

        const key = caseInsensitive ? dst.toLowerCase() : dst
        if (usedDest.has(key)) {
          throw new Error(
            `两个文件被投放到同一位置：${dst}（${usedDest.get(key)} 与 ${candidate.rel}）`
          )
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

// 只删 manifest 里 createdDirs 记录的目录，从深到浅，空的才删。
// 不往上爬，避免删掉游戏本来就有、只是刚好为空的目录。
const removeCreatedDirs = (dirs) => {
  const sorted = [...new Set(dirs)].sort((a, b) => b.length - a.length)

  for (const dir of sorted) {
    try {
      if (fs.readdirSync(dir).length > 0) continue
      fs.rmdirSync(dir)
    } catch {
      /* 已经没了或没权限 */
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
  if (typeof modPath !== 'string' || !modPath) throw new Error('无效的 Mod 路径')

  const { game, gameRoot } = readGame(repoDir, gameId)
  await ensureGameClosed(gameRoot, game.exePath)
  const { rules, placements } = readRules(repoDir, gameId)

  let manifest = readManifest(repoDir, gameId)

  // 同一个 Mod 重装：先按旧 manifest 清干净，避免旧文件残留
  if (manifest.mods[modPath]) {
    await uninstallMod({ repoDir, gameId, modPath })
    manifest = readManifest(repoDir, gameId)
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
      throw new Error(`没有任何文件匹配 placements${sample ? `，未匹配示例：${sample}` : ''}`)
    }

    const files = []
    const createdDirs = new Set()
    let backupAdded = false

    try {
      for (const operation of plan.operations) {
        const missingDirs = []
        let parent = path.dirname(operation.dst)
        while (parent !== gameRoot && isInside(gameRoot, parent) && !fs.existsSync(parent)) {
          missingDirs.push(parent)
          parent = path.dirname(parent)
        }

        fs.mkdirSync(path.dirname(operation.dst), { recursive: true })
        for (const dir of missingDirs) createdDirs.add(gameRelative(gameRoot, dir))

        const rel = gameRelative(gameRoot, operation.dst)

        if (fs.existsSync(operation.dst)) {
          if (!fs.statSync(operation.dst).isFile()) {
            throw new Error(`目标已存在且不是文件：${operation.dst}`)
          }

          const existing = manifest.backups[rel]
          if (existing) {
            if (!existing.owners.includes(modPath)) existing.owners.push(modPath)
          } else {
            const backup = operation.dst + BAK_SUFFIX
            fs.copyFileSync(operation.dst, backup)
            manifest.backups[rel] = {
              backup: gameRelative(gameRoot, backup),
              owners: [modPath]
            }
            backupAdded = true
          }
        }

        fs.copyFileSync(operation.src, operation.dst)
        files.push(rel)

        if (onProgress) {
          onProgress({
            done: files.length,
            total: plan.operations.length,
            file: rel
          })
        }
      }
    } catch (e) {
      // 失败也保留已经做过的操作，之后还能按记录卸载
      if (files.length > 0 || backupAdded) {
        manifest.mods[modPath] = {
          modPath,
          installedAt: new Date().toISOString(),
          partial: true,
          error: e.message,
          files,
          createdDirs: [...createdDirs]
        }
        writeManifest(repoDir, gameId, manifest)
        setInstalled(repoDir, gameId, modPath, false)
      }
      throw e
    }

    manifest.mods[modPath] = {
      modPath,
      installedAt: new Date().toISOString(),
      files,
      createdDirs: [...createdDirs]
    }
    writeManifest(repoDir, gameId, manifest)
    setInstalled(repoDir, gameId, modPath, true)

    return {
      files,
      createdDirs: [...createdDirs],
      unmatched: plan.unmatched,
      warnings: plan.warnings
    }
  } finally {
    if (source.temp) fs.rmSync(source.temp, { recursive: true, force: true })
  }
}

const exclusiveDirsOf = (rules, gameRoot) => {
  const roots = rules.roots || {}
  return (rules.exclusiveDirs || []).map((entry) => {
    const expanded = expandTokens(entry, gameRoot, roots)
    const dir = path.isAbsolute(expanded)
      ? path.resolve(expanded)
      : path.resolve(gameRoot, expanded)
    if (!isInside(gameRoot, dir)) throw new Error(`独占目录越界：${dir}`)
    return dir
  })
}

// 独占目录里可能还有运行时日志/崩溃转储。安装文件删完后，
// 只删剩余文件，不在这里删目录。
const clearExclusiveDir = (dir, failures) => {
  const walk = (current) => {
    let items
    try {
      items = fs.readdirSync(current, { withFileTypes: true })
    } catch (e) {
      failures.push(`${current}（${e.code || e.message}）`)
      return
    }

    for (const item of items) {
      const full = path.join(current, item.name)
      if (item.isDirectory()) {
        walk(full)
        continue
      }

      try {
        fs.rmSync(full, { force: true })
      } catch (e) {
        failures.push(`${full}（${e.code || e.message}）`)
      }
    }
  }

  walk(dir)
}

// 没有 manifest 的旧安装：按源包和安装规则反推位置。
// 只处理规则里声明为独占的目录，直接删掉。
const cleanupBySource = async ({ repoDir, gameId, modPath, gameRoot, manifest }) => {
  let source
  try {
    source = await prepareSource(repoDir, gameId, modPath)
    const { rules, placements } = readRules(repoDir, gameId)
    const plan = buildPlan({
      root: source.root,
      placements,
      gameRoot,
      title: source.title,
      roots: rules.roots || {}
    })

    const exclusive = exclusiveDirsOf(rules, gameRoot)
    const touched = exclusive.filter((dir) =>
      plan.operations.some((operation) => isInside(dir, operation.dst))
    )

    let removed = 0
    let restored = 0
    let failed = 0

    for (const dir of touched) {
      if (!fs.existsSync(dir)) continue
      try {
        fs.rmSync(dir, { recursive: true, force: true })
        removed++
        // 目录已经删了，目录里的全局备份记录也一起清掉
        for (const rel of Object.keys(manifest?.backups || {})) {
          if (isInside(dir, gameAbsolute(gameRoot, rel))) delete manifest.backups[rel]
        }
      } catch {
        failed++
      }
    }

    for (const operation of plan.operations) {
      if (touched.some((dir) => isInside(dir, operation.dst))) continue

      const backup = operation.dst + BAK_SUFFIX
      if (!fs.existsSync(backup)) continue

      try {
        fs.mkdirSync(path.dirname(operation.dst), { recursive: true })
        fs.copyFileSync(backup, operation.dst)
        fs.rmSync(backup, { force: true })
        restored++
      } catch {
        failed++
      }
    }

    return {
      removed,
      restored,
      warning:
        `没有安装记录，已按安装规则清理 ${removed} 个独占目录、还原 ${restored} 个备份` +
        (failed ? `，${failed} 项失败` : '') +
        (touched.length === 0 ? '；该游戏没有声明独占目录，未删除任何普通文件' : '')
    }
  } catch (e) {
    return { removed: 0, restored: 0, warning: `没有安装记录，无法按规则清理：${e.message}` }
  } finally {
    if (source?.temp) fs.rmSync(source.temp, { recursive: true, force: true })
  }
}

/**
 * 卸载一个 Mod：删 manifest 里记录的文件，再还原对应的 .bak。
 */
export async function uninstallMod({ repoDir, gameId, modPath, skipProcessCheck = false }) {
  if (typeof modPath !== 'string' || !modPath) throw new Error('无效的 Mod 路径')

  const { game, gameRoot } = readGame(repoDir, gameId)
  if (!skipProcessCheck) await ensureGameClosed(gameRoot, game.exePath)
  const manifest = readManifest(repoDir, gameId)
  const entry = manifest.mods[modPath]

  // 旧版本没有 manifest：按源包和规则反推，只清理声明的独占目录
  if (!entry) {
    const result = await cleanupBySource({ repoDir, gameId, modPath, gameRoot, manifest })
    writeManifest(repoDir, gameId, manifest)
    setInstalled(repoDir, gameId, modPath, false)
    return { removed: result.removed, restored: result.restored, warning: result.warning }
  }

  const dirs = new Set((entry.createdDirs || []).map((rel) => gameAbsolute(gameRoot, rel)))
  const failed = []
  let removed = 0
  let restored = 0

  for (const rel of entry.files || []) {
    const target = gameAbsolute(gameRoot, rel)
    const backup = manifest.backups[rel]

    if (backup) {
      const owners = Array.isArray(backup.owners) ? backup.owners : []
      const others = owners.filter((owner) => owner !== modPath)

      // 还有别的 Mod 依赖这次覆盖，文件保留，只把当前 Mod 从 owners 移除
      if (others.length > 0) {
        backup.owners = others
        continue
      }

      const backupPath = gameAbsolute(gameRoot, backup.backup)
      if (!fs.existsSync(backupPath)) {
        failed.push(`${rel}（原备份不存在）`)
        continue
      }

      try {
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.copyFileSync(backupPath, target)
        fs.rmSync(backupPath, { force: true })
        delete manifest.backups[rel]
        restored++
      } catch (e) {
        failed.push(`${rel}（${e.code || e.message}）`)
      }
      continue
    }

    // 没有全局备份，说明这个文件是安装时新建的
    if (!fs.existsSync(target)) continue
    try {
      if (fs.statSync(target).isFile()) {
        fs.chmodSync(target, 0o666)   // ← 加这行，去只读
        fs.rmSync(target, { force: true, maxRetries: 2, retryDelay: 200 })
        removed++
      }
    } catch (e) {
      failed.push(`${rel}（${e.code || e.message}）`)
    }
  }

  if (failed.length) {
    throw new Error(`卸载没有完成，文件可能还被游戏占用：${failed.slice(0, 5).join('、')}`)
  }

  // 按 manifest 处理完后，独占目录里可能还剩运行时产物。
  // 只处理本 Mod 实际碰过的 exclusiveDirs，普通目录一律不扫。
  const exclusiveFailures = []
  try {
    const { rules } = readRules(repoDir, gameId)
    const touchedFiles = [...(entry.files || []), ...(entry.createdDirs || [])]
    const touchedDirs = exclusiveDirsOf(rules, gameRoot).filter((dir) =>
      touchedFiles.some((rel) => isInside(dir, gameAbsolute(gameRoot, rel)))
    )

    for (const dir of touchedDirs) {
      if (!fs.existsSync(dir)) continue

      // 独占目录被别的 Mod 共用时，不能把别人还依赖的文件一起扫掉
      const shared = Object.entries(manifest.backups).some(
        ([rel, item]) =>
          isInside(dir, gameAbsolute(gameRoot, rel)) && (item.owners || []).length > 0
      )
      if (shared) continue

      clearExclusiveDir(dir, exclusiveFailures)
      for (const rel of Object.keys(manifest.backups)) {
        if (isInside(dir, gameAbsolute(gameRoot, rel))) delete manifest.backups[rel]
      }
    }
  } catch (e) {
    exclusiveFailures.push(e.message)
  }

  removeCreatedDirs(dirs)

  delete manifest.mods[modPath]
  writeManifest(repoDir, gameId, manifest)
  setInstalled(repoDir, gameId, modPath, false)

  return { removed, restored, failed: exclusiveFailures }
}

// 一键清理：卸载当前游戏的全部 Mod，再扫一遍独占目录里剩下的运行时文件
export async function cleanupGameMods({ repoDir, gameId }) {
  const { game, gameRoot } = readGame(repoDir, gameId)
  await ensureGameClosed(gameRoot, game.exePath)

  const manifest = readManifest(repoDir, gameId)
  const modPaths = [
    ...new Set([...(game.mods || []).map((mod) => mod.path), ...Object.keys(manifest.mods)])
  ].filter(Boolean)

  const failed = []
  const createdDirs = new Set(
    Object.values(manifest.mods).flatMap((item) =>
      (item.createdDirs || []).map((rel) => gameAbsolute(gameRoot, rel))
    )
  )
  let removed = 0
  let restored = 0

  for (const modPath of modPaths) {
    try {
      const result = await uninstallMod({
        repoDir,
        gameId,
        modPath,
        skipProcessCheck: true
      })
      removed += result.removed || 0
      restored += result.restored || 0
      if (result.failed?.length) failed.push(...result.failed)
    } catch (e) {
      failed.push(`${modPath}：${e.message}`)
    }
  }

  // 有些残留不属于任何 manifest 条目，最后只清独占目录里的文件
  try {
    const { rules } = readRules(repoDir, gameId)
    const current = readManifest(repoDir, gameId)
    for (const dir of exclusiveDirsOf(rules, gameRoot)) {
      if (!fs.existsSync(dir)) continue
      const shared = Object.entries(current.backups).some(
        ([rel, item]) =>
          isInside(dir, gameAbsolute(gameRoot, rel)) && (item.owners || []).length > 0
      )
      if (shared) continue

      clearExclusiveDir(dir, failed)
      for (const rel of Object.keys(current.backups)) {
        if (isInside(dir, gameAbsolute(gameRoot, rel))) delete current.backups[rel]
      }
    }
    writeManifest(repoDir, gameId, current)
  } catch (e) {
    failed.push(e.message)
  }

  // 按 installRules.cleanup.actions 执行目录级/文件级清理
  try {
    const { rules } = readRules(repoDir, gameId)
    const actions = rules?.cleanup?.actions || []
    for (const action of actions) {
      if (action.op === 'purge') {
        const dir = path.join(gameRoot, action.dir)
        if (fs.existsSync(dir)) purgeDir(dir, action, failed)
      } else if (action.op === 'unlink') {
        for (const file of action.files || []) {
          const full = path.join(gameRoot, file)
          if (fs.existsSync(full)) {
            try { fs.unlinkSync(full) } catch (e) { failed.push(`${file}：${e.message}`) }
          }
        }
      }
    }
  } catch (e) {
    failed.push(`cleanup.actions：${e.message}`)
  }

  removeCreatedDirs(createdDirs)
  return { removed, restored, failed }
}


function purgeDir(dir, action, failed) {
  const keepFiles = action.keepFiles || []
  const keepDirs = action.keepDirs || []
  const match = (name, patterns) =>
    patterns.some((p) => {
      const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i')
      return re.test(name)
    })
  const walk = (current) => {
    let entries
    try { entries = fs.readdirSync(current, { withFileTypes: true }) } catch (e) {
      failed.push(`${current}：${e.message}`); return
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (match(entry.name, keepDirs)) continue
        walk(full)
        try { if (fs.readdirSync(full).length === 0) fs.rmdirSync(full) } catch { }
      } else {
        if (match(entry.name, keepFiles)) continue
        try {
          fs.chmodSync(full, 0o666)
          fs.unlinkSync(full)
        } catch (e) {
          failed.push(`${full}：${e.message}`)
        }
      }
    }
  }
  walk(dir)

  try {
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
  } catch { }
}
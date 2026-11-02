import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { spawn } from 'child_process'
import { DATA_DIR } from '../stores/paths.js'

// ============================================================
// aria2c 进程 + JSON-RPC 客户端
// ============================================================
// 单连接在国内链路上常常只有几十 KB/s（高延迟 + 丢包把小窗口打满），
// aria2 用多条独立 TCP 连接 + geom 切片能成倍叠加。参数参照 mayflyMods 的做法。
//
// aria2c.exe 按下面顺序找，找不到就由调用方退回内置下载器：
//   1. 打包后：resources/aria2/aria2c.exe
//   2. 开发时：<项目根>/resources/aria2/aria2c.exe
//   3. 用户可以自己丢：data/bin/aria2c.exe

const BIN_DIR = path.join(DATA_DIR, 'bin')

export const aria2Candidates = () => [
  // 打包后由 extraResources 放到 resources/aria2
  path.join(process.resourcesPath || '', 'aria2', 'aria2c.exe'),
  // 开发时读源码资源目录
  path.join(app.getAppPath(), 'src', 'main', 'resources', 'aria2', 'aria2c.exe'),
  // 用户也可以自己放到 data/bin
  path.join(BIN_DIR, 'aria2c.exe')
]

export const aria2Path = () => aria2Candidates().find((p) => fs.existsSync(p)) || ''

let missingWarned = false

let proc = null
let rpcPort = 0
let rpcSecret = ''
let starting = null

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const rpc = async (method, params = []) => {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method,
    params: [`token:${rpcSecret}`, ...params]
  })

  const res = await fetch(`http://127.0.0.1:${rpcPort}/jsonrpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal: AbortSignal.timeout(8000)
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'aria2 RPC 调用失败')
  return data.result
}

const waitForRpc = async (deadline) => {
  while (Date.now() < deadline) {
    try {
      await rpc('aria2.getVersion')
      return true
    } catch {
      await sleep(150)
    }
  }
  return false
}

export const isRunning = () => Boolean(proc && !proc.killed)

export const ensureAria2 = async () => {
  if (isRunning()) return true
  if (starting) return starting

  const exe = aria2Path()
  if (!exe) {
    if (!missingWarned) {
      missingWarned = true
      console.warn('[aria2] 没找到 aria2c.exe，试过这些位置：\n  ' + aria2Candidates().join('\n  '))
    }
    return false
  }

  starting = (async () => {
    rpcPort = 16800 + Math.floor(Math.random() * 400)
    rpcSecret = crypto.randomBytes(12).toString('hex')

    proc = spawn(
      exe,
      [
        '--enable-rpc=true',
        '--rpc-listen-all=false',
        `--rpc-listen-port=${rpcPort}`,
        `--rpc-secret=${rpcSecret}`,
        '--console-log-level=warn',
        '--summary-interval=0',
        '--max-concurrent-downloads=16',
        '--disk-cache=64M',
        '--auto-file-renaming=false',
        '--allow-overwrite=false',
        '--continue=true',
        '--no-conf=true'
      ],
      { windowsHide: true, stdio: 'ignore' }
    )

    proc.on('exit', () => {
      proc = null
    })

    const ok = await waitForRpc(Date.now() + 8000)
    if (!ok) {
      stopAria2()
      console.warn('[aria2] 启动失败，退回内置下载器')
      return false
    }
    console.log(`[aria2] 已启动，监听 127.0.0.1:${rpcPort}`)
    return true
  })()

  const ok = await starting
  starting = null
  return ok
}

export const stopAria2 = () => {
  if (!proc) return
  try {
    proc.kill()
  } catch {
    /* 进程可能已经没了 */
  }
  proc = null
}

// ============================================================
// 任务操作
// ============================================================

/**
 * 新建下载。headers 是字符串数组，形如 ['Referer: https://...']。
 * @returns {Promise<string>} aria2 的 gid
 */
export const addDownload = async ({ url, dir, fileName, headers = [] }) => {
  const options = {
    dir,
    out: fileName,
    continue: 'true',
    'auto-file-renaming': 'false',
    'allow-overwrite': 'false',
    // 不预分配磁盘：大文件起速更快，也不用先占满 75MB
    'file-allocation': 'none',
    // 这两项是提速的关键：每个服务器 16 条连接，按几何切分挑片段
    'max-connection-per-server': '16',
    split: '16',
    'min-split-size': '1M',
    'stream-piece-selector': 'geom'
  }
  if (headers.length) options.header = headers
  return rpc('aria2.addUri', [[url], options])
}

export const tellStatus = (gid) =>
  rpc('aria2.tellStatus', [
    gid,
    ['status', 'totalLength', 'completedLength', 'downloadSpeed', 'errorMessage', 'files']
  ])

export const pauseDownload = (gid) => rpc('aria2.forcePause', [gid])
export const unpauseDownload = (gid) => rpc('aria2.unpause', [gid])
export const removeDownload = (gid) => rpc('aria2.forceRemove', [gid])
// 任务结束后清掉 aria2 的结果记录，否则它会一直攒着
export const removeResult = (gid) => rpc('aria2.removeDownloadResult', [gid])

import fs from 'fs'

// 清除 Windows 的「网络来源」标记（Mark of the Web）。
//
// MOTW 存在 NTFS 的备用数据流里，路径形如：
//   C:\...\mod.zip:Zone.Identifier
// 只要这个流里写了 [ZoneTransfer] ZoneId=3，资源管理器双击时就会弹
// 「无法验证发布者」的安全警告，用户还得手动点「解除锁定」。
//
// 用 fs 直接删这个流，比起一个 PowerShell 子进程跑 Unblock-File 轻得多，
// 也不受 PowerShell 执行策略影响。
//
// @returns {boolean} 是否真的删掉了一条标记（本来就没有标记时返回 false，属正常情况）
export const clearMarkOfTheWeb = (filePath) => {
  // 只有 Windows + NTFS 才有备用数据流；macOS/Linux 上是无意义的空操作
  if (process.platform !== 'win32' || !filePath) return false

  const zoneStream = `${filePath}:Zone.Identifier`

  try {
    // 大多数从 CDN 直连、由 Node 自己写盘的普通文件本来就没有这个流，
    // 先判断再删，免得每次下载都往日志里写一条无意义的记录
    if (!fs.existsSync(zoneStream)) return false
    fs.rmSync(zoneStream, { force: true })
    return true
  } catch (e) {
    // 非 NTFS 卷（FAT32/exFAT）、权限不足、文件已被移动都走这里。
    // 清不掉也不该让下载失败，记一条就够。
    console.warn('[download] 清除网络来源标记失败：', e.message)
    return false
  }
}

import fs from 'node:fs/promises'
import path from 'node:path'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { boardToMarkdown } from '../../shared/export'
import { boardToPrintHtml } from '../../shared/print'
import type { ImportResult } from '../../shared/types'
import { databasePath } from './db'
import { exportBackup, getBoardDetail, importBackup } from './repository'

function safeFileName(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim()
  return (cleaned || 'mapa').slice(0, 80)
}

export async function exportBoardMarkdown(boardId: string): Promise<string | null> {
  const detail = getBoardDetail(boardId)
  if (!detail) throw new Error('Mapa não encontrado.')

  const result = await dialog.showSaveDialog({
    title: 'Exportar mapa em Markdown',
    defaultPath: path.join(app.getPath('documents'), `${safeFileName(detail.board.title)}.md`),
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (result.canceled || !result.filePath) return null

  await fs.writeFile(result.filePath, boardToMarkdown(detail), 'utf8')
  return result.filePath
}

export async function exportBoardPdf(boardId: string): Promise<string | null> {
  const detail = getBoardDetail(boardId)
  if (!detail) throw new Error('Mapa não encontrado.')

  const result = await dialog.showSaveDialog({
    title: 'Exportar mapa em PDF',
    defaultPath: path.join(app.getPath('documents'), `${safeFileName(detail.board.title)}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (result.canceled || !result.filePath) return null

  const html = boardToPrintHtml(detail)
  const tempFile = path.join(app.getPath('temp'), `trilha-${Date.now()}.html`)
  await fs.writeFile(tempFile, html, 'utf8')

  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  })

  try {
    await win.loadFile(tempFile)
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    })
    await fs.writeFile(result.filePath, pdf)
  } finally {
    win.destroy()
    await fs.unlink(tempFile).catch(() => undefined)
  }

  return result.filePath
}

export async function exportBackupFile(): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: 'Salvar backup do Trilha',
    defaultPath: path.join(
      app.getPath('documents'),
      `trilha-backup-${new Date().toISOString().slice(0, 10)}.json`,
    ),
    filters: [{ name: 'Backup JSON', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePath) return null

  const data = exportBackup()
  await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf8')
  return result.filePath
}

export async function importBackupFile(mode: 'merge' | 'replace'): Promise<ImportResult | null> {
  const result = await dialog.showOpenDialog({
    title: mode === 'replace' ? 'Substituir tudo por um backup' : 'Mesclar backup',
    defaultPath: app.getPath('documents'),
    properties: ['openFile'],
    filters: [{ name: 'Backup JSON', extensions: ['json'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const raw = await fs.readFile(result.filePaths[0], 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('O arquivo selecionado não é um JSON válido.')
  }

  return importBackup(parsed, mode)
}

export async function openExternalUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Link inválido.')
  }
  if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
    throw new Error('Só é possível abrir links http(s) ou e-mail.')
  }
  await shell.openExternal(parsed.toString())
}

export function revealDataFolder(): string {
  const file = databasePath()
  shell.showItemInFolder(file)
  return file
}

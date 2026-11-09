import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { closeDatabase, initDatabase } from './db'
import { registerIpcHandlers } from './ipc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '../..')

const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const INDEX_HTML = path.join(RENDERER_DIST, 'index.html')

app.setName('Trilha')
if (process.platform === 'win32') app.setAppUserModelId('com.trilha.app')

if (app.isPackaged && !app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null

function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url) || /^mailto:/i.test(url)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 880,
    minWidth: 940,
    minHeight: 620,
    show: false,
    title: 'Trilha',
    backgroundColor: '#f7f4ee',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.setMenuBarVisibility(false)

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'] || process.env['VITE_DEV_SERVER_URL']
  if (!app.isPackaged && devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(INDEX_HTML)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url === mainWindow?.webContents.getURL()) return
    if (devServerUrl && url.startsWith(devServerUrl)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
    if (isExternal(url)) void shell.openExternal(url)
  })

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (app.isPackaged || input.type !== 'keyDown') return
    const key = input.key.toLowerCase()
    if (key === 'f12' || (input.control && input.shift && key === 'i')) {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})

app
  .whenReady()
  .then(() => {
    initDatabase()
    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error)
    console.error('[Trilha] Falha ao iniciar:', message)
    dialog.showErrorBox('Não foi possível abrir o Trilha', message)
    app.quit()
  })

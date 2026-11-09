import { app, ipcMain } from 'electron'
import type { BoardInput, ChecklistInput, NodeInput, NodePatch, ResourceInput } from '../../shared/types'
import {
  completeSubtree,
  createBoard,
  createChecklistItem,
  createNode,
  createResource,
  deleteBoard,
  deleteChecklistItem,
  deleteNode,
  deleteResource,
  duplicateBoard,
  getBoardDetail,
  getSettings,
  listBoards,
  moveNode,
  reorderNodes,
  setSetting,
  updateBoard,
  updateChecklistItem,
  updateNode,
  updateResource,
} from './repository'
import {
  exportBackupFile,
  exportBoardMarkdown,
  exportBoardPdf,
  importBackupFile,
  openExternalUrl,
  revealDataFolder,
} from './exporter'
import { databasePath } from './db'

export function registerIpcHandlers(): void {
  ipcMain.handle('boards:list', () => listBoards())
  ipcMain.handle('boards:get', (_event, id: string) => getBoardDetail(id))
  ipcMain.handle('boards:create', (_event, input: BoardInput) => createBoard(input))
  ipcMain.handle('boards:update', (_event, id: string, patch: Partial<BoardInput> & { archived?: boolean }) =>
    updateBoard(id, patch),
  )
  ipcMain.handle('boards:remove', (_event, id: string) => {
    deleteBoard(id)
  })
  ipcMain.handle('boards:duplicate', (_event, id: string) => duplicateBoard(id))

  ipcMain.handle('nodes:create', (_event, input: NodeInput) => createNode(input))
  ipcMain.handle('nodes:update', (_event, id: string, patch: NodePatch) => updateNode(id, patch))
  ipcMain.handle('nodes:remove', (_event, id: string) => {
    deleteNode(id)
  })
  ipcMain.handle('nodes:reorder', (_event, parentId: string | null, ids: string[]) => {
    reorderNodes(parentId, ids)
  })
  ipcMain.handle('nodes:move', (_event, id: string, parentId: string | null) => moveNode(id, parentId))
  ipcMain.handle('nodes:completeSubtree', (_event, id: string) => {
    completeSubtree(id)
  })

  ipcMain.handle('resources:create', (_event, input: ResourceInput) => createResource(input))
  ipcMain.handle('resources:update', (_event, id: string, patch: Partial<ResourceInput>) =>
    updateResource(id, patch),
  )
  ipcMain.handle('resources:remove', (_event, id: string) => {
    deleteResource(id)
  })

  ipcMain.handle('checklist:create', (_event, input: ChecklistInput) => createChecklistItem(input))
  ipcMain.handle('checklist:update', (_event, id: string, patch: Partial<ChecklistInput>) =>
    updateChecklistItem(id, patch),
  )
  ipcMain.handle('checklist:remove', (_event, id: string) => {
    deleteChecklistItem(id)
  })

  ipcMain.handle('settings:all', () => getSettings())
  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    setSetting(key, value)
  })

  ipcMain.handle('exporter:markdown', (_event, boardId: string) => exportBoardMarkdown(boardId))
  ipcMain.handle('exporter:pdf', (_event, boardId: string) => exportBoardPdf(boardId))
  ipcMain.handle('exporter:backup', () => exportBackupFile())
  ipcMain.handle('exporter:importBackup', (_event, mode: 'merge' | 'replace') =>
    importBackupFile(mode),
  )

  ipcMain.handle('app:openExternal', (_event, url: string) => openExternalUrl(url))
  ipcMain.handle('app:revealData', () => {
    revealDataFolder()
  })
  ipcMain.handle('app:dataPath', () => databasePath())
  ipcMain.handle('app:version', () => app.getVersion())
}

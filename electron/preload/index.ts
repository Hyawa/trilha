import { contextBridge, ipcRenderer } from 'electron'
import type { TrilhaApi } from '../../shared/api'
import type { BoardInput, ChecklistInput, NodeInput, NodePatch, ResourceInput } from '../../shared/types'

const api: TrilhaApi = {
  boards: {
    list: () => ipcRenderer.invoke('boards:list'),
    get: (id) => ipcRenderer.invoke('boards:get', id),
    create: (input: BoardInput) => ipcRenderer.invoke('boards:create', input),
    update: (id, patch) => ipcRenderer.invoke('boards:update', id, patch),
    remove: (id) => ipcRenderer.invoke('boards:remove', id),
    duplicate: (id) => ipcRenderer.invoke('boards:duplicate', id),
  },
  nodes: {
    create: (input: NodeInput) => ipcRenderer.invoke('nodes:create', input),
    update: (id: string, patch: NodePatch) => ipcRenderer.invoke('nodes:update', id, patch),
    remove: (id: string) => ipcRenderer.invoke('nodes:remove', id),
    reorder: (parentId: string | null, ids: string[]) => ipcRenderer.invoke('nodes:reorder', parentId, ids),
    move: (id: string, parentId: string | null) => ipcRenderer.invoke('nodes:move', id, parentId),
    completeSubtree: (id: string) => ipcRenderer.invoke('nodes:completeSubtree', id),
  },
  resources: {
    create: (input: ResourceInput) => ipcRenderer.invoke('resources:create', input),
    update: (id: string, patch: Partial<ResourceInput>) => ipcRenderer.invoke('resources:update', id, patch),
    remove: (id: string) => ipcRenderer.invoke('resources:remove', id),
  },
  checklist: {
    create: (input: ChecklistInput) => ipcRenderer.invoke('checklist:create', input),
    update: (id: string, patch: Partial<ChecklistInput>) => ipcRenderer.invoke('checklist:update', id, patch),
    remove: (id: string) => ipcRenderer.invoke('checklist:remove', id),
  },
  settings: {
    all: () => ipcRenderer.invoke('settings:all'),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  },
  exporter: {
    markdown: (boardId: string) => ipcRenderer.invoke('exporter:markdown', boardId),
    pdf: (boardId: string) => ipcRenderer.invoke('exporter:pdf', boardId),
    backup: () => ipcRenderer.invoke('exporter:backup'),
    importBackup: (mode: 'merge' | 'replace') => ipcRenderer.invoke('exporter:importBackup', mode),
  },
  app: {
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
    revealData: () => ipcRenderer.invoke('app:revealData'),
    dataPath: () => ipcRenderer.invoke('app:dataPath'),
    version: () => ipcRenderer.invoke('app:version'),
  },
}

contextBridge.exposeInMainWorld('trilha', api)

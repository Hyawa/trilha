import { create } from 'zustand'
import type {
  Board,
  BoardDetail,
  BoardInput,
  BoardSummary,
  ChecklistInput,
  NodeInput,
  NodePatch,
  ResourceInput,
  ThemePreference,
} from '@shared/types'

type View = { name: 'dashboard' } | { name: 'board'; id: string }

export function applyTheme(theme: ThemePreference): void {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', dark)
}

let detailSequence = 0

interface AppStore {
  ready: boolean
  view: View
  boards: BoardSummary[]
  detail: BoardDetail | null
  theme: ThemePreference
  version: string

  init: () => Promise<void>
  setTheme: (theme: ThemePreference) => Promise<void>

  goDashboard: () => void
  openBoard: (id: string) => Promise<void>
  refreshBoards: () => Promise<void>
  refreshDetail: () => Promise<void>

  createBoard: (input: BoardInput) => Promise<Board>
  updateBoard: (id: string, patch: Partial<BoardInput> & { archived?: boolean }) => Promise<void>
  duplicateBoard: (id: string) => Promise<Board>
  deleteBoard: (id: string) => Promise<void>

  createNode: (input: NodeInput) => Promise<void>
  updateNode: (id: string, patch: NodePatch) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  reorderNodes: (parentId: string | null, orderedIds: string[]) => Promise<void>
  moveNode: (id: string, parentId: string | null) => Promise<void>
  completeSubtree: (id: string) => Promise<void>

  addResource: (input: ResourceInput) => Promise<void>
  updateResource: (id: string, patch: Partial<ResourceInput>) => Promise<void>
  deleteResource: (id: string) => Promise<void>

  addChecklist: (input: ChecklistInput) => Promise<void>
  updateChecklist: (id: string, patch: Partial<ChecklistInput>) => Promise<void>
  deleteChecklist: (id: string) => Promise<void>
}

export const useAppStore = create<AppStore>((set, get) => {
  const sync = async () => {
    await Promise.all([get().refreshDetail(), get().refreshBoards()])
  }

  const refreshDetail = async () => {
    const view = get().view
    if (view.name !== 'board') return
    const sequence = ++detailSequence
    const detail = await window.trilha.boards.get(view.id)
    if (sequence === detailSequence) set({ detail })
  }

  return {
    ready: false,
    view: { name: 'dashboard' },
    boards: [],
    detail: null,
    theme: 'system',
    version: '',

    init: async () => {
      try {
        const [settings, boards, version] = await Promise.all([
          window.trilha.settings.all(),
          window.trilha.boards.list(),
          window.trilha.app.version(),
        ])
        const theme = (settings.theme as ThemePreference) || 'system'
        applyTheme(theme)
        set({ ready: true, boards, theme, version })

        const last = settings.lastBoard
        if (last && boards.some((board) => board.id === last && !board.archived)) {
          await get().openBoard(last)
        }
      } catch (error) {
        console.error('[Trilha] Falha ao carregar dados:', error)
        set({ ready: true })
      }
    },

    setTheme: async (theme) => {
      applyTheme(theme)
      set({ theme })
      await window.trilha.settings.set('theme', theme)
    },

    goDashboard: () => {
      detailSequence += 1
      set({ view: { name: 'dashboard' }, detail: null })
    },

    openBoard: async (id) => {
      const sequence = ++detailSequence
      set({ view: { name: 'board', id }, detail: null })
      const detail = await window.trilha.boards.get(id)
      if (sequence === detailSequence) set({ detail })
      void window.trilha.settings.set('lastBoard', id)
    },

    refreshBoards: async () => {
      const boards = await window.trilha.boards.list()
      set({ boards })
    },

    refreshDetail,

    createBoard: async (input) => {
      const board = await window.trilha.boards.create(input)
      await get().refreshBoards()
      return board
    },

    updateBoard: async (id, patch) => {
      const board = await window.trilha.boards.update(id, patch)
      set((state) => ({
        boards: state.boards.map((item) => (item.id === id ? { ...item, ...board } : item)),
        detail:
          state.detail && state.detail.board.id === id
            ? { ...state.detail, board }
            : state.detail,
      }))
      void get().refreshBoards()
    },

    duplicateBoard: async (id) => {
      const board = await window.trilha.boards.duplicate(id)
      await get().refreshBoards()
      return board
    },

    deleteBoard: async (id) => {
      await window.trilha.boards.remove(id)
      const view = get().view
      if (view.name === 'board' && view.id === id) {
        get().goDashboard()
      }
      await get().refreshBoards()
    },

    createNode: async (input) => {
      await window.trilha.nodes.create(input)
      await sync()
    },

    updateNode: async (id, patch) => {
      await window.trilha.nodes.update(id, patch)
      await sync()
    },

    deleteNode: async (id) => {
      await window.trilha.nodes.remove(id)
      await sync()
    },

    reorderNodes: async (parentId, orderedIds) => {
      await window.trilha.nodes.reorder(parentId, orderedIds)
      await sync()
    },

    moveNode: async (id, parentId) => {
      await window.trilha.nodes.move(id, parentId)
      await sync()
    },

    completeSubtree: async (id) => {
      await window.trilha.nodes.completeSubtree(id)
      await sync()
    },

    addResource: async (input) => {
      await window.trilha.resources.create(input)
      await sync()
    },

    updateResource: async (id, patch) => {
      await window.trilha.resources.update(id, patch)
      await sync()
    },

    deleteResource: async (id) => {
      await window.trilha.resources.remove(id)
      await sync()
    },

    addChecklist: async (input) => {
      await window.trilha.checklist.create(input)
      await sync()
    },

    updateChecklist: async (id, patch) => {
      await window.trilha.checklist.update(id, patch)
      await sync()
    },

    deleteChecklist: async (id) => {
      await window.trilha.checklist.remove(id)
      await sync()
    },
  }
})

export type { View }

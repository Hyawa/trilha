import type {
  BackupFile,
  Board,
  BoardDetail,
  BoardInput,
  BoardSummary,
  ChecklistInput,
  ChecklistItem,
  ImportResult,
  NodeInput,
  NodePatch,
  NodeStatus,
  Resource,
  ResourceInput,
  RoadmapNode,
} from './types'

export interface TrilhaApi {
  boards: {
    list(): Promise<BoardSummary[]>
    get(id: string): Promise<BoardDetail | null>
    create(input: BoardInput): Promise<Board>
    update(id: string, patch: Partial<BoardInput> & { archived?: boolean }): Promise<Board>
    remove(id: string): Promise<void>
    duplicate(id: string): Promise<Board>
  }
  nodes: {
    create(input: NodeInput): Promise<RoadmapNode>
    update(id: string, patch: NodePatch): Promise<RoadmapNode>
    remove(id: string): Promise<void>
    reorder(parentId: string | null, orderedIds: string[]): Promise<void>
    move(id: string, parentId: string | null): Promise<RoadmapNode>
    completeSubtree(id: string): Promise<void>
  }
  resources: {
    create(input: ResourceInput): Promise<Resource>
    update(id: string, patch: Partial<ResourceInput>): Promise<Resource>
    remove(id: string): Promise<void>
  }
  checklist: {
    create(input: ChecklistInput): Promise<ChecklistItem>
    update(id: string, patch: Partial<ChecklistInput>): Promise<ChecklistItem>
    remove(id: string): Promise<void>
  }
  settings: {
    all(): Promise<Record<string, string>>
    set(key: string, value: string): Promise<void>
  }
  exporter: {
    markdown(boardId: string): Promise<string | null>
    pdf(boardId: string): Promise<string | null>
    backup(): Promise<string | null>
    importBackup(mode: 'merge' | 'replace'): Promise<ImportResult | null>
  }
  app: {
    openExternal(url: string): Promise<void>
    revealData(): Promise<void>
    dataPath(): Promise<string>
    version(): Promise<string>
  }
}

export interface BackupData extends BackupFile {}

export const NODE_STATUSES: NodeStatus[] = ['todo', 'studying', 'review', 'done', 'skipped']

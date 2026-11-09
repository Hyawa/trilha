export type NodeStatus = 'todo' | 'studying' | 'review' | 'done' | 'skipped'
export type NodeKind = 'phase' | 'topic' | 'subtopic'
export type ResourceKind = 'link' | 'video' | 'book' | 'pdf' | 'other'
export type ThemePreference = 'light' | 'dark' | 'system'

export interface Board {
  id: string
  title: string
  description: string | null
  emoji: string
  color: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface BoardSummary extends Board {
  nodeCount: number
  doneCount: number
  totalMinutes: number
  remainingMinutes: number
  percent: number
}

export interface RoadmapNode {
  id: string
  boardId: string
  parentId: string | null
  kind: NodeKind
  position: number
  title: string
  description: string | null
  notes: string | null
  status: NodeStatus
  estimatedMinutes: number
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Resource {
  id: string
  nodeId: string
  kind: ResourceKind
  title: string
  url: string
  position: number
  createdAt: string
}

export interface ChecklistItem {
  id: string
  nodeId: string
  text: string
  done: boolean
  position: number
  createdAt: string
}

export interface BoardDetail {
  board: Board
  nodes: RoadmapNode[]
  resources: Resource[]
  checklist: ChecklistItem[]
}

export interface BoardInput {
  title: string
  description?: string | null
  emoji?: string
  color?: string
}

export interface NodeInput {
  boardId: string
  parentId: string | null
  kind: NodeKind
  title: string
  position?: number
  description?: string | null
  estimatedMinutes?: number
  status?: NodeStatus
}

export interface NodePatch {
  title?: string
  description?: string | null
  notes?: string | null
  status?: NodeStatus
  estimatedMinutes?: number
  collapsed?: boolean
}

export interface ResourceInput {
  nodeId: string
  kind: ResourceKind
  title: string
  url: string
}

export interface ChecklistInput {
  nodeId: string
  text: string
  done?: boolean
}

export interface ImportResult {
  boards: number
  nodes: number
}

export interface BackupFile {
  app: 'trilha'
  version: 1
  exportedAt: string
  boards: Board[]
  nodes: RoadmapNode[]
  resources: Resource[]
  checklist: ChecklistItem[]
}

export const STATUS_LABELS: Record<NodeStatus, string> = {
  todo: 'A fazer',
  studying: 'Estudando',
  review: 'Revisar',
  done: 'Concluído',
  skipped: 'Pulado',
}

export const RESOURCE_LABELS: Record<ResourceKind, string> = {
  link: 'Site',
  video: 'Vídeo',
  book: 'Livro',
  pdf: 'PDF',
  other: 'Outro',
}

export const BOARD_COLORS = [
  '#3f6b5b',
  '#2f6f8f',
  '#8a5a3b',
  '#7a5489',
  '#a1543f',
  '#4a6b34',
  '#8a6d27',
  '#455a72',
] as const

export const BOARD_EMOJIS = ['🧭', '🗺️', '📚', '🎯', '🧠', '🌱', '⚗️', '💻', '🎨', '🎧', '🗣️', '🧩'] as const

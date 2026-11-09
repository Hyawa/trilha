import type { BoardDetail, NodeStatus, RoadmapNode } from './types'

export interface Progress {
  total: number
  done: number
  skipped: number
  percent: number
  totalMinutes: number
  remainingMinutes: number
}

export const EMPTY_PROGRESS: Progress = {
  total: 0,
  done: 0,
  skipped: 0,
  percent: 0,
  totalMinutes: 0,
  remainingMinutes: 0,
}

export function childrenOf(nodes: RoadmapNode[], parentId: string | null): RoadmapNode[] {
  return nodes
    .filter((node) => node.parentId === parentId)
    .slice()
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
}

export function isActionable(node: RoadmapNode, nodes: RoadmapNode[]): boolean {
  if (node.kind === 'subtopic') return true
  if (node.kind === 'phase') return false
  return !nodes.some((child) => child.parentId === node.id)
}

export function actionableNodes(nodes: RoadmapNode[]): RoadmapNode[] {
  return nodes.filter((node) => isActionable(node, nodes))
}

/** Tópicos e subtópicos "folha", na ordem em que aparecem na trilha. */
export function orderedLeaves(nodes: RoadmapNode[], parentId: string | null = null): RoadmapNode[] {
  const result: RoadmapNode[] = []
  for (const node of childrenOf(nodes, parentId)) {
    if (isActionable(node, nodes)) {
      result.push(node)
    } else {
      result.push(...orderedLeaves(nodes, node.id))
    }
  }
  return result
}

export function phaseIdOf(node: RoadmapNode, nodes: RoadmapNode[]): string | null {
  if (node.kind === 'phase') return node.id
  if (node.parentId === null) return null
  const parent = nodes.find((candidate) => candidate.id === node.parentId)
  return parent ? phaseIdOf(parent, nodes) : null
}

export function summarize(nodes: RoadmapNode[], phaseId?: string | null): Progress {
  const leaves = orderedLeaves(nodes).filter(
    (leaf) => phaseId === undefined || phaseId === null || phaseIdOf(leaf, nodes) === phaseId,
  )

  let done = 0
  let skipped = 0
  let totalMinutes = 0
  let remainingMinutes = 0

  for (const leaf of leaves) {
    const minutes = Number.isFinite(leaf.estimatedMinutes) ? leaf.estimatedMinutes : 0
    if (leaf.status === 'skipped') {
      skipped += 1
      continue
    }
    totalMinutes += minutes
    if (leaf.status === 'done') {
      done += 1
    } else {
      remainingMinutes += minutes
    }
  }

  const total = leaves.length - skipped
  return {
    total,
    done,
    skipped,
    percent: percentOf(done, total),
    totalMinutes,
    remainingMinutes,
  }
}

export function percentOf(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
}

/** Próximo item pendente na ordem da trilha. */
export function nextActionable(nodes: RoadmapNode[]): RoadmapNode | null {
  for (const leaf of orderedLeaves(nodes)) {
    if (leaf.status !== 'done' && leaf.status !== 'skipped') return leaf
  }
  return null
}

export function collectDescendantIds(nodes: RoadmapNode[], id: string): string[] {
  const ids: string[] = []
  const stack = [id]
  while (stack.length > 0) {
    const current = stack.pop() as string
    for (const node of nodes) {
      if (node.parentId === current) {
        ids.push(node.id)
        stack.push(node.id)
      }
    }
  }
  return ids
}

export function countTopics(nodes: RoadmapNode[]): { topics: number; subtopics: number } {
  let topics = 0
  let subtopics = 0
  for (const node of nodes) {
    if (node.kind === 'topic') topics += 1
    if (node.kind === 'subtopic') subtopics += 1
  }
  return { topics, subtopics }
}

export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min'
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${rest} min`
}

export function formatDurationShort(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (hours === 0) return `${rest}min`
  if (rest === 0) return `${hours}h`
  return `${hours}h${String(rest).padStart(2, '0')}`
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return new Date(then).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function statusBox(status: NodeStatus): string {
  switch (status) {
    case 'done':
      return '[x]'
    case 'studying':
      return '[~]'
    case 'review':
      return '[!]'
    case 'skipped':
      return '[-]'
    default:
      return '[ ]'
  }
}

export function groupResources<T extends { nodeId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const list = map.get(item.nodeId)
    if (list) list.push(item)
    else map.set(item.nodeId, [item])
  }
  return map
}

/** Agrupa nós por pai respeitando a ordem de posição. */
export function groupNodes(nodes: RoadmapNode[]): Map<string | null, RoadmapNode[]> {
  const map = new Map<string | null, RoadmapNode[]>()
  const sorted = nodes.slice().sort((a, b) => a.position - b.position)
  for (const node of sorted) {
    const list = map.get(node.parentId)
    if (list) list.push(node)
    else map.set(node.parentId, [node])
  }
  return map
}

export function boardProgress(detail: BoardDetail) {
  return summarize(detail.nodes)
}

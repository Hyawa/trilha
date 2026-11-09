import type Database from 'better-sqlite3'
import { getDb, newId, nowIso } from './db'
import { summarize, collectDescendantIds, isActionable } from '../../shared/logic'
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
  NodeKind,
  NodePatch,
  NodeStatus,
  Resource,
  ResourceInput,
  RoadmapNode,
} from '../../shared/types'
import { NODE_STATUSES } from '../../shared/api'

interface BoardRow {
  id: string
  title: string
  description: string | null
  emoji: string
  color: string
  archived: number
  created_at: string
  updated_at: string
}

interface NodeRow {
  id: string
  board_id: string
  parent_id: string | null
  kind: NodeKind
  position: number
  title: string
  description: string | null
  notes: string | null
  status: NodeStatus
  estimated_minutes: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

interface ResourceRow {
  id: string
  node_id: string
  kind: Resource['kind']
  title: string
  url: string
  position: number
  created_at: string
}

interface ChecklistRow {
  id: string
  node_id: string
  text: string
  done: number
  position: number
  created_at: string
}

const mapBoard = (row: BoardRow): Board => ({
  id: row.id,
  title: row.title,
  description: row.description,
  emoji: row.emoji,
  color: row.color,
  archived: row.archived === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapNode = (row: NodeRow): RoadmapNode => ({
  id: row.id,
  boardId: row.board_id,
  parentId: row.parent_id,
  kind: row.kind,
  position: row.position,
  title: row.title,
  description: row.description,
  notes: row.notes,
  status: row.status,
  estimatedMinutes: row.estimated_minutes,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapResource = (row: ResourceRow): Resource => ({
  id: row.id,
  nodeId: row.node_id,
  kind: row.kind,
  title: row.title,
  url: row.url,
  position: row.position,
  createdAt: row.created_at,
})

const mapChecklist = (row: ChecklistRow): ChecklistItem => ({
  id: row.id,
  nodeId: row.node_id,
  text: row.text,
  done: row.done === 1,
  position: row.position,
  createdAt: row.created_at,
})

function parentClause(parentId: string | null): { sql: string; params: unknown[] } {
  return parentId === null
    ? { sql: 'parent_id IS NULL', params: [] }
    : { sql: 'parent_id = ?', params: [parentId] }
}

function touchBoard(db: Database.Database, boardId: string): void {
  db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(nowIso(), boardId)
}

function touchNode(db: Database.Database, nodeId: string): void {
  db.prepare('UPDATE nodes SET updated_at = ? WHERE id = ?').run(nowIso(), nodeId)
}

function requireNode(db: Database.Database, id: string): NodeRow {
  const row = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as NodeRow | undefined
  if (!row) throw new Error('Tópico não encontrado.')
  return row
}

function requireBoard(db: Database.Database, id: string): BoardRow {
  const row = db.prepare('SELECT * FROM boards WHERE id = ?').get(id) as BoardRow | undefined
  if (!row) throw new Error('Mapa não encontrado.')
  return row
}

function kindForParent(parent: NodeRow | null): NodeKind {
  if (!parent) return 'phase'
  if (parent.kind === 'phase') return 'topic'
  if (parent.kind === 'topic') return 'subtopic'
  throw new Error('Um subtópico não pode ter filhos.')
}

function normalizeStatus(status: unknown): NodeStatus {
  return NODE_STATUSES.includes(status as NodeStatus) ? (status as NodeStatus) : 'todo'
}

function siblingCount(db: Database.Database, boardId: string, parentId: string | null): number {
  const clause = parentClause(parentId)
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(position), -1) AS maxPosition FROM nodes WHERE board_id = ? AND ${clause.sql}`,
    )
    .get(boardId, ...clause.params) as { maxPosition: number }
  return row.maxPosition + 1
}

// ---------------------------------------------------------------- boards

export function listBoards(): BoardSummary[] {
  const db = getDb()
  const boards = db
    .prepare('SELECT * FROM boards ORDER BY archived ASC, updated_at DESC')
    .all() as BoardRow[]
  const nodes = (db.prepare('SELECT * FROM nodes').all() as NodeRow[]).map(mapNode)

  const byBoard = new Map<string, RoadmapNode[]>()
  for (const node of nodes) {
    const list = byBoard.get(node.boardId)
    if (list) list.push(node)
    else byBoard.set(node.boardId, [node])
  }

  return boards.map((row) => {
    const list = byBoard.get(row.id) ?? []
    const progress = summarize(list)
    return {
      ...mapBoard(row),
      nodeCount: progress.total,
      doneCount: progress.done,
      totalMinutes: progress.totalMinutes,
      remainingMinutes: progress.remainingMinutes,
      percent: progress.percent,
    }
  })
}

export function getBoardDetail(id: string): BoardDetail | null {
  const db = getDb()
  const boardRow = db.prepare('SELECT * FROM boards WHERE id = ?').get(id) as BoardRow | undefined
  if (!boardRow) return null

  const nodes = (db.prepare('SELECT * FROM nodes WHERE board_id = ? ORDER BY position').all(id) as NodeRow[]).map(mapNode)
  const nodeIds = new Set(nodes.map((node) => node.id))

  const resources = (db.prepare('SELECT * FROM resources ORDER BY position').all() as ResourceRow[])
    .filter((row) => nodeIds.has(row.node_id))
    .map(mapResource)
  const checklist = (db.prepare('SELECT * FROM checklist_items ORDER BY position').all() as ChecklistRow[])
    .filter((row) => nodeIds.has(row.node_id))
    .map(mapChecklist)

  return { board: mapBoard(boardRow), nodes, resources, checklist }
}

export function createBoard(input: BoardInput): Board {
  const db = getDb()
  const title = input.title?.trim()
  if (!title) throw new Error('O mapa precisa de um título.')
  const timestamp = nowIso()
  const id = newId()

  db.prepare(
    `INSERT INTO boards (id, title, description, emoji, color, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    id,
    title,
    input.description?.trim() || null,
    input.emoji || '🧭',
    input.color || '#3f6b5b',
    timestamp,
    timestamp,
  )

  return mapBoard(requireBoard(db, id))
}

export function updateBoard(
  id: string,
  patch: Partial<BoardInput> & { archived?: boolean },
): Board {
  const db = getDb()
  requireBoard(db, id)
  const sets: string[] = []
  const params: unknown[] = []

  if (patch.title !== undefined) {
    const title = patch.title.trim()
    if (!title) throw new Error('O mapa precisa de um título.')
    sets.push('title = ?')
    params.push(title)
  }
  if (patch.description !== undefined) {
    sets.push('description = ?')
    params.push(patch.description?.trim() || null)
  }
  if (patch.emoji !== undefined) {
    sets.push('emoji = ?')
    params.push(patch.emoji || '🧭')
  }
  if (patch.color !== undefined) {
    sets.push('color = ?')
    params.push(patch.color || '#3f6b5b')
  }
  if (patch.archived !== undefined) {
    sets.push('archived = ?')
    params.push(patch.archived ? 1 : 0)
  }

  if (sets.length > 0) {
    params.push(nowIso(), id)
    db.prepare(`UPDATE boards SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...params)
  }

  return mapBoard(requireBoard(db, id))
}

export function deleteBoard(id: string): void {
  const db = getDb()
  requireBoard(db, id)
  db.prepare('DELETE FROM boards WHERE id = ?').run(id)
}

export function duplicateBoard(id: string): Board {
  const db = getDb()
  const source = requireBoard(db, id)
  const sourceNodes = db.prepare('SELECT * FROM nodes WHERE board_id = ?').all(id) as NodeRow[]
  const sourceResources = db
    .prepare(
      'SELECT * FROM resources WHERE node_id IN (SELECT id FROM nodes WHERE board_id = ?) ORDER BY position',
    )
    .all(id) as ResourceRow[]
  const sourceChecklist = db
    .prepare(
      'SELECT * FROM checklist_items WHERE node_id IN (SELECT id FROM nodes WHERE board_id = ?) ORDER BY position',
    )
    .all(id) as ChecklistRow[]

  const timestamp = nowIso()
  const newBoardId = newId()
  const nodeIdMap = new Map<string, string>()
  for (const node of sourceNodes) nodeIdMap.set(node.id, newId())

  const transaction = db.transaction(() => {
    db.prepare(
      `INSERT INTO boards (id, title, description, emoji, color, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      newBoardId,
      `${source.title} (cópia)`,
      source.description,
      source.emoji,
      source.color,
      timestamp,
      timestamp,
    )

    const insertNode = db.prepare(
      `INSERT INTO nodes (id, board_id, parent_id, kind, position, title, description, notes, status,
        estimated_minutes, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const node of sourceNodes) {
      insertNode.run(
        nodeIdMap.get(node.id) as string,
        newBoardId,
        node.parent_id ? nodeIdMap.get(node.parent_id) ?? null : null,
        node.kind,
        node.position,
        node.title,
        node.description,
        node.notes,
        node.status,
        node.estimated_minutes,
        node.completed_at,
        node.created_at,
        timestamp,
      )
    }

    const insertResource = db.prepare(
      `INSERT INTO resources (id, node_id, kind, title, url, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const resource of sourceResources) {
      const nodeId = nodeIdMap.get(resource.node_id)
      if (!nodeId) continue
      insertResource.run(newId(), nodeId, resource.kind, resource.title, resource.url, resource.position, resource.created_at)
    }

    const insertChecklist = db.prepare(
      `INSERT INTO checklist_items (id, node_id, text, done, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const item of sourceChecklist) {
      const nodeId = nodeIdMap.get(item.node_id)
      if (!nodeId) continue
      insertChecklist.run(newId(), nodeId, item.text, item.done, item.position, item.created_at)
    }
  })

  transaction()
  return mapBoard(requireBoard(db, newBoardId))
}

// ---------------------------------------------------------------- nodes

export function createNode(input: NodeInput): RoadmapNode {
  const db = getDb()
  const board = requireBoard(db, input.boardId)
  const parent = input.parentId ? requireNode(db, input.parentId) : null
  if (parent && parent.board_id !== board.id) throw new Error('Tópico pai inválido.')
  const kind = kindForParent(parent)

  const title = input.title?.trim()
  if (!title) throw new Error('O tópico precisa de um título.')

  const total = siblingCount(db, board.id, parent?.id ?? null)
  const position = Math.max(0, Math.min(input.position ?? total, total))
  const timestamp = nowIso()
  const id = newId()

  const transaction = db.transaction(() => {
    const clause = parentClause(parent?.id ?? null)
    db.prepare(
      `UPDATE nodes SET position = position + 1
       WHERE board_id = ? AND ${clause.sql} AND position >= ?`,
    ).run(board.id, ...clause.params, position)

    db.prepare(
      `INSERT INTO nodes (id, board_id, parent_id, kind, position, title, description, notes, status,
        estimated_minutes, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?)`,
    ).run(
      id,
      board.id,
      parent?.id ?? null,
      kind,
      position,
      title,
      input.description?.trim() || null,
      normalizeStatus(input.status),
      Math.max(0, Math.round(input.estimatedMinutes ?? 0)),
      timestamp,
      timestamp,
    )

    touchBoard(db, board.id)
  })

  transaction()
  return mapNode(requireNode(db, id))
}

export function updateNode(id: string, patch: NodePatch): RoadmapNode {
  const db = getDb()
  const current = requireNode(db, id)
  const sets: string[] = []
  const params: unknown[] = []
  const timestamp = nowIso()

  if (patch.title !== undefined) {
    const title = patch.title.trim()
    if (!title) throw new Error('O tópico precisa de um título.')
    sets.push('title = ?')
    params.push(title)
  }
  if (patch.description !== undefined) {
    sets.push('description = ?')
    params.push(patch.description?.trim() || null)
  }
  if (patch.notes !== undefined) {
    sets.push('notes = ?')
    params.push(patch.notes?.trim() ? patch.notes : null)
  }
  if (patch.estimatedMinutes !== undefined) {
    sets.push('estimated_minutes = ?')
    params.push(Math.max(0, Math.round(patch.estimatedMinutes || 0)))
  }
  if (patch.status !== undefined) {
    const status = normalizeStatus(patch.status)
    sets.push('status = ?')
    params.push(status)
    if (status === 'done') {
      sets.push('completed_at = ?')
      params.push(current.completed_at ?? timestamp)
    } else {
      sets.push('completed_at = NULL')
    }
  }

  if (sets.length > 0) {
    params.push(timestamp, id)
    db.prepare(`UPDATE nodes SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...params)
    touchBoard(db, current.board_id)
  }

  return mapNode(requireNode(db, id))
}

export function deleteNode(id: string): void {
  const db = getDb()
  const node = requireNode(db, id)
  db.prepare('DELETE FROM nodes WHERE id = ?').run(id)
  touchBoard(db, node.board_id)
}

export function reorderNodes(parentId: string | null, orderedIds: string[]): void {
  if (orderedIds.length === 0) return
  const db = getDb()
  const clause = parentClause(parentId)
  const rows = db
    .prepare(`SELECT * FROM nodes WHERE ${clause.sql} AND id IN (${orderedIds.map(() => '?').join(',')})`)
    .all(...clause.params, ...orderedIds) as NodeRow[]
  if (rows.length !== orderedIds.length) throw new Error('Ordem inválida para este grupo.')

  const boardId = rows[0].board_id
  const timestamp = nowIso()
  const update = db.prepare('UPDATE nodes SET position = ?, updated_at = ? WHERE id = ?')
  const transaction = db.transaction(() => {
    orderedIds.forEach((id, index) => update.run(index, timestamp, id))
    touchBoard(db, boardId)
  })
  transaction()
}

export function moveNode(id: string, parentId: string | null): RoadmapNode {
  const db = getDb()
  const node = requireNode(db, id)
  if (node.kind === 'phase') throw new Error('Fases são reordenadas, não movidas.')

  const parent = parentId ? requireNode(db, parentId) : null
  if (!parent) throw new Error('Escolha uma fase ou tópico de destino.')
  if (parent.board_id !== node.board_id) throw new Error('Destino em outro mapa.')

  const expectedKind = kindForParent(parent)
  if (expectedKind !== node.kind) {
    throw new Error('O destino não é compatível com este item.')
  }

  const descendants = collectDescendantIds(
    (db.prepare('SELECT * FROM nodes WHERE board_id = ?').all(node.board_id) as NodeRow[]).map(mapNode),
    id,
  )
  if (parentId && (parentId === id || descendants.includes(parentId))) {
    throw new Error('Não é possível mover para dentro do próprio item.')
  }

  const count = siblingCount(db, node.board_id, parentId)
  const position = Math.max(0, parent.id === node.parent_id ? count - 1 : count)
  const timestamp = nowIso()

  db.prepare('UPDATE nodes SET parent_id = ?, position = ?, updated_at = ? WHERE id = ?').run(
    parent.id,
    position,
    timestamp,
    id,
  )
  touchBoard(db, node.board_id)

  return mapNode(requireNode(db, id))
}

export function completeSubtree(id: string): void {
  const db = getDb()
  const node = requireNode(db, id)
  const nodes = (db.prepare('SELECT * FROM nodes WHERE board_id = ?').all(node.board_id) as NodeRow[]).map(mapNode)
  const descendants = collectDescendantIds(nodes, id)
  const ids = new Set(descendants)
  if (isActionable(mapNode(node), nodes)) ids.add(node.id)

  const targets = nodes.filter((candidate) => ids.has(candidate.id))
  if (targets.length === 0) return

  const timestamp = nowIso()
  const update = db.prepare(
    `UPDATE nodes SET status = 'done', completed_at = COALESCE(completed_at, ?), updated_at = ? WHERE id = ?`,
  )
  const transaction = db.transaction(() => {
    for (const target of targets) update.run(timestamp, timestamp, target.id)
    touchBoard(db, node.board_id)
  })
  transaction()
}

// ---------------------------------------------------------------- resources

export function createResource(input: ResourceInput): Resource {
  const db = getDb()
  const node = requireNode(db, input.nodeId)
  const title = input.title?.trim()
  const url = input.url?.trim()
  if (!title) throw new Error('Dê um nome ao recurso.')
  if (!url) throw new Error('Informe o link do recurso.')

  const row = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS max FROM resources WHERE node_id = ?')
    .get(node.id) as { max: number }

  const id = newId()
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO resources (id, node_id, kind, title, url, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, node.id, input.kind || 'link', title, url, row.max + 1, timestamp)

  touchNode(db, node.id)
  touchBoard(db, node.board_id)
  return mapResource(db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as ResourceRow)
}

export function updateResource(id: string, patch: Partial<ResourceInput>): Resource {
  const db = getDb()
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as ResourceRow | undefined
  if (!row) throw new Error('Recurso não encontrado.')
  const node = requireNode(db, row.node_id)

  const sets: string[] = []
  const params: unknown[] = []
  if (patch.title !== undefined) {
    const title = patch.title.trim()
    if (!title) throw new Error('Dê um nome ao recurso.')
    sets.push('title = ?')
    params.push(title)
  }
  if (patch.url !== undefined) {
    const url = patch.url.trim()
    if (!url) throw new Error('Informe o link do recurso.')
    sets.push('url = ?')
    params.push(url)
  }
  if (patch.kind !== undefined) {
    sets.push('kind = ?')
    params.push(patch.kind)
  }
  if (sets.length > 0) {
    params.push(id)
    db.prepare(`UPDATE resources SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    touchNode(db, node.id)
    touchBoard(db, node.board_id)
  }

  return mapResource(db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as ResourceRow)
}

export function deleteResource(id: string): void {
  const db = getDb()
  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as ResourceRow | undefined
  if (!row) return
  const node = requireNode(db, row.node_id)
  db.prepare('DELETE FROM resources WHERE id = ?').run(id)
  touchNode(db, node.id)
  touchBoard(db, node.board_id)
}

// ---------------------------------------------------------------- checklist

export function createChecklistItem(input: ChecklistInput): ChecklistItem {
  const db = getDb()
  const node = requireNode(db, input.nodeId)
  const text = input.text?.trim()
  if (!text) throw new Error('Escreva o item da checklist.')

  const row = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS max FROM checklist_items WHERE node_id = ?')
    .get(node.id) as { max: number }

  const id = newId()
  const timestamp = nowIso()
  db.prepare(
    `INSERT INTO checklist_items (id, node_id, text, done, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, node.id, text, input.done ? 1 : 0, row.max + 1, timestamp)

  touchNode(db, node.id)
  touchBoard(db, node.board_id)
  return mapChecklist(db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id) as ChecklistRow)
}

export function updateChecklistItem(id: string, patch: Partial<ChecklistInput>): ChecklistItem {
  const db = getDb()
  const row = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id) as ChecklistRow | undefined
  if (!row) throw new Error('Item não encontrado.')
  const node = requireNode(db, row.node_id)

  const sets: string[] = []
  const params: unknown[] = []
  if (patch.text !== undefined) {
    const text = patch.text.trim()
    if (!text) throw new Error('Escreva o item da checklist.')
    sets.push('text = ?')
    params.push(text)
  }
  if (patch.done !== undefined) {
    sets.push('done = ?')
    params.push(patch.done ? 1 : 0)
  }
  if (sets.length > 0) {
    params.push(id)
    db.prepare(`UPDATE checklist_items SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    touchNode(db, node.id)
    touchBoard(db, node.board_id)
  }

  return mapChecklist(db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id) as ChecklistRow)
}

export function deleteChecklistItem(id: string): void {
  const db = getDb()
  const row = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id) as ChecklistRow | undefined
  if (!row) return
  const node = requireNode(db, row.node_id)
  db.prepare('DELETE FROM checklist_items WHERE id = ?').run(id)
  touchNode(db, node.id)
  touchBoard(db, node.board_id)
}

// ---------------------------------------------------------------- settings

export function getSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value)
}

// ---------------------------------------------------------------- backup

export function exportBackup(): BackupFile {
  const db = getDb()
  return {
    app: 'trilha',
    version: 1,
    exportedAt: nowIso(),
    boards: (db.prepare('SELECT * FROM boards ORDER BY created_at').all() as BoardRow[]).map(mapBoard),
    nodes: (db.prepare('SELECT * FROM nodes').all() as NodeRow[]).map(mapNode),
    resources: (db.prepare('SELECT * FROM resources').all() as ResourceRow[]).map(mapResource),
    checklist: (db.prepare('SELECT * FROM checklist_items').all() as ChecklistRow[]).map(mapChecklist),
  }
}

function isoOr(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  return Number.isNaN(new Date(value).getTime()) ? fallback : value
}

function textOr(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function importBackup(payload: unknown, mode: 'merge' | 'replace'): ImportResult {
  const data = payload as Partial<BackupFile>
  if (!data || data.app !== 'trilha' || !Array.isArray(data.boards) || !Array.isArray(data.nodes)) {
    throw new Error('Arquivo de backup inválido.')
  }

  const db = getDb()
  const timestamp = nowIso()
  const boardMap = new Map<string, string>()
  const nodeMap = new Map<string, string>()
  let boards = 0
  let nodes = 0

  const transaction = db.transaction(() => {
    if (mode === 'replace') db.prepare('DELETE FROM boards').run()

    const insertBoard = db.prepare(
      `INSERT INTO boards (id, title, description, emoji, color, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const board of data.boards as Board[]) {
      if (!board || typeof board.id !== 'string') continue
      const id = newId()
      boardMap.set(board.id, id)
      insertBoard.run(
        id,
        textOr(board.title, 'Mapa sem título').trim() || 'Mapa sem título',
        typeof board.description === 'string' ? board.description : null,
        textOr(board.emoji, '🧭') || '🧭',
        textOr(board.color, '#3f6b5b') || '#3f6b5b',
        board.archived ? 1 : 0,
        isoOr(board.createdAt, timestamp),
        isoOr(board.updatedAt, timestamp),
      )
      boards += 1
    }

    const insertNode = db.prepare(
      `INSERT INTO nodes (id, board_id, parent_id, kind, position, title, description, notes, status,
        estimated_minutes, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )

    const byKind: NodeKind[] = ['phase', 'topic', 'subtopic']
    const nodesData = data.nodes as RoadmapNode[]
    for (const kind of byKind) {
      for (const node of nodesData) {
        if (!node || typeof node.id !== 'string' || node.kind !== kind) continue
        const boardId = boardMap.get(node.boardId)
        if (!boardId) continue
        if (kind !== 'phase' && (!node.parentId || !nodeMap.has(node.parentId))) continue

        const id = newId()
        nodeMap.set(node.id, id)
        insertNode.run(
          id,
          boardId,
          kind === 'phase' ? null : nodeMap.get(node.parentId as string) ?? null,
          kind,
          Number.isFinite(node.position) ? Number(node.position) : 0,
          textOr(node.title, 'Sem título').trim() || 'Sem título',
          typeof node.description === 'string' ? node.description : null,
          typeof node.notes === 'string' ? node.notes : null,
          normalizeStatus(node.status),
          Math.max(0, Math.round(Number(node.estimatedMinutes) || 0)),
          typeof node.completedAt === 'string' ? node.completedAt : null,
          isoOr(node.createdAt, timestamp),
          isoOr(node.updatedAt, timestamp),
        )
        nodes += 1
      }
    }

    const insertResource = db.prepare(
      `INSERT INTO resources (id, node_id, kind, title, url, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const resource of (data.resources ?? []) as Resource[]) {
      const nodeId = resource?.nodeId ? nodeMap.get(resource.nodeId) : undefined
      if (!nodeId) continue
      insertResource.run(
        newId(),
        nodeId,
        textOr(resource.kind, 'link') as Resource['kind'],
        textOr(resource.title, 'Recurso'),
        textOr(resource.url, ''),
        Number.isFinite(resource.position) ? Number(resource.position) : 0,
        isoOr(resource.createdAt, timestamp),
      )
    }

    const insertChecklist = db.prepare(
      `INSERT INTO checklist_items (id, node_id, text, done, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const item of (data.checklist ?? []) as ChecklistItem[]) {
      const nodeId = item?.nodeId ? nodeMap.get(item.nodeId) : undefined
      if (!nodeId) continue
      insertChecklist.run(
        newId(),
        nodeId,
        textOr(item.text, ''),
        item.done ? 1 : 0,
        Number.isFinite(item.position) ? Number(item.position) : 0,
        isoOr(item.createdAt, timestamp),
      )
    }
  })

  transaction()
  return { boards, nodes }
}

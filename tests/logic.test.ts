import { describe, expect, it } from 'vitest'
import {
  collectDescendantIds,
  formatDurationShort,
  formatMinutes,
  nextActionable,
  orderedLeaves,
  phaseIdOf,
  summarize,
} from '../shared/logic'
import type { RoadmapNode } from '../shared/types'

const ISO = '2024-01-01T00:00:00.000Z'

function node(overrides: Partial<RoadmapNode> & Pick<RoadmapNode, 'id' | 'kind'>): RoadmapNode {
  return {
    boardId: 'board-1',
    parentId: null,
    position: 0,
    title: overrides.id,
    description: null,
    notes: null,
    status: 'todo',
    estimatedMinutes: 0,
    completedAt: null,
    createdAt: ISO,
    updatedAt: ISO,
    ...overrides,
  }
}

function sample(): RoadmapNode[] {
  return [
    node({ id: 'p1', kind: 'phase', position: 0, title: 'Fundamentos' }),
    node({ id: 'p2', kind: 'phase', position: 1, title: 'Prática' }),
    node({ id: 't1', kind: 'topic', parentId: 'p1', position: 0, title: 'Introdução', estimatedMinutes: 30 }),
    node({ id: 't2', kind: 'topic', parentId: 'p1', position: 1, title: 'Setup', status: 'done', estimatedMinutes: 60 }),
    node({ id: 's1', kind: 'subtopic', parentId: 't1', position: 0, title: 'O que é', estimatedMinutes: 20 }),
    node({ id: 's2', kind: 'subtopic', parentId: 't1', position: 1, title: 'História', status: 'skipped', estimatedMinutes: 10 }),
    node({ id: 't3', kind: 'topic', parentId: 'p2', position: 0, title: 'Projeto', estimatedMinutes: 120 }),
  ]
}

describe('orderedLeaves', () => {
  it('percorre a trilha em ordem e ignora tópicos que têm subtópicos', () => {
    const ids = orderedLeaves(sample()).map((item) => item.id)
    expect(ids).toEqual(['s1', 's2', 't2', 't3'])
  })
})

describe('summarize', () => {
  it('calcula progresso de todo o mapa', () => {
    const progress = summarize(sample())
    expect(progress.total).toBe(3)
    expect(progress.done).toBe(1)
    expect(progress.skipped).toBe(1)
    expect(progress.percent).toBe(33)
    expect(progress.totalMinutes).toBe(200)
    expect(progress.remainingMinutes).toBe(140)
  })

  it('calcula progresso por fase', () => {
    const progress = summarize(sample(), 'p1')
    expect(progress.total).toBe(2)
    expect(progress.done).toBe(1)
    expect(progress.percent).toBe(50)
  })

  it('lida com mapa vazio', () => {
    expect(summarize([])).toMatchObject({ total: 0, done: 0, percent: 0 })
  })

  it('considera 100% quando tudo foi concluído ou pulado', () => {
    const nodes = sample().map((item) =>
      item.id === 's1' ? { ...item, status: 'done' as const } : item.id === 't3' ? { ...item, status: 'done' as const } : item,
    )
    expect(summarize(nodes).percent).toBe(100)
  })
})

describe('nextActionable', () => {
  it('retorna o primeiro item pendente na ordem da trilha', () => {
    expect(nextActionable(sample())?.id).toBe('s1')
  })

  it('avança quando o item é concluído e ignora pulados', () => {
    const done = sample().map((item) =>
      item.id === 's1' || item.id === 't2' ? { ...item, status: 'done' as const } : item,
    )
    expect(nextActionable(done)?.id).toBe('t3')
  })

  it('retorna null quando tudo está resolvido', () => {
    const done = sample().map((item) =>
      item.kind === 'phase' ? item : { ...item, status: item.id === 's2' ? ('skipped' as const) : ('done' as const) },
    )
    expect(nextActionable(done)).toBeNull()
  })
})

describe('utilitários', () => {
  it('descobre a fase de qualquer nó', () => {
    const nodes = sample()
    expect(phaseIdOf(nodes.find((item) => item.id === 's1')!, nodes)).toBe('p1')
    expect(phaseIdOf(nodes.find((item) => item.id === 't3')!, nodes)).toBe('p2')
  })

  it('coleta descendentes em profundidade', () => {
    expect(collectDescendantIds(sample(), 't1').sort()).toEqual(['s1', 's2'])
    expect(collectDescendantIds(sample(), 'p1').sort()).toEqual(['s1', 's2', 't1', 't2'])
  })

  it('formata minutos', () => {
    expect(formatMinutes(0)).toBe('0 min')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(90)).toBe('1 h 30 min')
    expect(formatDurationShort(90)).toBe('1h30')
    expect(formatDurationShort(120)).toBe('2h')
  })
})

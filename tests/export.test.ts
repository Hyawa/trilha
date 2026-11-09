import { describe, expect, it } from 'vitest'
import { boardToMarkdown } from '../shared/export'
import { boardToPrintHtml, markdownToHtml } from '../shared/print'
import { EMPTY_PROGRESS } from '../shared/logic'
import type { BoardDetail, RoadmapNode } from '../shared/types'

const ISO = '2024-01-01T00:00:00.000Z'

const nodes: RoadmapNode[] = [
  {
    id: 'p1',
    boardId: 'b1',
    parentId: null,
    kind: 'phase',
    position: 0,
    title: 'Fundamentos',
    description: null,
    notes: null,
    status: 'todo',
    estimatedMinutes: 0,
    completedAt: null,
    createdAt: ISO,
    updatedAt: ISO,
  },
  {
    id: 't1',
    boardId: 'b1',
    parentId: 'p1',
    kind: 'topic',
    position: 0,
    title: 'Primeiros passos',
    description: 'Entender o básico.',
    notes: 'Anotar **tudo** no caderno.',
    status: 'done',
    estimatedMinutes: 30,
    completedAt: ISO,
    createdAt: ISO,
    updatedAt: ISO,
  },
  {
    id: 's1',
    boardId: 'b1',
    parentId: 't1',
    kind: 'subtopic',
    position: 0,
    title: 'Instalação',
    description: null,
    notes: null,
    status: 'studying',
    estimatedMinutes: 15,
    completedAt: null,
    createdAt: ISO,
    updatedAt: ISO,
  },
]

const detail: BoardDetail = {
  board: {
    id: 'b1',
    title: 'Aprender algo',
    description: 'Do zero ao fim',
    emoji: '🧭',
    color: '#3f6b5b',
    archived: false,
    createdAt: ISO,
    updatedAt: ISO,
  },
  nodes,
  resources: [
    {
      id: 'r1',
      nodeId: 't1',
      kind: 'video',
      title: 'Aula introdutória',
      url: 'https://example.com/aula',
      position: 0,
      createdAt: ISO,
    },
  ],
  checklist: [
    { id: 'c1', nodeId: 't1', text: 'Ler o capítulo 1', done: true, position: 0, createdAt: ISO },
  ],
}

describe('boardToMarkdown', () => {
  const markdown = boardToMarkdown(detail)

  it('inclui cabeçalho do mapa e das fases', () => {
    expect(markdown).toContain('# 🧭 Aprender algo')
    expect(markdown).toContain('## 1. Fundamentos')
    expect(markdown).toContain('Do zero ao fim')
  })

  it('marca status dos itens', () => {
    expect(markdown).toContain('- [x] **Primeiros passos**')
    expect(markdown).toContain('- [~] Instalação')
  })

  it('inclui recursos, checklist e notas', () => {
    expect(markdown).toContain('[Aula introdutória](https://example.com/aula)')
    expect(markdown).toContain('- [x] Ler o capítulo 1')
    expect(markdown).toContain('> **Anotações**')
    expect(markdown).toContain('Anotar **tudo** no caderno.')
  })
})

describe('boardToPrintHtml', () => {
  const html = boardToPrintHtml(detail)

  it('gera um documento completo com progresso', () => {
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('Primeiros passos')
    expect(html).toContain('href="https://example.com/aula"')
  })

  it('escapa HTML de títulos e descrições', () => {
    const dangerous = boardToPrintHtml({
      ...detail,
      board: { ...detail.board, title: '<script>alert(1)</script>', description: '<b>x</b>' },
    })
    expect(dangerous).not.toContain('<script>alert(1)</script>')
    expect(dangerous).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(dangerous).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})

describe('markdownToHtml', () => {
  it('converte títulos, listas e ênfase sem permitir HTML cru', () => {
    const html = markdownToHtml('# Título\n- item\n**forte** e *leve*\n<img src=x onerror=alert(1)>')
    expect(html).toContain('<h3>Título</h3>')
    expect(html).toContain('<li>item</li>')
    expect(html).toContain('<strong>forte</strong>')
    expect(html).toContain('<em>leve</em>')
    expect(html).not.toContain('<img')
  })
})

describe('EMPTY_PROGRESS', () => {
  it('começa zerado', () => {
    expect(EMPTY_PROGRESS.percent).toBe(0)
    expect(EMPTY_PROGRESS.total).toBe(0)
  })
})

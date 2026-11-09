import { childrenOf, formatMinutes, statusBox, summarize } from './logic'
import type { BoardDetail, RoadmapNode } from './types'
import { STATUS_LABELS } from './types'

function indent(depth: number): string {
  return '  '.repeat(depth)
}

function renderNode(
  node: RoadmapNode,
  nodes: RoadmapNode[],
  detail: BoardDetail,
  depth: number,
): string[] {
  const prefix = indent(depth)
  const resources = detail.resources.filter((resource) => resource.nodeId === node.id)
  const checklist = detail.checklist.filter((item) => item.nodeId === node.id)
  const children = childrenOf(nodes, node.id)

  const time = node.estimatedMinutes > 0 ? ` — ${formatMinutes(node.estimatedMinutes)}` : ''
  const status = node.status === 'todo' ? '' : ` _(status: ${STATUS_LABELS[node.status]})_`
  const line =
    node.kind === 'subtopic'
      ? `${prefix}- ${statusBox(node.status)} ${node.title}${time}${status}`
      : `${prefix}- ${statusBox(node.status)} **${node.title}**${time}${status}`

  const out: string[] = [line]

  if (node.description) {
    for (const paragraph of node.description.split(/\r?\n/)) {
      out.push(`${prefix}  > ${paragraph}`.trimEnd())
    }
  }

  if (checklist.length > 0) {
    for (const item of checklist) {
      out.push(`${prefix}  - ${item.done ? '[x]' : '[ ]'} ${item.text}`)
    }
  }

  for (const resource of resources) {
    out.push(`${prefix}  - [${resource.title}](${resource.url})`)
  }

  if (node.notes?.trim()) {
    out.push(`${prefix}  > **Anotações**`)
    for (const paragraph of node.notes.split(/\r?\n/)) {
      out.push(`${prefix}  > ${paragraph}`.trimEnd())
    }
  }

  if (children.length > 0) {
    out.push('')
    for (const child of children) {
      out.push(...renderNode(child, nodes, detail, depth + 1))
    }
  }

  return out
}

export function boardToMarkdown(detail: BoardDetail): string {
  const { board, nodes } = detail
  const progress = summarize(nodes)
  const phases = childrenOf(nodes, null)
  const created = new Date(board.createdAt).toLocaleDateString('pt-BR')

  const lines: string[] = []
  lines.push(`# ${board.emoji} ${board.title}`)
  lines.push('')

  if (board.description?.trim()) {
    lines.push(`_${board.description.trim()}_`)
    lines.push('')
  }

  lines.push(
    `**Progresso:** ${progress.done} de ${progress.total} tópicos (${progress.percent}%) · ` +
      `${formatMinutes(progress.remainingMinutes)} restantes de ${formatMinutes(progress.totalMinutes)}`,
  )
  if (created) lines.push(`**Criado em:** ${created}`)
  lines.push('')

  if (phases.length === 0) {
    lines.push('_Este mapa ainda não tem fases._')
  }

  phases.forEach((phase, index) => {
    lines.push(`## ${index + 1}. ${phase.title}`)
    if (phase.description?.trim()) {
      lines.push('')
      lines.push(phase.description.trim())
    }
    lines.push('')

    const topics = childrenOf(nodes, phase.id)
    if (topics.length === 0) {
      lines.push('_Nenhum tópico nesta fase._')
      lines.push('')
      return
    }

    for (const topic of topics) {
      lines.push(...renderNode(topic, nodes, detail, 0))
      lines.push('')
    }
  })

  lines.push('---')
  lines.push('_Gerado com Trilha — mapas de estudo._')
  lines.push('')
  return lines.join('\n')
}

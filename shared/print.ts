import { childrenOf, formatMinutes, summarize } from './logic'
import type { BoardDetail, RoadmapNode } from './types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Markdown mínimo para as anotações impressas (títulos, listas, ênfase, links). */
export function markdownToHtml(markdown: string): string {
  const lines = escapeHtml(markdown).split(/\r?\n/)
  const out: string[] = []
  let inList = false

  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      closeList()
      continue
    }

    if (/^#{1,4}\s+/.test(line)) {
      closeList()
      const level = (line.match(/^#+/) as RegExpMatchArray)[0].length
      out.push(`<h${level + 2}>${inline(line.replace(/^#+\s+/, ''))}</h${level + 2}>`)
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }

    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }

  closeList()
  return out.join('\n')
}

function inline(value: string): string {
  return value
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
}

function renderNode(node: RoadmapNode, nodes: RoadmapNode[], detail: BoardDetail): string {
  const resources = detail.resources.filter((resource) => resource.nodeId === node.id)
  const checklist = detail.checklist.filter((item) => item.nodeId === node.id)
  const children = childrenOf(nodes, node.id)
  const time = node.estimatedMinutes > 0 ? `<span class="time">${formatMinutes(node.estimatedMinutes)}</span>` : ''

  const resourceHtml =
    resources.length > 0
      ? `<div class="resources"><span class="label">Recursos</span>${resources
          .map(
            (resource) =>
              `<a href="${escapeHtml(resource.url)}">${escapeHtml(resource.title)}</a>`,
          )
          .join('')}</div>`
      : ''

  const checklistHtml =
    checklist.length > 0
      ? `<ul class="checklist">${checklist
          .map(
            (item) =>
              `<li class="${item.done ? 'checked' : ''}">${item.done ? '&#10003;' : '&#9744;'} ${escapeHtml(item.text)}</li>`,
          )
          .join('')}</ul>`
      : ''

  const notesHtml = node.notes?.trim()
    ? `<div class="notes">${markdownToHtml(node.notes)}</div>`
    : ''

  const descriptionHtml = node.description?.trim()
    ? `<p class="description">${escapeHtml(node.description.trim()).replace(/\r?\n/g, '<br />')}</p>`
    : ''

  const childrenHtml =
    children.length > 0
      ? `<div class="subtopics">${children.map((child) => renderNode(child, nodes, detail)).join('')}</div>`
      : ''

  return `
    <div class="node node-${node.kind} status-${node.status}">
      <div class="node-head">
        <span class="mark"></span>
        <span class="title">${escapeHtml(node.title)}</span>
        ${time}
      </div>
      ${descriptionHtml}
      ${checklistHtml}
      ${resourceHtml}
      ${notesHtml}
      ${childrenHtml}
    </div>
  `
}

export function boardToPrintHtml(detail: BoardDetail): string {
  const { board, nodes } = detail
  const progress = summarize(nodes)
  const phases = childrenOf(nodes, null)
  const exportedAt = new Date().toLocaleString('pt-BR')

  const phaseHtml = phases
    .map((phase, index) => {
      const topics = childrenOf(nodes, phase.id)
      const phaseProgress = summarize(nodes, phase.id)
      return `
        <section class="phase">
          <div class="phase-head">
            <span class="station">${index + 1}</span>
            <div class="phase-title">
              <h2>${escapeHtml(phase.title)}</h2>
              <div class="phase-meta">${phaseProgress.done}/${phaseProgress.total} concluídos · ${
                phaseProgress.percent
              }%</div>
            </div>
          </div>
          ${phase.description ? `<p class="description">${escapeHtml(phase.description)}</p>` : ''}
          ${topics.map((topic) => renderNode(topic, nodes, detail)).join('')}
        </section>
      `
    })
    .join('')

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(board.title)} — Trilha</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", system-ui, sans-serif;
    color: #23312b;
    margin: 0;
    font-size: 11pt;
    line-height: 1.5;
  }
  .cover { border-bottom: 3px solid #3f6b5b; padding-bottom: 14px; margin-bottom: 22px; }
  .cover .eyebrow { font-size: 8pt; letter-spacing: .18em; text-transform: uppercase; color: #6b7d75; }
  .cover h1 { font-family: Georgia, "Palatino Linotype", serif; font-size: 26pt; margin: 8px 0 6px; }
  .cover .description { margin: 0 0 12px; color: #4d5d56; font-size: 11pt; }
  .cover .bar { height: 7px; background: #e7e1d4; border-radius: 99px; overflow: hidden; }
  .cover .bar span { display: block; height: 100%; background: #3f6b5b; }
  .cover .meta { display: flex; justify-content: space-between; font-size: 9pt; color: #6b7d75; margin-top: 7px; }
  .phase { margin: 0 0 26px; break-inside: auto; }
  .phase-head { display: flex; gap: 10px; align-items: center; border-bottom: 1px solid #ded8ca; padding-bottom: 6px; margin-bottom: 10px; }
  .station { width: 26px; height: 26px; border-radius: 50%; background: #3f6b5b; color: #fff; font-weight: 700; font-size: 11pt; display: flex; align-items: center; justify-content: center; flex: none; }
  .phase-title { flex: 1; }
  .phase-title h2 { font-family: Georgia, "Palatino Linotype", serif; font-size: 15pt; margin: 0; }
  .phase-meta { font-size: 8.5pt; color: #6b7d75; }
  .node { margin: 0 0 9px 0; padding: 0 0 0 14px; border-left: 2px solid #e2dccf; break-inside: avoid; }
  .node-head { display: flex; align-items: baseline; gap: 7px; }
  .mark { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #9aa79f; flex: none; transform: translateY(-1px); }
  .node.status-done .mark { background: #3f6b5b; border-color: #3f6b5b; }
  .node.status-studying .mark { background: #c48a2c; border-color: #c48a2c; }
  .node.status-review .mark { background: #a15c3f; border-color: #a15c3f; }
  .node.status-skipped .mark { background: #c7c1b4; border-color: #c7c1b4; }
  .title { font-weight: 600; }
  .node.status-done .title { color: #6b7d75; text-decoration: line-through; text-decoration-thickness: 1px; }
  .time { font-size: 8.5pt; color: #8a958f; margin-left: auto; padding-left: 12px; white-space: nowrap; }
  .description { margin: 3px 0 0; font-size: 10pt; color: #55655d; }
  .subtopics { margin: 7px 0 0 4px; padding-left: 12px; border-left: 1px dashed #ddd6c8; }
  .subtopics .node { margin-bottom: 6px; }
  .resources { margin-top: 4px; font-size: 9pt; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
  .resources .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .12em; color: #8a958f; }
  .resources a { color: #2f6f8f; text-decoration: none; border-bottom: 1px solid #cfe0e8; }
  .checklist { margin: 4px 0 0; padding-left: 0; list-style: none; font-size: 9.5pt; color: #4d5d56; }
  .checklist li { margin: 1px 0; }
  .checklist li.checked { color: #8a958f; text-decoration: line-through; }
  .notes { margin-top: 5px; padding: 7px 9px; background: #f6f2e8; border-radius: 5px; font-size: 9.5pt; color: #44524b; }
  .notes p { margin: 0 0 4px; }
  .notes h3, .notes h4, .notes h5, .notes h6 { margin: 6px 0 3px; font-size: 10pt; }
  .notes ul { margin: 3px 0; padding-left: 16px; }
  .notes code { background: #eae4d7; padding: 0 3px; border-radius: 3px; font-size: 9pt; }
  .notes a { color: #2f6f8f; }
  .footer { margin-top: 26px; padding-top: 8px; border-top: 1px solid #ded8ca; font-size: 8pt; color: #8a958f; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <header class="cover">
    <div class="eyebrow">Trilha · mapa de estudos</div>
    <h1>${escapeHtml(board.emoji)} ${escapeHtml(board.title)}</h1>
    ${board.description ? `<p class="description">${escapeHtml(board.description)}</p>` : ''}
    <div class="bar"><span style="width:${progress.percent}%"></span></div>
    <div class="meta">
      <span>${progress.done} de ${progress.total} tópicos · ${progress.percent}%</span>
      <span>${formatMinutes(progress.remainingMinutes)} restantes</span>
    </div>
  </header>
  ${phaseHtml || '<p>Este mapa ainda não tem fases.</p>'}
  <div class="footer">
    <span>Gerado em ${escapeHtml(exportedAt)}</span>
    <span>Trilha</span>
  </div>
</body>
</html>`
}

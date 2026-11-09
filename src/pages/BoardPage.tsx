import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  FileDown,
  FileText,
  Flag,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Archive,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  formatDurationShort,
  formatMinutes,
  nextActionable,
  summarize,
} from '@shared/logic'
import {
  STATUS_LABELS,
  type Board,
  type NodeStatus,
  type RoadmapNode,
} from '@shared/types'
import { useAppStore } from '@/store/useAppStore'
import { STATUS_ORDER } from '@/lib/status'
import { cn, errorMessage } from '@/lib/utils'
import { Timeline, type Zoom } from '@/components/Timeline'
import { NodeDrawer } from '@/components/NodeDrawer'
import { BoardFormDialog } from '@/components/BoardFormDialog'
import { Button, ConfirmDialog, Menu, ProgressBar, Segmented } from '@/components/ui'

export function BoardPage() {
  const view = useAppStore((state) => state.view)
  const detail = useAppStore((state) => state.detail)
  const boards = useAppStore((state) => state.boards)
  const goDashboard = useAppStore((state) => state.goDashboard)
  const updateBoard = useAppStore((state) => state.updateBoard)
  const duplicateBoard = useAppStore((state) => state.duplicateBoard)
  const deleteBoard = useAppStore((state) => state.deleteBoard)
  const updateNode = useAppStore((state) => state.updateNode)
  const openBoard = useAppStore((state) => state.openBoard)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<NodeStatus | 'all'>('all')
  const [zoom, setZoom] = useState<Zoom>(() =>
    localStorage.getItem('trilha:zoom') === 'compact' ? 'compact' : 'comfort',
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const boardId = view.name === 'board' ? view.id : ''
  const boardExists = boards.some((board) => board.id === boardId)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (selectedId && detail && !detail.nodes.some((node) => node.id === selectedId)) {
      setSelectedId(null)
    }
  }, [detail, selectedId])

  const progress = useMemo(() => (detail ? summarize(detail.nodes) : null), [detail])
  const next = useMemo(() => (detail ? nextActionable(detail.nodes) : null), [detail])
  const selected = detail && selectedId ? detail.nodes.find((node) => node.id === selectedId) ?? null : null

  const persistZoom = (value: Zoom) => {
    setZoom(value)
    localStorage.setItem('trilha:zoom', value)
  }

  const toggleCollapse = (id: string) => {
    setCollapsed((current) => {
      const nextSet = new Set(current)
      if (nextSet.has(id)) nextSet.delete(id)
      else nextSet.add(id)
      return nextSet
    })
  }

  const collapseAll = () => {
    if (!detail) return
    const ids = new Set<string>()
    for (const node of detail.nodes) {
      if (node.kind === 'phase' || (node.kind === 'topic' && detail.nodes.some((child) => child.parentId === node.id))) {
        ids.add(node.id)
      }
    }
    setCollapsed(ids)
  }

  const exportMap = async (format: 'markdown' | 'pdf') => {
    if (!detail) return
    setExporting(true)
    try {
      const path =
        format === 'markdown'
          ? await window.trilha.exporter.markdown(detail.board.id)
          : await window.trilha.exporter.pdf(detail.board.id)
      if (path) {
        toast.success(format === 'markdown' ? 'Markdown exportado' : 'PDF exportado', {
          description: path,
        })
      }
    } catch (error) {
      toast.error('Não foi possível exportar', { description: errorMessage(error) })
    } finally {
      setExporting(false)
    }
  }

  if (!detail) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col items-center justify-center px-5 py-24 text-center">
        {boardExists || boards.length === 0 ? (
          <>
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">Abrindo mapa…</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl text-foreground">Mapa não encontrado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Este mapa pode ter sido excluído ou o arquivo de dados foi alterado.
            </p>
            <Button variant="outline" className="mt-5" onClick={goDashboard}>
              <ArrowLeft className="h-4 w-4" />
              Voltar para a biblioteca
            </Button>
          </>
        )}
      </main>
    )
  }

  const board = detail.board
  const phaseName = next ? parentTrail(next, detail.nodes) : ''
  const nextIsSub = next?.kind === 'subtopic'

  const completeNext = async () => {
    if (!next) return
    try {
      await updateNode(next.id, { status: 'done' })
      toast.success('Tópico concluído', { description: next.title })
    } catch (error) {
      toast.error('Não foi possível concluir', { description: errorMessage(error) })
    }
  }

  const archiveBoard = async () => {
    try {
      await updateBoard(board.id, { archived: true })
      toast.success('Mapa arquivado')
      goDashboard()
    } catch (error) {
      toast.error('Não foi possível arquivar', { description: errorMessage(error) })
    }
  }

  const duplicate = async () => {
    try {
      const copy = await duplicateBoard(board.id)
      toast.success('Mapa duplicado')
      await openBoard(copy.id)
    } catch (error) {
      toast.error('Não foi possível duplicar', { description: errorMessage(error) })
    }
  }

  return (
    <>
      <div className="sticky top-14 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-5 py-2.5">
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon-sm" onClick={goDashboard} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <span
              className="ml-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg"
              style={{ backgroundColor: `${board.color}1f` }}
            >
              {board.emoji}
            </span>

            <BoardTitle board={board} onSave={(title) => updateBoard(board.id, { title })} />

            <div className="flex-1" />

            <Menu
              ariaLabel="Ações do mapa"
              widthClassName="w-56"
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Ações do mapa">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
              items={[
                {
                  label: 'Editar mapa',
                  icon: <Pencil className="h-3.5 w-3.5" />,
                  onSelect: () => setEditOpen(true),
                },
                {
                  label: 'Duplicar mapa',
                  icon: <Copy className="h-3.5 w-3.5" />,
                  onSelect: () => void duplicate(),
                },
                {
                  label: 'Exportar Markdown',
                  icon: <FileText className="h-3.5 w-3.5" />,
                  separatorBefore: true,
                  disabled: exporting,
                  onSelect: () => void exportMap('markdown'),
                },
                {
                  label: 'Exportar PDF',
                  icon: <FileDown className="h-3.5 w-3.5" />,
                  disabled: exporting,
                  onSelect: () => void exportMap('pdf'),
                },
                {
                  label: 'Arquivar mapa',
                  icon: <Archive className="h-3.5 w-3.5" />,
                  separatorBefore: true,
                  onSelect: () => void archiveBoard(),
                },
                {
                  label: 'Excluir mapa',
                  icon: <Trash2 className="h-3.5 w-3.5" />,
                  danger: true,
                  onSelect: () => setDeleteOpen(true),
                },
              ]}
            />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-8 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{progress?.percent ?? 0}%</span>
            <ProgressBar value={progress?.percent ?? 0} className="h-1 max-w-[140px] flex-1" />
            <span>
              {progress?.done ?? 0} de {progress?.total ?? 0} tópicos
            </span>
            {progress && progress.remainingMinutes > 0 ? (
              <>
                <span className="text-border">·</span>
                <span>~{formatMinutes(progress.remainingMinutes)} restantes</span>
              </>
            ) : null}
            {board.description ? (
              <span className="hidden max-w-[280px] truncate text-muted-foreground/80 sm:block">
                {board.description}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-28 pt-5">
        {(progress?.total ?? 0) > 0 ? (
          next ? (
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/[0.045] p-4 shadow-sm sm:flex-row sm:items-center">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <Flag className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                  Continue daqui
                  {nextIsSub ? (
                    <span className="rounded bg-primary/12 px-1.5 py-0.5 text-[9px] tracking-normal">
                      subtópico
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-[14.5px] font-semibold text-foreground">
                  {next.title}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  {phaseName ? <span>{phaseName}</span> : null}
                  {next.estimatedMinutes > 0 ? (
                    <>
                      <span className="text-border">·</span>
                      <span>{formatDurationShort(next.estimatedMinutes)}</span>
                    </>
                  ) : null}
                  {next.status === 'studying' ? (
                    <>
                      <span className="text-border">·</span>
                      <span className="text-amber-600 dark:text-amber-400">em andamento</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setSelectedId(next.id)}>
                  Abrir
                </Button>
                <Button variant="primary" size="sm" onClick={() => void completeNext()}>
                  <Check className="h-3.5 w-3.5" />
                  Concluir
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-success/30 bg-success/[0.06] p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-success">
                  Trilha concluída
                </div>
                <div className="mt-0.5 text-[14px] font-medium text-foreground">
                  Você percorreu todos os tópicos deste mapa. Que tal revisar ou adicionar um novo
                  destino?
                </div>
              </div>
            </div>
          )
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar neste mapa… (Ctrl+F)"
              className="h-8 w-full rounded-lg border border-border bg-card pl-8 pr-2.5 text-[12.5px] shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as NodeStatus | 'all')}
            className="h-8 rounded-lg border border-border bg-card px-2 text-[12px] text-foreground shadow-sm outline-none focus:border-ring"
            aria-label="Filtrar por status"
          >
            <option value="all">Todos os status</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={collapseAll}
              title="Recolher tudo"
              aria-label="Recolher tudo"
            >
              <ChevronsDownUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed(new Set())}
              title="Expandir tudo"
              aria-label="Expandir tudo"
            >
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </div>

          <div className="ml-auto">
            <Segmented<Zoom>
              value={zoom}
              onChange={persistZoom}
              options={[
                { value: 'comfort', label: 'Conforto' },
                { value: 'compact', label: 'Compacto' },
              ]}
            />
          </div>
        </div>

        <Timeline
          detail={detail}
          query={query}
          statusFilter={statusFilter}
          zoom={zoom}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onOpenNode={setSelectedId}
        />
      </main>

      {selected ? (
        <NodeDrawer key={selected.id} node={selected} detail={detail} onClose={() => setSelectedId(null)} />
      ) : null}

      <BoardFormDialog open={editOpen} onClose={() => setEditOpen(false)} board={board} />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Excluir este mapa?"
        confirmLabel="Excluir definitivamente"
        description={
          <>
            O mapa <strong className="text-foreground">“{board.title}”</strong> e todos os seus
            tópicos, recursos e anotações serão apagados. Não dá para desfazer.
          </>
        }
        onConfirm={() => {
          setDeleteOpen(false)
          void deleteBoard(board.id)
            .then(() => toast.success('Mapa excluído'))
            .catch((error) =>
              toast.error('Não foi possível excluir', { description: errorMessage(error) }),
            )
        }}
      />
    </>
  )
}

function parentTrail(node: RoadmapNode, nodes: RoadmapNode[]): string {
  const names: string[] = []
  let cursor: RoadmapNode | undefined = node
  while (cursor?.parentId) {
    cursor = nodes.find((candidate) => candidate.id === cursor?.parentId)
    if (cursor) names.unshift(cursor.title)
  }
  return names.join(' / ')
}

function BoardTitle({ board, onSave }: { board: Board; onSave: (title: string) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(board.title)

  useEffect(() => {
    if (!editing) setDraft(board.title)
  }, [board.title, editing])

  const commit = async () => {
    const next = draft.trim()
    setEditing(false)
    if (!next) {
      setDraft(board.title)
      return
    }
    if (next === board.title) return
    try {
      await onSave(next)
    } catch (error) {
      setDraft(board.title)
      toast.error('Não foi possível renomear', { description: errorMessage(error) })
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={80}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            setDraft(board.title)
            setEditing(false)
          }
        }}
        className="min-w-0 max-w-[360px] flex-1 rounded-md border border-ring bg-card px-2 py-0.5 font-display text-[16px] font-semibold text-foreground outline-none"
        aria-label="Título do mapa"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Clique para renomear"
      className="min-w-0 max-w-[50%] truncate rounded-md px-1 py-0.5 text-left font-display text-[16px] font-semibold leading-tight text-foreground transition-colors hover:bg-muted sm:max-w-[360px]"
    >
      {board.title}
    </button>
  )
}

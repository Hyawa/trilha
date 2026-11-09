import { useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Copy,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Board, BoardSummary } from '@shared/types'
import { formatDurationShort, formatRelative } from '@shared/logic'
import { useAppStore } from '@/store/useAppStore'
import { cn, errorMessage, pluralize } from '@/lib/utils'
import { BoardFormDialog } from '@/components/BoardFormDialog'
import { Button, ConfirmDialog, Eyebrow, Menu, type MenuItem } from '@/components/ui'

function matches(board: BoardSummary, query: string): boolean {
  const term = query.trim().toLowerCase()
  if (!term) return true
  return (
    board.title.toLowerCase().includes(term) ||
    (board.description ?? '').toLowerCase().includes(term)
  )
}

export function Dashboard() {
  const boards = useAppStore((state) => state.boards)
  const openBoard = useAppStore((state) => state.openBoard)
  const duplicateBoard = useAppStore((state) => state.duplicateBoard)
  const updateBoard = useAppStore((state) => state.updateBoard)
  const deleteBoard = useAppStore((state) => state.deleteBoard)

  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Board | null>(null)
  const [deleting, setDeleting] = useState<BoardSummary | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const activeBoards = useMemo(
    () => boards.filter((board) => !board.archived && matches(board, query)),
    [boards, query],
  )
  const archivedBoards = useMemo(
    () => boards.filter((board) => board.archived && matches(board, query)),
    [boards, query],
  )
  const totalActive = boards.filter((board) => !board.archived).length

  const handleDuplicate = async (board: BoardSummary) => {
    try {
      await duplicateBoard(board.id)
      toast.success('Mapa duplicado', { description: `"${board.title}" foi copiado.` })
    } catch (error) {
      toast.error('Não foi possível duplicar', { description: errorMessage(error) })
    }
  }

  const handleArchive = async (board: BoardSummary, archived: boolean) => {
    try {
      await updateBoard(board.id, { archived })
      toast.success(archived ? 'Mapa arquivado' : 'Mapa restaurado')
    } catch (error) {
      toast.error('Não foi possível atualizar', { description: errorMessage(error) })
    }
  }

  const openEdit = (board: Board) => {
    setEditing(board)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
  }

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-9 sm:pt-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <Eyebrow>Biblioteca</Eyebrow>
          <h1 className="mt-1.5 font-display text-[32px] leading-[1.1] tracking-tight text-foreground sm:text-[38px]">
            Seus mapas de estudo
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {totalActive === 0
              ? 'Um assunto, um caminho. Crie uma trilha do primeiro passo até o objetivo.'
              : `${pluralize(totalActive, 'mapa ativo', 'mapas ativos')} na sua biblioteca. Continue de onde parou.`}
          </p>
        </div>

        <Button variant="primary" onClick={() => setFormOpen(true)} className="self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Novo mapa
        </Button>
      </div>

      <div className="mt-7 flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar mapas…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring"
          />
        </div>
        <span className="hidden text-[12px] text-muted-foreground sm:block">
          {activeBoards.length} de {totalActive}
        </span>
      </div>

      {activeBoards.length === 0 ? (
        <div className="mt-6">
          {totalActive === 0 ? (
            <EmptyLibrary onCreate={() => setFormOpen(true)} />
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-card/50 px-6 py-14 text-center">
              <p className="text-sm font-medium text-foreground">Nenhum mapa encontrado</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Tente outro termo ou limpe a busca.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setQuery('')}>
                Limpar busca
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeBoards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onOpen={() => void openBoard(board.id)}
              onEdit={() => openEdit(board)}
              onDuplicate={() => void handleDuplicate(board)}
              onArchive={() => void handleArchive(board, true)}
              onDelete={() => setDeleting(board)}
            />
          ))}
        </div>
      )}

      {archivedBoards.length > 0 ? (
        <section className="mt-12">
          <button
            type="button"
            onClick={() => setShowArchived((value) => !value)}
            className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', showArchived ? 'rotate-0' : '-rotate-90')}
            />
            Arquivados ({archivedBoards.length})
          </button>

          {showArchived ? (
            <div className="mt-3 space-y-2">
              {archivedBoards.map((board) => (
                <div
                  key={board.id}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5"
                >
                  <span className="text-lg opacity-70">{board.emoji}</span>
                  <button
                    type="button"
                    onClick={() => void openBoard(board.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium text-foreground">
                      {board.title}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {board.percent}% · {formatRelative(board.updatedAt)}
                    </span>
                  </button>
                  <Menu
                    ariaLabel={`Ações de ${board.title}`}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    }
                    items={[
                      {
                        label: 'Restaurar',
                        icon: <ArchiveRestore className="h-3.5 w-3.5" />,
                        onSelect: () => void handleArchive(board, false),
                      },
                      {
                        label: 'Excluir',
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        danger: true,
                        separatorBefore: true,
                        onSelect: () => setDeleting(board),
                      },
                    ]}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <BoardFormDialog open={formOpen} onClose={closeForm} board={editing} />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Excluir mapa?"
        confirmLabel="Excluir definitivamente"
        description={
          deleting ? (
            <>
              O mapa <strong className="text-foreground">“{deleting.title}”</strong> e todos os seus
              tópicos, recursos e anotações serão apagados. Não dá para desfazer.
            </>
          ) : null
        }
        onConfirm={() => {
          if (!deleting) return
          const target = deleting
          setDeleting(null)
          void deleteBoard(target.id)
            .then(() => toast.success('Mapa excluído'))
            .catch((error) => toast.error('Não foi possível excluir', { description: errorMessage(error) }))
        }}
      />
    </main>
  )
}

function BoardCard({
  board,
  onOpen,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  board: BoardSummary
  onOpen: () => void
  onEdit: () => void
  onDuplicate: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const items: MenuItem[] = [
    { label: 'Abrir mapa', icon: <Layers className="h-3.5 w-3.5" />, onSelect: onOpen },
    { label: 'Editar detalhes', icon: <Pencil className="h-3.5 w-3.5" />, onSelect: onEdit },
    { label: 'Duplicar', icon: <Copy className="h-3.5 w-3.5" />, onSelect: onDuplicate },
    { label: 'Arquivar', icon: <Archive className="h-3.5 w-3.5" />, onSelect: onArchive },
    {
      label: 'Excluir',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      onSelect: onDelete,
      danger: true,
      separatorBefore: true,
    },
  ]

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-line hover:shadow-md">
      <div className="h-1.5 w-full" style={{ backgroundColor: board.color }} />

      <button type="button" onClick={onOpen} className="block w-full px-5 pb-5 pt-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <span
            className="grid h-11 w-11 place-items-center rounded-xl text-2xl"
            style={{ backgroundColor: `${board.color}1f` }}
          >
            {board.emoji}
          </span>
          <span className="mt-1 pr-7 text-[11px] font-medium text-muted-foreground/80">
            {formatRelative(board.updatedAt)}
          </span>
        </div>

        <h3 className="mt-3.5 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
          {board.title}
        </h3>
        <p className="mt-1 line-clamp-2 min-h-[32px] text-[12.5px] leading-snug text-muted-foreground">
          {board.description || 'Sem descrição — abra para montar a trilha.'}
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {board.nodeCount > 0
                ? `${board.doneCount} de ${board.nodeCount} tópicos`
                : 'Trilha ainda vazia'}
            </span>
            <span className="font-semibold text-foreground">{board.percent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${board.percent}%`, backgroundColor: board.color }}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{board.nodeCount === 0 ? 'Comece a trilha' : 'Continue de onde parou'}</span>
          <span>
            {board.nodeCount > 0 && board.percent < 100
              ? `~${formatDurationShort(board.remainingMinutes)} restantes`
              : board.percent === 100
                ? 'Concluído'
                : '—'}
          </span>
        </div>
      </button>

      <div className="absolute right-3 top-4 z-10">
        <Menu
          ariaLabel={`Ações de ${board.title}`}
          widthClassName="w-48"
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Mais ações"
              className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          }
          items={items}
        />
      </div>
    </article>
  )
}

function EmptyLibrary({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-line bg-card/60 px-6 py-16 text-center">
      <svg
        viewBox="0 0 140 64"
        className="mx-auto mb-5 h-16 w-36 text-primary/50"
        fill="none"
        aria-hidden
      >
        <path
          d="M8 52C26 52 24 16 44 16s18 36 40 36 16-30 40-30"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="3 5"
          strokeLinecap="round"
        />
        <circle cx="8" cy="52" r="4" fill="currentColor" />
        <circle cx="44" cy="16" r="4" fill="currentColor" />
        <circle cx="84" cy="52" r="4" fill="currentColor" />
        <circle cx="132" cy="22" r="5" fill="currentColor" />
      </svg>
      <h2 className="font-display text-2xl text-foreground">Sua primeira trilha começa aqui</h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        Escolha um assunto e desenhe o caminho em fases: comece pelo básico, avance em ordem e veja
        o progresso crescer de estação em estação.
      </p>
      <Button variant="primary" className="mt-6" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Criar meu primeiro mapa
      </Button>
    </div>
  )
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  GripVertical,
  Layers,
  ListChecks,
  Minus,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  formatDurationShort,
  groupNodes,
  groupResources,
  summarize,
} from '@shared/logic'
import type { BoardDetail, ChecklistItem, NodeStatus, Resource, RoadmapNode } from '@shared/types'
import { STATUS_LABELS } from '@shared/types'
import { useAppStore } from '@/store/useAppStore'
import { STATUS_ORDER, STATUS_STYLES } from '@/lib/status'
import { cn, errorMessage } from '@/lib/utils'
import { Button, ConfirmDialog, Input, Menu, ProgressRing } from '@/components/ui'

export type Zoom = 'comfort' | 'compact'

interface TimelineContextValue {
  boardId: string
  nodes: RoadmapNode[]
  phases: RoadmapNode[]
  childrenMap: Map<string | null, RoadmapNode[]>
  resources: Map<string, Resource[]>
  checklist: Map<string, ChecklistItem[]>
  zoom: Zoom
  filterActive: boolean
  collapsed: Set<string>
  toggleCollapse: (id: string) => void
  openNode: (id: string) => void
  requestDelete: (node: RoadmapNode) => void
  matches: (node: RoadmapNode) => boolean
}

const TimelineContext = createContext<TimelineContextValue | null>(null)

function useTimeline(): TimelineContextValue {
  const value = useContext(TimelineContext)
  if (!value) throw new Error('TimelineContext ausente')
  return value
}

async function run(action: Promise<unknown>): Promise<void> {
  try {
    await action
  } catch (error) {
    toast.error('Não foi possível salvar', { description: errorMessage(error) })
  }
}

export function Timeline({
  detail,
  query,
  statusFilter,
  zoom,
  collapsed,
  onToggleCollapse,
  onOpenNode,
}: {
  detail: BoardDetail
  query: string
  statusFilter: NodeStatus | 'all'
  zoom: Zoom
  collapsed: Set<string>
  onToggleCollapse: (id: string) => void
  onOpenNode: (id: string) => void
}) {
  const boardId = detail.board.id
  const nodes = detail.nodes
  const reorderNodes = useAppStore((state) => state.reorderNodes)
  const deleteNode = useAppStore((state) => state.deleteNode)
  const [deleteTarget, setDeleteTarget] = useState<RoadmapNode | null>(null)

  const childrenMap = useMemo(() => groupNodes(nodes), [nodes])
  const resourcesMap = useMemo(() => groupResources(detail.resources), [detail.resources])
  const checklistMap = useMemo(() => groupResources(detail.checklist), [detail.checklist])

  const filterActive = query.trim().length > 0 || statusFilter !== 'all'
  const term = query.trim().toLowerCase()

  const matches = useCallback(
    (node: RoadmapNode) => {
      if (statusFilter !== 'all' && node.status !== statusFilter) return false
      if (!term) return true
      return (
        node.title.toLowerCase().includes(term) ||
        (node.description ?? '').toLowerCase().includes(term) ||
        (node.notes ?? '').toLowerCase().includes(term)
      )
    },
    [statusFilter, term],
  )

  const phases = useMemo(() => childrenMap.get(null) ?? [], [childrenMap])
  const children = useCallback(
    (parentId: string | null) => childrenMap.get(parentId) ?? [],
    [childrenMap],
  )

  const visiblePhases = useMemo(() => {
    if (!filterActive) return phases
    return phases.filter((phase) => {
      if (matches(phase)) return true
      return children(phase.id).some(
        (topic) => matches(topic) || children(topic.id).some((sub) => matches(sub)),
      )
    })
  }, [phases, filterActive, matches, children])

  const contextValue = useMemo<TimelineContextValue>(
    () => ({
      boardId,
      nodes,
      phases,
      childrenMap,
      resources: resourcesMap,
      checklist: checklistMap,
      zoom,
      filterActive,
      collapsed,
      toggleCollapse: onToggleCollapse,
      openNode: onOpenNode,
      requestDelete: setDeleteTarget,
      matches,
    }),
    [
      boardId,
      nodes,
      phases,
      childrenMap,
      resourcesMap,
      checklistMap,
      zoom,
      filterActive,
      collapsed,
      onToggleCollapse,
      onOpenNode,
      matches,
    ],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !active.data.current) return
    const parentId = (active.data.current.parentId ?? null) as string | null
    if (!over.data.current || (over.data.current.parentId ?? null) !== parentId) return

    const siblings = children(parentId)
    const oldIndex = siblings.findIndex((node) => node.id === active.id)
    const newIndex = siblings.findIndex((node) => node.id === over.id)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return

    const ordered = arrayMove(siblings, oldIndex, newIndex).map((node) => node.id)
    void run(reorderNodes(parentId, ordered))
  }

  return (
    <TimelineContext.Provider value={contextValue}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {phases.length === 0 ? (
          <Onboarding />
        ) : (
          <div className="space-y-1.5">
            <SortableContext items={visiblePhases.map((phase) => phase.id)} strategy={verticalListSortingStrategy}>
              {visiblePhases.map((phase) => (
                <PhaseRow key={phase.id} phase={phase} />
              ))}
            </SortableContext>
          </div>
        )}

        {filterActive && visiblePhases.length === 0 && phases.length > 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-line bg-card/50 px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum tópico combina com a busca ou o filtro.
          </div>
        ) : null}

        <NewPhase />
      </DndContext>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={
          deleteTarget?.kind === 'phase'
            ? 'Excluir fase?'
            : deleteTarget?.kind === 'topic'
              ? 'Excluir tópico?'
              : 'Excluir subtópico?'
        }
        description={
          deleteTarget ? (
            <>
              <strong className="text-foreground">“{deleteTarget.title}”</strong>
              {deleteTarget.kind !== 'subtopic'
                ? ' e tudo o que está dentro dele'
                : ''}{' '}
              será apagado, incluindo recursos e anotações.
            </>
          ) : null
        }
        onConfirm={() => {
          if (!deleteTarget) return
          const target = deleteTarget
          setDeleteTarget(null)
          void run(deleteNode(target.id))
        }}
      />
    </TimelineContext.Provider>
  )
}

// ------------------------------------------------------------------ phase

function PhaseRow({ phase }: { phase: RoadmapNode }) {
  const ctx = useTimeline()
  const updateNode = useAppStore((state) => state.updateNode)
  const completeSubtree = useAppStore((state) => state.completeSubtree)
  const reorderNodes = useAppStore((state) => state.reorderNodes)

  const [addingTopic, setAddingTopic] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: phase.id,
    data: { parentId: null },
  })

  const topics = ctx.childrenMap.get(phase.id) ?? []
  const progress = summarize(ctx.nodes, phase.id)
  const phases = ctx.childrenMap.get(null) ?? []
  const index = phases.findIndex((item) => item.id === phase.id)
  const expanded = !ctx.collapsed.has(phase.id) || ctx.filterActive

  const forceAll = !ctx.filterActive || ctx.matches(phase)
  const visibleTopics = forceAll
    ? topics
    : topics.filter(
        (topic) =>
          ctx.matches(topic) ||
          (ctx.childrenMap.get(topic.id) ?? []).some((sub) => ctx.matches(sub)),
      )

  const movePhase = (direction: -1 | 1) => {
    const next = index + direction
    if (next < 0 || next >= phases.length) return
    const ids = phases.map((item) => item.id)
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    void run(reorderNodes(null, ids))
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group/phase relative', isDragging && 'z-20 opacity-70')}
    >
      <span className="timeline-spine absolute bottom-0 left-[22px] top-2 w-px" aria-hidden />

      <div className="flex items-start gap-3.5">
        <div className="relative z-10 shrink-0 rounded-full bg-background p-0.5">
          <ProgressRing percent={progress.percent} size={42} stroke={3}>
            <span className="text-[12px] font-semibold tabular-nums text-foreground">{index + 1}</span>
          </ProgressRing>
        </div>

        <div className="min-w-0 flex-1 pb-7">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Fase {index + 1}
                </span>
                <button
                  type="button"
                  {...attributes}
                  {...listeners}
                  aria-label="Arrastar fase"
                  className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/0 transition-colors group-hover/phase:text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
              </div>

              <EditableText
                value={phase.title}
                onSave={(title) => updateNode(phase.id, { title })}
                className="font-display text-[17px] font-semibold leading-snug text-foreground"
                inputClassName="font-display text-[17px] font-semibold"
              />

              <button
                type="button"
                onClick={() => ctx.openNode(phase.id)}
                className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>
                  {progress.done}/{progress.total} tópicos
                </span>
                <span className="text-border">·</span>
                <span>{progress.percent}%</span>
                {progress.remainingMinutes > 0 ? (
                  <>
                    <span className="text-border">·</span>
                    <span>~{formatDurationShort(progress.remainingMinutes)}</span>
                  </>
                ) : null}
                {phase.description ? (
                  <>
                    <span className="text-border">·</span>
                    <span className="max-w-[260px] truncate">{phase.description}</span>
                  </>
                ) : null}
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => ctx.toggleCollapse(phase.id)}
                aria-label={expanded ? 'Recolher fase' : 'Expandir fase'}
                title={expanded ? 'Recolher fase' : 'Expandir fase'}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', !expanded && '-rotate-90')} />
              </Button>

              <Menu
                ariaLabel={`Ações da fase ${phase.title}`}
                widthClassName="w-56"
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label="Ações da fase">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                }
                items={[
                  {
                    label: 'Detalhes da fase',
                    icon: <Pencil className="h-3.5 w-3.5" />,
                    onSelect: () => ctx.openNode(phase.id),
                  },
                  {
                    label: 'Adicionar tópico',
                    icon: <Plus className="h-3.5 w-3.5" />,
                    onSelect: () => {
                      if (ctx.collapsed.has(phase.id) && !ctx.filterActive) ctx.toggleCollapse(phase.id)
                      setAddingTopic(true)
                    },
                  },
                  {
                    label: 'Concluir fase',
                    icon: <Check className="h-3.5 w-3.5" />,
                    disabled: progress.total === 0 || progress.done === progress.total,
                    onSelect: () => void run(completeSubtree(phase.id)),
                  },
                  {
                    label: 'Mover para cima',
                    icon: <ArrowUp className="h-3.5 w-3.5" />,
                    disabled: index <= 0,
                    separatorBefore: true,
                    onSelect: () => movePhase(-1),
                  },
                  {
                    label: 'Mover para baixo',
                    icon: <ArrowDown className="h-3.5 w-3.5" />,
                    disabled: index >= phases.length - 1,
                    onSelect: () => movePhase(1),
                  },
                  {
                    label: 'Excluir fase',
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    danger: true,
                    separatorBefore: true,
                    onSelect: () => ctx.requestDelete(phase),
                  },
                ]}
              />
            </div>
          </div>

          {expanded ? (
            <div className="mt-2.5">
              <SortableContext
                items={visibleTopics.map((topic) => topic.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {visibleTopics.map((topic) => (
                    <TopicRow key={topic.id} topic={topic} phase={phase} forceAll={forceAll} />
                  ))}
                </div>
              </SortableContext>

              {addingTopic ? (
                <div className="mt-2">
                  <InlineAdd
                    placeholder="Nome do tópico…"
                    submitLabel="Adicionar tópico"
                    onCancel={() => setAddingTopic(false)}
                    onCreate={async (title) => {
                      await useAppStore.getState().createNode({
                        boardId: ctx.boardId,
                        parentId: phase.id,
                        kind: 'topic',
                        title,
                      })
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingTopic(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar tópico
                </button>
              )}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {topics.length === 0 ? 'Nenhum tópico ainda' : `${topics.length} tópico(s) recolhido(s)`}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ topic

function TopicRow({
  topic,
  phase,
  forceAll,
}: {
  topic: RoadmapNode
  phase: RoadmapNode
  forceAll: boolean
}) {
  const ctx = useTimeline()
  const updateNode = useAppStore((state) => state.updateNode)
  const moveNode = useAppStore((state) => state.moveNode)
  const [addingSubtopic, setAddingSubtopic] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
    data: { parentId: phase.id },
  })

  const subs = ctx.childrenMap.get(topic.id) ?? []
  const resources = ctx.resources.get(topic.id) ?? []
  const checklist = ctx.checklist.get(topic.id) ?? []
  const doneChecklist = checklist.filter((item) => item.done).length
  const showSubs = (!ctx.collapsed.has(topic.id) || ctx.filterActive) && subs.length > 0
  const visibleSubs =
    !ctx.filterActive || forceAll || ctx.matches(topic) ? subs : subs.filter((sub) => ctx.matches(sub))
  const statusStyle = STATUS_STYLES[topic.status]
  const compact = ctx.zoom === 'compact'

  const otherPhases = ctx.phases.filter((item) => item.id !== phase.id)

  const toggleDone = () => {
    void run(updateNode(topic.id, { status: topic.status === 'done' ? 'todo' : 'done' }))
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group/topic', isDragging && 'z-20 opacity-70')}
    >
      <div
        onClick={() => ctx.openNode(topic.id)}
        className={cn(
          'relative overflow-hidden rounded-xl border bg-card shadow-sm transition-colors hover:border-line',
          topic.status === 'done' ? 'border-border/70' : 'border-border',
        )}
      >
        <span className={cn('absolute bottom-0 left-0 top-0 w-[3px]', statusStyle.stripe)} aria-hidden />

        <div className={cn('flex items-start gap-2.5 pl-3.5 pr-2', compact ? 'py-2' : 'py-2.5')}>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Arrastar tópico"
            className="mt-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground/0 transition-colors group-hover/topic:text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          <StatusButton status={topic.status} onToggle={toggleDone} />

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <EditableText
                value={topic.title}
                onSave={(title) => updateNode(topic.id, { title })}
                className={cn(
                  'text-[13.5px] font-medium leading-snug text-foreground',
                  topic.status === 'done' && 'text-muted-foreground line-through',
                  topic.status === 'skipped' && 'text-muted-foreground',
                )}
              />
              {topic.estimatedMinutes > 0 ? (
                <span className="flex shrink-0 items-center gap-1 text-[10.5px] tabular-nums text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDurationShort(topic.estimatedMinutes)}
                </span>
              ) : null}
            </div>

            {!compact && topic.description ? (
              <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
                {topic.description}
              </p>
            ) : null}

            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] text-muted-foreground">
              {resources.length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {resources.length}
                </span>
              ) : null}
              {checklist.length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3 w-3" />
                  {doneChecklist}/{checklist.length}
                </span>
              ) : null}
              {topic.notes?.trim() ? (
                <span className="inline-flex items-center gap-1">
                  <StickyNote className="h-3 w-3" />
                  notas
                </span>
              ) : null}
              {subs.length > 0 ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    ctx.toggleCollapse(topic.id)
                  }}
                  className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronDown
                    className={cn('h-3 w-3 transition-transform', !showSubs && '-rotate-90')}
                  />
                  {subs.length} subtópico(s)
                </button>
              ) : null}
            </div>
          </div>

          <Menu
            ariaLabel={`Ações de ${topic.title}`}
            widthClassName="w-56"
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Ações do tópico"
                className="opacity-0 transition-opacity group-hover/topic:opacity-100 focus-visible:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
            items={[
              {
                label: 'Detalhes e anotações',
                icon: <Pencil className="h-3.5 w-3.5" />,
                onSelect: () => ctx.openNode(topic.id),
              },
              {
                label: 'Adicionar subtópico',
                icon: <Plus className="h-3.5 w-3.5" />,
                onSelect: () => setAddingSubtopic(true),
              },
              ...STATUS_ORDER.map((status) => ({
                label: status === 'done' ? 'Concluído' : STATUS_LABELS[status],
                icon: (
                  <span className={cn('h-2 w-2 rounded-full', STATUS_STYLES[status].dot)} />
                ),
                separatorBefore: status === 'todo',
                onSelect: () => void run(updateNode(topic.id, { status })),
              })),
              ...(otherPhases.length > 0
                ? otherPhases.map((target, targetIndex) => ({
                    label: `→ ${target.title}`,
                    icon: <Layers className="h-3.5 w-3.5" />,
                    separatorBefore: targetIndex === 0,
                    onSelect: () => void run(moveNode(topic.id, target.id)),
                  }))
                : []),
              {
                label: 'Excluir tópico',
                icon: <Trash2 className="h-3.5 w-3.5" />,
                danger: true,
                separatorBefore: true,
                onSelect: () => ctx.requestDelete(topic),
              },
            ]}
          />
        </div>

        {showSubs ? (
          <div
            className="ml-9 border-l border-line pb-2 pl-3 pr-2.5"
            onClick={(event) => event.stopPropagation()}
          >
            <SortableContext
              items={visibleSubs.map((sub) => sub.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {visibleSubs.map((sub) => (
                  <SubtopicRow key={sub.id} sub={sub} topic={topic} />
                ))}
              </div>
            </SortableContext>

            {addingSubtopic ? (
              <div className="mt-1.5">
                <InlineAdd
                  compact
                  placeholder="Nome do subtópico…"
                  submitLabel="Adicionar"
                  onCancel={() => setAddingSubtopic(false)}
                  onCreate={async (title) => {
                    await useAppStore.getState().createNode({
                      boardId: ctx.boardId,
                      parentId: topic.id,
                      kind: 'subtopic',
                      title,
                    })
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setAddingSubtopic(true)
                }}
                className="mt-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                Subtópico
              </button>
            )}
          </div>
        ) : subs.length > 0 ? (
          <div className="ml-9 border-t border-border/60 py-1 pl-3 text-[10.5px] text-muted-foreground">
            {subs.length} subtópico(s) oculto(s)
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ subtopic

function SubtopicRow({ sub, topic }: { sub: RoadmapNode; topic: RoadmapNode }) {
  const ctx = useTimeline()
  const updateNode = useAppStore((state) => state.updateNode)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sub.id,
    data: { parentId: topic.id },
  })

  const labels = STATUS_LABELS

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group/sub flex items-center gap-1.5 rounded-lg px-1 py-1', isDragging && 'z-20 opacity-70')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar subtópico"
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/0 transition-colors group-hover/sub:text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3" />
      </button>

      <StatusButton
        status={sub.status}
        small
        onToggle={() =>
          void run(updateNode(sub.id, { status: sub.status === 'done' ? 'todo' : 'done' }))
        }
      />

      <div className="min-w-0 flex-1">
        <EditableText
          value={sub.title}
          onSave={(title) => updateNode(sub.id, { title })}
          className={cn(
            'text-[12.5px] leading-snug text-foreground/90',
            sub.status === 'done' && 'text-muted-foreground line-through',
            sub.status === 'skipped' && 'text-muted-foreground',
          )}
          inputClassName="text-[12.5px]"
        />
      </div>

      {sub.estimatedMinutes > 0 ? (
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/80">
          {formatDurationShort(sub.estimatedMinutes)}
        </span>
      ) : null}

      <Menu
        ariaLabel={`Ações de ${sub.title}`}
        widthClassName="w-48"
        trigger={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Ações do subtópico"
            className="h-6 w-6 opacity-0 transition-opacity group-hover/sub:opacity-100 focus-visible:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        }
        items={[
          {
            label: 'Detalhes e anotações',
            icon: <Pencil className="h-3.5 w-3.5" />,
            onSelect: () => ctx.openNode(sub.id),
          },
          ...STATUS_ORDER.map((status) => ({
            label: labels[status],
            icon: <span className={cn('h-2 w-2 rounded-full', STATUS_STYLES[status].dot)} />,
            separatorBefore: status === 'todo',
            onSelect: () => void run(updateNode(sub.id, { status })),
          })),
          {
            label: 'Excluir subtópico',
            icon: <Trash2 className="h-3.5 w-3.5" />,
            danger: true,
            separatorBefore: true,
            onSelect: () => ctx.requestDelete(sub),
          },
        ]}
      />
    </div>
  )
}

// ------------------------------------------------------------------ atoms

function StatusButton({
  status,
  onToggle,
  small = false,
}: {
  status: NodeStatus
  onToggle: () => void
  small?: boolean
}) {
  const style = STATUS_STYLES[status]
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      title={
        status === 'done'
          ? 'Concluído — clique para reabrir'
          : `${STATUS_LABELS[status]} — clique para concluir`
      }
      aria-label={status === 'done' ? 'Reabrir tópico' : 'Marcar como concluído'}
      className={cn(
        'mt-0.5 grid shrink-0 place-items-center rounded-full border-[1.5px] transition-colors',
        small ? 'h-[15px] w-[15px]' : 'h-[18px] w-[18px]',
        style.dot,
        status !== 'done' && 'hover:border-primary/70',
      )}
    >
      {status === 'done' ? (
        <Check className={cn('text-primary-foreground', small ? 'h-2.5 w-2.5' : 'h-3 w-3')} strokeWidth={3.5} />
      ) : status === 'studying' || status === 'review' ? (
        <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
      ) : status === 'skipped' ? (
        <Minus className={cn('text-muted-foreground', small ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
      ) : null}
    </button>
  )
}

function EditableText({
  value,
  onSave,
  className,
  inputClassName,
}: {
  value: string
  onSave: (value: string) => Promise<unknown>
  className?: string
  inputClassName?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const commit = async () => {
    const next = draft.trim()
    setEditing(false)
    if (!next) {
      setDraft(value)
      return
    }
    if (next === value) return
    try {
      await onSave(next)
    } catch (error) {
      setDraft(value)
      toast.error('Não foi possível renomear', { description: errorMessage(error) })
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={160}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setDraft(value)
            setEditing(false)
          }
        }}
        className={cn(
          'w-full rounded border border-ring bg-card px-1.5 py-0.5 text-foreground outline-none',
          inputClassName,
        )}
      />
    )
  }

  return (
    <button
      type="button"
      title="Clique para renomear"
      onClick={(event) => {
        event.stopPropagation()
        setEditing(true)
      }}
      className={cn('block max-w-full truncate text-left', className)}
    >
      {value}
    </button>
  )
}

function InlineAdd({
  placeholder,
  submitLabel,
  onCreate,
  onCancel,
  compact = false,
}: {
  placeholder: string
  submitLabel: string
  onCreate: (title: string) => Promise<void>
  onCancel: () => void
  compact?: boolean
}) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    const title = value.trim()
    if (!title || saving) return
    setSaving(true)
    try {
      await onCreate(title)
      setValue('')
      inputRef.current?.focus()
    } catch (error) {
      toast.error('Não foi possível criar', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={cn('flex items-center gap-1.5', compact ? 'py-0.5' : 'rounded-xl border border-ring/40 bg-card p-2')}
      onClick={(event) => event.stopPropagation()}
    >
      <Input
        ref={inputRef}
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void submit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        className={cn(compact ? 'h-7 text-[12px]' : 'h-8 text-[13px]')}
      />
      <Button
        variant="primary"
        size="sm"
        onClick={() => void submit()}
        disabled={!value.trim() || saving}
      >
        {submitLabel}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Cancelar">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function NewPhase() {
  const ctx = useTimeline()
  const [adding, setAdding] = useState(false)

  if (!adding) {
    return (
      <div className="mt-3 pl-[56px]">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-card/40 px-4 py-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Nova fase
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 pl-[56px]">
      <InlineAdd
        placeholder="Ex.: Fundamentos, Prática, Projeto final…"
        submitLabel="Criar fase"
        onCancel={() => setAdding(false)}
        onCreate={async (title) => {
          await useAppStore.getState().createNode({
            boardId: ctx.boardId,
            parentId: null,
            kind: 'phase',
            title,
          })
        }}
      />
    </div>
  )
}

function Onboarding() {
  const ctx = useTimeline()
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-sm">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Layers className="h-6 w-6" />
      </div>
      <h2 className="font-display text-2xl text-foreground">Comece pela primeira fase</h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        Pense no caminho: o que vem primeiro, o que vem depois e como você sabe que chegou ao fim.
        Cada fase vira uma estação da sua trilha.
      </p>
      <div className="mx-auto mt-5 max-w-md">
        <InlineAdd
          placeholder="Ex.: Fundamentos, Prática, Projeto final…"
          submitLabel="Criar fase"
          onCancel={() => undefined}
          onCreate={async (title) => {
            await useAppStore.getState().createNode({
              boardId: ctx.boardId,
              parentId: null,
              kind: 'phase',
              title,
            })
          }}
        />
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  ListChecks,
  Paperclip,
  Play,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { markdownToHtml } from '@shared/print'
import { formatDurationShort } from '@shared/logic'
import {
  RESOURCE_LABELS,
  STATUS_LABELS,
  type BoardDetail,
  type NodeKind,
  type NodePatch,
  type NodeStatus,
  type ResourceKind,
  type RoadmapNode,
} from '@shared/types'
import { useAppStore } from '@/store/useAppStore'
import { STATUS_ORDER, STATUS_STYLES } from '@/lib/status'
import { cn, errorMessage, normalizeUrl } from '@/lib/utils'
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  ProgressBar,
  Segmented,
  Textarea,
} from '@/components/ui'

const KIND_LABEL: Record<NodeKind, string> = {
  phase: 'Fase',
  topic: 'Tópico',
  subtopic: 'Subtópico',
}

const RESOURCE_ICONS: Record<ResourceKind, typeof Link2> = {
  link: Link2,
  video: Play,
  book: BookOpen,
  pdf: FileText,
  other: Globe,
}

function useAutosave(
  initial: string,
  commit: (value: string) => Promise<unknown>,
  delay = 800,
) {
  const [value, setValue] = useState(initial)
  const valueRef = useRef(value)
  valueRef.current = value
  const savedRef = useRef(initial)
  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    if (value === savedRef.current) return
    const timer = setTimeout(() => {
      const next = value
      void commitRef
        .current(next)
        .then(() => {
          savedRef.current = next
        })
        .catch((error) => {
          toast.error('Não foi possível salvar', { description: errorMessage(error) })
        })
    }, delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  useEffect(() => {
    return () => {
      if (valueRef.current !== savedRef.current) {
        void commitRef.current(valueRef.current).catch(() => undefined)
      }
    }
  }, [])

  const flush = async () => {
    if (value === savedRef.current) return
    try {
      await commitRef.current(value)
      savedRef.current = value
    } catch (error) {
      toast.error('Não foi possível salvar', { description: errorMessage(error) })
    }
  }

  return { value, setValue, flush }
}

export function NodeDrawer({
  node,
  detail,
  onClose,
}: {
  node: RoadmapNode
  detail: BoardDetail
  onClose: () => void
}) {
  const updateNode = useAppStore((state) => state.updateNode)
  const deleteNode = useAppStore((state) => state.deleteNode)
  const addChecklist = useAppStore((state) => state.addChecklist)
  const updateChecklist = useAppStore((state) => state.updateChecklist)
  const deleteChecklist = useAppStore((state) => state.deleteChecklist)
  const addResource = useAppStore((state) => state.addResource)
  const deleteResource = useAppStore((state) => state.deleteResource)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [notesTab, setNotesTab] = useState<'write' | 'preview'>('write')
  const [checklistText, setChecklistText] = useState('')
  const [resourceKind, setResourceKind] = useState<ResourceKind>('link')
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceUrl, setResourceUrl] = useState('')
  const [addingResource, setAddingResource] = useState(false)
  const [timeValue, setTimeValue] = useState(String(node.estimatedMinutes || ''))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleteOpen) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [onClose, deleteOpen])

  const patch = (data: NodePatch) => updateNode(node.id, data).catch((error) => {
    toast.error('Não foi possível salvar', { description: errorMessage(error) })
    throw error
  })

  const title = useAutosave(node.title, (value) => {
    const next = value.trim()
    if (!next) return Promise.resolve()
    return patch({ title: next })
  }, 700)

  const description = useAutosave(node.description ?? '', (value) =>
    patch({ description: value.trim() ? value : null }),
  )

  const notes = useAutosave(node.notes ?? '', (value) =>
    patch({ notes: value.trim() ? value : null }),
  )

  const checklist = detail.checklist.filter((item) => item.nodeId === node.id)
  const resources = detail.resources.filter((item) => item.nodeId === node.id)
  const doneChecklist = checklist.filter((item) => item.done).length
  const parents: string[] = []
  let cursor: RoadmapNode | undefined = node
  while (cursor?.parentId) {
    cursor = detail.nodes.find((candidate) => candidate.id === cursor?.parentId)
    if (cursor) parents.unshift(cursor.title)
  }

  const commitTime = async (raw?: string) => {
    const parsed = Math.max(0, Math.min(100000, Math.round(Number(raw ?? timeValue) || 0)))
    setTimeValue(parsed ? String(parsed) : '')
    if (parsed === node.estimatedMinutes) return
    try {
      await updateNode(node.id, { estimatedMinutes: parsed })
    } catch (error) {
      toast.error('Não foi possível salvar o tempo', { description: errorMessage(error) })
    }
  }

  const submitChecklist = async () => {
    const text = checklistText.trim()
    if (!text) return
    setChecklistText('')
    try {
      await addChecklist({ nodeId: node.id, text })
    } catch (error) {
      toast.error('Não foi possível adicionar', { description: errorMessage(error) })
    }
  }

  const submitResource = async () => {
    const titleValue = resourceTitle.trim()
    const urlValue = normalizeUrl(resourceUrl)
    if (!titleValue || !urlValue) {
      toast.error('Preencha o nome e o link do recurso.')
      return
    }
    try {
      const parsed = new URL(urlValue)
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) throw new Error('protocolo')
    } catch {
      toast.error('O link parece inválido.', { description: 'Use um endereço http(s) válido.' })
      return
    }
    try {
      await addResource({ nodeId: node.id, kind: resourceKind, title: titleValue, url: urlValue })
      setResourceTitle('')
      setResourceUrl('')
      setAddingResource(false)
    } catch (error) {
      toast.error('Não foi possível adicionar', { description: errorMessage(error) })
    }
  }

  const openResource = (url: string) => {
    window.trilha.app.openExternal(url).catch((error) => {
      toast.error('Não foi possível abrir o link', { description: errorMessage(error) })
    })
  }

  const setStatus = (status: NodeStatus) => {
    void updateNode(node.id, { status }).catch((error) => {
      toast.error('Não foi possível mudar o status', { description: errorMessage(error) })
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes de ${node.title}`}
          className="animate-sheet-in absolute right-0 top-0 flex h-full w-full max-w-[520px] flex-col border-l border-border bg-background shadow-2xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5">{KIND_LABEL[node.kind]}</span>
                {parents.length > 0 ? (
                  <span className="truncate normal-case tracking-normal text-muted-foreground/80">
                    {parents.join(' / ')}
                  </span>
                ) : null}
              </div>
              <input
                value={title.value}
                onChange={(event) => title.setValue(event.target.value)}
                onBlur={() => void title.flush()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                }}
                maxLength={160}
                className="mt-1.5 w-full rounded-md bg-transparent py-0.5 font-display text-[20px] font-semibold leading-snug text-foreground outline-none focus:bg-card focus:px-2 focus:ring-1 focus:ring-ring"
                aria-label="Título"
              />
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeleteOpen(true)}
                aria-label="Excluir"
                className="text-muted-foreground hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((status) => {
                const style = STATUS_STYLES[status]
                const active = node.status === status
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatus(status)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                      active
                        ? 'border-transparent ' + style.chip
                        : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
                    {STATUS_LABELS[status]}
                  </button>
                )
              })}
            </div>

            <div className="mt-5 space-y-5">
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Tempo estimado
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {node.estimatedMinutes > 0 ? formatDurationShort(node.estimatedMinutes) : 'sem estimativa'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={5}
                    value={timeValue}
                    onChange={(event) => setTimeValue(event.target.value)}
                    onBlur={() => void commitTime()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    className="h-8 w-24"
                    placeholder="min"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[15, 30, 45, 60, 90, 120].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => {
                          setTimeValue(String(minutes))
                          void commitTime(String(minutes))
                        }}
                        className={cn(
                          'rounded-md border px-1.5 py-1 text-[10.5px] tabular-nums transition-colors',
                          node.estimatedMinutes === minutes
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {minutes}m
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-1.5">
                <span className="text-[12px] font-medium text-foreground">Descrição</span>
                <Textarea
                  rows={2}
                  value={description.value}
                  onChange={(event) => description.setValue(event.target.value)}
                  onBlur={() => void description.flush()}
                  placeholder="O que este tópico cobre? O que você quer saber ao terminar?"
                  className="min-h-[52px]"
                />
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                    <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                    Checklist
                  </span>
                  {checklist.length > 0 ? (
                    <span className="text-[11px] text-muted-foreground">
                      {doneChecklist}/{checklist.length}
                    </span>
                  ) : null}
                </div>

                {checklist.length > 0 ? (
                  <div className="space-y-1">
                    <ProgressBar
                      value={checklist.length ? (doneChecklist / checklist.length) * 100 : 0}
                      className="mb-2 h-1"
                    />
                    {checklist.map((item) => (
                      <div
                        key={item.id}
                        className="group/item flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/60"
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={item.done}
                          onClick={() => void updateChecklist(item.id, { done: !item.done })}
                          className={cn(
                            'flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                            item.done
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-line bg-card hover:border-muted-foreground/60',
                          )}
                        >
                          {item.done ? (
                            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                              <path d="M2 6.5L4.5 9L10 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : null}
                        </button>
                        <span
                          className={cn(
                            'min-w-0 flex-1 text-[12.5px] leading-snug',
                            item.done ? 'text-muted-foreground line-through' : 'text-foreground',
                          )}
                        >
                          {item.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => void deleteChecklist(item.id)}
                          aria-label="Remover item"
                          className="rounded p-0.5 text-muted-foreground/0 transition-colors group-hover/item:text-muted-foreground hover:text-danger"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center gap-1.5">
                  <Input
                    value={checklistText}
                    onChange={(event) => setChecklistText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void submitChecklist()
                      }
                    }}
                    placeholder="Adicionar item…"
                    className="h-8 text-[12.5px]"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void submitChecklist()}
                    disabled={!checklistText.trim()}
                    aria-label="Adicionar item"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    Recursos
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px]"
                    onClick={() => setAddingResource((value) => !value)}
                  >
                    <Plus className="h-3 w-3" />
                    Adicionar
                  </Button>
                </div>

                {resources.length > 0 ? (
                  <div className="space-y-1">
                    {resources.map((resource) => {
                      const Icon = RESOURCE_ICONS[resource.kind] ?? Link2
                      let domain = ''
                      try {
                        domain = new URL(resource.url).hostname.replace(/^www\./, '')
                      } catch {
                        domain = resource.url
                      }
                      return (
                        <div
                          key={resource.id}
                          className="group/res flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
                        >
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <button
                            type="button"
                            onClick={() => openResource(resource.url)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate text-[12.5px] font-medium text-foreground">
                              {resource.title}
                            </span>
                            <span className="block truncate text-[10.5px] text-muted-foreground">
                              {RESOURCE_LABELS[resource.kind]} · {domain}
                            </span>
                          </button>
                          <ExternalLink
                            className="h-3 w-3 shrink-0 text-muted-foreground/40"
                            aria-hidden
                          />
                          <button
                            type="button"
                            onClick={() => void deleteResource(resource.id)}
                            aria-label="Remover recurso"
                            className="rounded p-0.5 text-muted-foreground/0 transition-colors group-hover/res:text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[11.5px] text-muted-foreground">
                    Vídeos, artigos, livros, PDFs — guarde tudo o que usar neste tópico.
                  </p>
                )}

                {addingResource ? (
                  <div className="space-y-1.5 rounded-xl border border-border bg-card p-2.5">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={resourceKind}
                        onChange={(event) => setResourceKind(event.target.value as ResourceKind)}
                        className="h-8 rounded-md border border-border bg-card px-1.5 text-[12px] outline-none focus:border-ring"
                        aria-label="Tipo de recurso"
                      >
                        {(Object.keys(RESOURCE_LABELS) as ResourceKind[]).map((kind) => (
                          <option key={kind} value={kind}>
                            {RESOURCE_LABELS[kind]}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={resourceTitle}
                        onChange={(event) => setResourceTitle(event.target.value)}
                        placeholder="Nome do recurso"
                        className="h-8 text-[12.5px]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={resourceUrl}
                        onChange={(event) => setResourceUrl(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void submitResource()
                          }
                        }}
                        placeholder="https://…"
                        className="h-8 text-[12.5px]"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={() => void submitResource()}
                        disabled={!resourceTitle.trim() || !resourceUrl.trim()}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                    <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                    Anotações
                  </span>
                  <Segmented
                    value={notesTab}
                    onChange={setNotesTab}
                    options={[
                      { value: 'write', label: 'Escrever' },
                      { value: 'preview', label: 'Ver' },
                    ]}
                  />
                </div>

                {notesTab === 'write' ? (
                  <Textarea
                    rows={7}
                    value={notes.value}
                    onChange={(event) => notes.setValue(event.target.value)}
                    onBlur={() => void notes.flush()}
                    placeholder="Resumos, dúvidas, insights… Aceita Markdown (**negrito**, listas, links)."
                    className="min-h-[140px]"
                  />
                ) : (
                  <div className="min-h-[140px] rounded-lg border border-border bg-card px-3.5 py-3">
                    {notes.value.trim() ? (
                      <div
                        className="notes-preview"
                        dangerouslySetInnerHTML={{ __html: markdownToHtml(notes.value) }}
                      />
                    ) : (
                      <p className="text-[12.5px] text-muted-foreground">Nada anotado ainda.</p>
                    )}
                  </div>
                )}
              </section>

              <div className="flex items-center justify-between border-t border-border pt-3 text-[10.5px] text-muted-foreground">
                <span>
                  Criado em{' '}
                  {new Date(node.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span>salvo automaticamente</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Excluir ${KIND_LABEL[node.kind].toLowerCase()}?`}
        confirmLabel="Excluir"
        description={
          <>
            <strong className="text-foreground">“{node.title}”</strong> será apagado
            {node.kind !== 'subtopic' ? ' junto com tudo o que está dentro' : ''}, incluindo
            recursos e anotações.
          </>
        }
        onConfirm={() => {
          setDeleteOpen(false)
          onClose()
          void deleteNode(node.id).catch((error) =>
            toast.error('Não foi possível excluir', { description: errorMessage(error) }),
          )
        }}
      />
    </>
  )
}

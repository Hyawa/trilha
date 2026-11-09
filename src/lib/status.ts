import type { NodeStatus } from '@shared/types'

export const STATUS_ORDER: NodeStatus[] = ['todo', 'studying', 'review', 'done', 'skipped']

export const STATUS_STYLES: Record<
  NodeStatus,
  { dot: string; chip: string; label: string; stripe: string }
> = {
  todo: {
    dot: 'border-line bg-card',
    chip: 'bg-muted text-muted-foreground',
    label: 'A fazer',
    stripe: 'bg-line',
  },
  studying: {
    dot: 'border-amber-500 bg-amber-500',
    chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    label: 'Estudando',
    stripe: 'bg-amber-500',
  },
  review: {
    dot: 'border-sky-600 bg-sky-600',
    chip: 'bg-sky-600/15 text-sky-700 dark:text-sky-300',
    label: 'Revisar',
    stripe: 'bg-sky-600',
  },
  done: {
    dot: 'border-primary bg-primary',
    chip: 'bg-primary/12 text-primary',
    label: 'Concluído',
    stripe: 'bg-primary',
  },
  skipped: {
    dot: 'border-muted-foreground/40 bg-muted',
    chip: 'bg-muted text-muted-foreground line-through',
    label: 'Pulado',
    stripe: 'bg-muted-foreground/30',
  },
}

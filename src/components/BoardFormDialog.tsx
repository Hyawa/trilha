import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BOARD_COLORS, BOARD_EMOJIS, type Board } from '@shared/types'
import { useAppStore } from '@/store/useAppStore'
import { cn, errorMessage } from '@/lib/utils'
import { Button, Field, Input, Modal, Textarea } from '@/components/ui'

export function BoardFormDialog({
  open,
  onClose,
  board,
}: {
  open: boolean
  onClose: () => void
  board?: Board | null
}) {
  const createBoard = useAppStore((state) => state.createBoard)
  const updateBoard = useAppStore((state) => state.updateBoard)
  const openBoard = useAppStore((state) => state.openBoard)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState<string>(BOARD_EMOJIS[0])
  const [color, setColor] = useState<string>(BOARD_COLORS[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(board?.title ?? '')
    setDescription(board?.description ?? '')
    setEmoji(board?.emoji ?? BOARD_EMOJIS[0])
    setColor(board?.color ?? BOARD_COLORS[0])
  }, [open, board])

  const submit = async () => {
    if (!title.trim()) {
      toast.error('Dê um nome ao mapa.')
      return
    }
    setSaving(true)
    try {
      if (board) {
        await updateBoard(board.id, {
          title: title.trim(),
          description: description.trim() || null,
          emoji,
          color,
        })
        toast.success('Mapa atualizado.')
      } else {
        const created = await createBoard({
          title: title.trim(),
          description: description.trim() || null,
          emoji,
          color,
        })
        onClose()
        await openBoard(created.id)
      }
      onClose()
    } catch (error) {
      toast.error('Não foi possível salvar', { description: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={board ? 'Editar mapa' : 'Novo mapa'}
      description={
        board
          ? 'Ajuste o visual e a descrição deste mapa.'
          : 'Dê um nome ao assunto que você quer aprender do zero ao fim.'
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Salvando…' : board ? 'Salvar' : 'Criar mapa'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Field label="Assunto" hint={`${title.length}/80`}>
          <Input
            autoFocus
            value={title}
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Programação do zero, Inglês, Anatomia…"
          />
        </Field>

        <Field label="Descrição" hint="opcional">
          <Textarea
            rows={2}
            value={description}
            maxLength={280}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="O que você quer alcançar com este mapa?"
          />
        </Field>

        <div className="space-y-2">
          <span className="text-[13px] font-medium text-foreground">Ícone</span>
          <div className="flex flex-wrap gap-1.5">
            {BOARD_EMOJIS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEmoji(option)}
                aria-label={`Ícone ${option}`}
                aria-pressed={emoji === option}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-lg border text-lg transition-colors',
                  emoji === option
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                {option}
              </button>
            ))}
            <input
              value={emoji}
              onChange={(event) => setEmoji(event.target.value.slice(0, 4))}
              className="h-9 w-14 rounded-lg border border-border bg-card px-2 text-center text-sm outline-none focus:border-ring"
              aria-label="Outro ícone"
              placeholder="+"
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[13px] font-medium text-foreground">Cor da trilha</span>
          <div className="flex flex-wrap gap-2">
            {BOARD_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-label={`Cor ${option}`}
                aria-pressed={color === option}
                style={{ backgroundColor: option }}
                className={cn(
                  'h-7 w-7 rounded-full transition-transform',
                  color === option
                    ? 'ring-2 ring-ring ring-offset-2 ring-offset-card'
                    : 'hover:scale-110',
                )}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

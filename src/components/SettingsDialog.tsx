import { useEffect, useState } from 'react'
import {
  Database,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  Monitor,
  Moon,
  Sun,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/useAppStore'
import type { ThemePreference } from '@shared/types'
import { errorMessage } from '@/lib/utils'
import { Button, Eyebrow, Modal, Segmented } from '@/components/ui'

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const version = useAppStore((state) => state.version)
  const refreshBoards = useAppStore((state) => state.refreshBoards)
  const refreshDetail = useAppStore((state) => state.refreshDetail)
  const goDashboard = useAppStore((state) => state.goDashboard)

  const [dataPath, setDataPath] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!open) return
    window.trilha.app
      .dataPath()
      .then(setDataPath)
      .catch(() => setDataPath(''))
  }, [open])

  const handleExport = async () => {
    setWorking(true)
    try {
      const path = await window.trilha.exporter.backup()
      if (path) toast.success('Backup salvo', { description: path })
    } catch (error) {
      toast.error('Não foi possível exportar', { description: errorMessage(error) })
    } finally {
      setWorking(false)
    }
  }

  const handleImport = async (mode: 'merge' | 'replace') => {
    setImportOpen(false)
    setWorking(true)
    try {
      const result = await window.trilha.exporter.importBackup(mode)
      if (!result) return
      if (mode === 'replace') goDashboard()
      await refreshBoards()
      if (mode === 'merge') await refreshDetail()
      toast.success(
        mode === 'replace' ? 'Backup restaurado' : 'Backup mesclado',
        { description: `${result.boards} mapa(s) e ${result.nodes} tópico(s).` },
      )
    } catch (error) {
      toast.error('Não foi possível importar', { description: errorMessage(error) })
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Configurações" description="Preferências e seus dados locais." size="md">
        <div className="space-y-6">
          <section className="space-y-3">
            <Eyebrow>Aparência</Eyebrow>
            <Segmented<ThemePreference>
              value={theme}
              onChange={(value) => void setTheme(value)}
              options={[
                { value: 'light', label: 'Claro', icon: <Sun className="h-3.5 w-3.5" /> },
                { value: 'dark', label: 'Escuro', icon: <Moon className="h-3.5 w-3.5" /> },
                { value: 'system', label: 'Sistema', icon: <Monitor className="h-3.5 w-3.5" /> },
              ]}
            />
          </section>

          <section className="space-y-3">
            <Eyebrow>Backup</Eyebrow>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Seus mapas ficam somente neste computador. Exporte um arquivo JSON para guardar uma
              cópia ou levar para outra máquina.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={working}>
                <Download className="h-3.5 w-3.5" />
                Exportar backup
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={working}>
                <Upload className="h-3.5 w-3.5" />
                Importar backup
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <Eyebrow>Dados</Eyebrow>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-start gap-2.5">
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-foreground">Banco de dados local</div>
                  <div className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {dataPath || '…'}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.trilha.app.revealData()}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Abrir pasta
                </Button>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <Eyebrow>Sobre</Eyebrow>
            <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              Trilha {version ? `v${version}` : ''} · funciona 100% offline
            </div>
            <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
              <FileText className="h-4 w-4" />
              Exporte mapas em Markdown ou PDF pelo menu do mapa.
            </div>
          </section>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar backup"
        description="Escolha como os mapas do arquivo devem entrar no Trilha."
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={() => void handleImport('replace')}>
              Substituir tudo
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleImport('merge')}>
              Mesclar
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Mesclar</strong> adiciona os mapas do backup aos que
            já existem, sem alterar nada do que está aqui.
          </p>
          <p>
            <strong className="text-foreground">Substituir tudo</strong> apaga todos os mapas atuais
            e deixa apenas os do arquivo. Essa ação não pode ser desfeita.
          </p>
        </div>
      </Modal>
    </>
  )
}

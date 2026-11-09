import { useState } from 'react'
import { Check, Compass, Monitor, Moon, Settings, Sun } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import type { ThemePreference } from '@shared/types'
import { Button, Menu } from '@/components/ui'
import { SettingsDialog } from '@/components/SettingsDialog'

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Tema claro', icon: Sun },
  { value: 'dark', label: 'Tema escuro', icon: Moon },
  { value: 'system', label: 'Seguir o sistema', icon: Monitor },
]

export function TopBar() {
  const goDashboard = useAppStore((state) => state.goDashboard)
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const CurrentThemeIcon =
    theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-5">
          <button
            type="button"
            onClick={goDashboard}
            className="group flex items-center gap-2.5 rounded-lg py-1 pr-2 text-left"
            aria-label="Ir para a biblioteca de mapas"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-6">
              <Compass className="h-[18px] w-[18px]" />
            </span>
            <span className="font-display text-[19px] font-semibold leading-none tracking-tight text-foreground">
              Trilha
            </span>
            <span className="mt-0.5 hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:inline">
              mapas de estudo
            </span>
          </button>

          <div className="flex-1" />

          <Menu
            ariaLabel="Escolher tema"
            widthClassName="w-48"
            trigger={
              <Button variant="ghost" size="icon" aria-label="Tema da interface">
                <CurrentThemeIcon className="h-[18px] w-[18px]" />
              </Button>
            }
            items={THEME_OPTIONS.map((option) => ({
              label: option.label,
              icon:
                theme === option.value ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <option.icon className="h-3.5 w-3.5" />
                ),
              onSelect: () => void setTheme(option.value),
            }))}
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Configurações"
          >
            <Settings className="h-[18px] w-[18px]" />
          </Button>
        </div>
      </header>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}

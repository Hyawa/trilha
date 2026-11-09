import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { applyTheme, useAppStore } from '@/store/useAppStore'
import { TopBar } from '@/components/TopBar'
import { Dashboard } from '@/pages/Dashboard'
import { BoardPage } from '@/pages/BoardPage'
import { Compass } from 'lucide-react'

export default function App() {
  const ready = useAppStore((state) => state.ready)
  const view = useAppStore((state) => state.view)
  const theme = useAppStore((state) => state.theme)
  const init = useAppStore((state) => state.init)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    const update = () => setDark(document.documentElement.classList.contains('dark'))
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
          <Compass className="h-6 w-6" />
        </span>
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          Abrindo sua trilha…
        </span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopBar />
      {view.name === 'dashboard' ? (
        <Dashboard />
      ) : (
        <BoardPage key={view.id} />
      )}
      <Toaster
        theme={dark ? 'dark' : 'light'}
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ className: 'font-sans' }}
      />
    </div>
  )
}

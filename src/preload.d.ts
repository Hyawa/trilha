import type { TrilhaApi } from '../shared/api'

declare global {
  interface Window {
    trilha: TrilhaApi
  }
}

export {}

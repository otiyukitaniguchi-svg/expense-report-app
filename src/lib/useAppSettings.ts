import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export interface AppSettings {
  submission_start_day: number
  submission_end_day: number
}

export function useAppSettings(): {
  settings: AppSettings | null
  loading: boolean
  refresh: () => Promise<void>
} {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh(): Promise<void> {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('*').eq('id', true).single()
    setSettings((data as AppSettings) ?? null)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  return { settings, loading, refresh }
}

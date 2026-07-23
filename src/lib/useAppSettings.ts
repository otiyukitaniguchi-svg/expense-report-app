import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export interface AppSettings {
  submission_start_day: number
  submission_end_day: number
  fuel_price_per_liter: number
  fuel_efficiency_km_per_liter: number
  seasonal_index_summer: number
  seasonal_index_winter: number
  expense_rules: string
}

// 4月〜10月は夏場、11月〜3月は冬場の季節指数を適用する
export function seasonalIndexForDate(dateStr: string, settings: AppSettings): number {
  const month = Number(dateStr.slice(5, 7))
  const isSummer = month >= 4 && month <= 10
  return isSummer ? settings.seasonal_index_summer : settings.seasonal_index_winter
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

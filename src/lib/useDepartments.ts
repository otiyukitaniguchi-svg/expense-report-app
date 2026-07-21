import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { Department } from './types'

export function useDepartments(): {
  departments: Department[]
  loading: boolean
  refresh: () => Promise<void>
} {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh(): Promise<void> {
    setLoading(true)
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepartments((data as Department[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  return { departments, loading, refresh }
}

import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { DepartmentApprover } from './types'

interface Row {
  department_id: string
  approver_id: string
  profiles: { name: string } | null
}

export function useDepartmentApprovers(): {
  entries: DepartmentApprover[]
  loading: boolean
  refresh: () => Promise<void>
} {
  const [entries, setEntries] = useState<DepartmentApprover[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh(): Promise<void> {
    setLoading(true)
    const { data } = await supabase
      .from('department_approvers')
      .select('department_id, approver_id, profiles(name)')
    const list = ((data as unknown as Row[]) ?? []).map((row) => ({
      department_id: row.department_id,
      approver_id: row.approver_id,
      approver_name: row.profiles?.name ?? '-'
    }))
    setEntries(list)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  return { entries, loading, refresh }
}

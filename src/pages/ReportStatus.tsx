import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ReportTable } from '../components/ReportTable'
import type { ExpenseReport } from '../lib/types'

interface Props {
  userId: string
  onOpenReport: (id: string) => void
}

export function ReportStatus({ userId, onOpenReport }: Props): JSX.Element {
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)

  async function load(): Promise<void> {
    setLoading(true)
    const { data } = await supabase
      .from('expense_reports')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['submitted', 'approved', 'rejected'])
      .order('submitted_at', { ascending: false })
    setReports((data as ExpenseReport[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [userId])

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">申請状況</h1>
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <ReportTable
          reports={reports}
          loading={loading}
          emptyMessage="提出済みの申請はまだありません。"
          onOpenReport={onOpenReport}
        />
      </div>
    </div>
  )
}

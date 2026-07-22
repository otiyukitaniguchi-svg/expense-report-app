import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ReportTable } from '../components/ReportTable'
import { formatMonthLabel, monthOfDateStr, recentMonths } from '../lib/month'
import type { ExpenseReport } from '../lib/types'

interface Props {
  userId: string
  onOpenReport: (id: string) => void
}

export function ReportStatus({ userId, onOpenReport }: Props): JSX.Element {
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState('all')

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

  const filteredReports =
    monthFilter === 'all'
      ? reports
      : reports.filter((r) => (r.report_month ?? monthOfDateStr(r.submitted_at)) === monthFilter)

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">申請状況</h1>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
        >
          <option value="all">すべて</option>
          {recentMonths(12).map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <ReportTable
          reports={filteredReports}
          loading={loading}
          emptyMessage="提出済みの申請はまだありません。"
          onOpenReport={onOpenReport}
        />
      </div>
    </div>
  )
}

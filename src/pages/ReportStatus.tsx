import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { StatusBadge } from '../components/StatusBadge'
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
  const [error, setError] = useState<string | null>(null)

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

  async function deleteReport(id: string): Promise<void> {
    if (!window.confirm('この申請を削除しますか?この操作は取り消せません。')) return
    setError(null)
    const { error: deleteError } = await supabase.from('expense_reports').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    load()
  }

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

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-sm text-gray-400">読み込み中…</p>
        ) : filteredReports.length === 0 ? (
          <p className="p-8 text-sm text-gray-400">提出済みの申請はまだありません。</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                <th className="p-4">タイトル</th>
                <th className="p-4">状態</th>
                <th className="p-4">合計金額</th>
                <th className="p-4">提出日</th>
                <th className="p-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td
                    className="cursor-pointer p-4 font-medium text-blue-600 hover:underline"
                    onClick={() => onOpenReport(r.id)}
                  >
                    {r.title}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-4 text-gray-700">{r.total_amount.toLocaleString()} 円</td>
                  <td className="p-4 text-gray-500">
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('ja-JP') : '-'}
                  </td>
                  <td className="p-4 text-right">
                    {r.status === 'rejected' && (
                      <button
                        onClick={() => deleteReport(r.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline"
                      >
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

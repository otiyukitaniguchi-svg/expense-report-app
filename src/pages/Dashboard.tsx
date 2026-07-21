import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { StatusBadge } from '../components/StatusBadge'
import type { ExpenseReport } from '../lib/types'

interface Props {
  userId: string
  onOpenReport: (id: string | null) => void
}

export function Dashboard({ userId, onOpenReport }: Props): JSX.Element {
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [loading, setLoading] = useState(true)

  async function load(): Promise<void> {
    setLoading(true)
    const { data } = await supabase
      .from('expense_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setReports((data as ExpenseReport[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [userId])

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">経費申請一覧</h1>
        <button
          onClick={() => onOpenReport(null)}
          className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          + 新規申請
        </button>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-sm text-gray-400">読み込み中…</p>
        ) : reports.length === 0 ? (
          <p className="p-8 text-sm text-gray-400">申請はまだありません。「+ 新規申請」から作成してください。</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                <th className="p-4">タイトル</th>
                <th className="p-4">状態</th>
                <th className="p-4">合計金額</th>
                <th className="p-4">提出日</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onOpenReport(r.id)}
                  className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="p-4 font-medium text-blue-600">{r.title}</td>
                  <td className="p-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-4 text-gray-700">{r.total_amount.toLocaleString()} 円</td>
                  <td className="p-4 text-gray-500">
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('ja-JP') : '-'}
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

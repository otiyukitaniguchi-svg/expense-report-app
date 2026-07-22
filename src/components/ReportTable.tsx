import { StatusBadge } from './StatusBadge'
import type { ExpenseReport } from '../lib/types'

interface Props {
  reports: ExpenseReport[]
  loading: boolean
  emptyMessage: string
  onOpenReport: (id: string) => void
}

export function ReportTable({ reports, loading, emptyMessage, onOpenReport }: Props): JSX.Element {
  if (loading) return <p className="p-8 text-sm text-gray-400">読み込み中…</p>
  if (reports.length === 0) return <p className="p-8 text-sm text-gray-400">{emptyMessage}</p>

  return (
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
  )
}

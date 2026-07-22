import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { StatusBadge } from '../components/StatusBadge'
import type { ExpenseReport } from '../lib/types'

interface Props {
  userId: string
  onOpenReport: (id: string) => void
}

export function Drafts({ userId, onOpenReport }: Props): JSX.Element {
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    const { data } = await supabase
      .from('expense_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
    setReports((data as ExpenseReport[]) ?? [])
    setSelectedIds(new Set())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [userId])

  function toggleOne(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(): void {
    setSelectedIds((prev) => (prev.size === reports.length ? new Set() : new Set(reports.map((r) => r.id))))
  }

  async function deleteOne(id: string): Promise<void> {
    if (!window.confirm('この申請を削除しますか?この操作は取り消せません。')) return
    setError(null)
    const { error: deleteError } = await supabase.from('expense_reports').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    load()
  }

  async function deleteSelected(): Promise<void> {
    if (selectedIds.size === 0) return
    if (!window.confirm(`選択した${selectedIds.size}件の申請を削除しますか?この操作は取り消せません。`)) return
    setDeleting(true)
    setError(null)
    const { error: deleteError } = await supabase
      .from('expense_reports')
      .delete()
      .in('id', Array.from(selectedIds))
    setDeleting(false)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    load()
  }

  const allSelected = reports.length > 0 && selectedIds.size === reports.length

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">申請</h1>
        {selectedIds.size > 0 && (
          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? '削除中…' : `選択した${selectedIds.size}件を削除`}
          </button>
        )}
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-sm text-gray-400">読み込み中…</p>
        ) : reports.length === 0 ? (
          <p className="p-8 text-sm text-gray-400">
            下書きの申請はありません。「新規登録」から作成してください。
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                <th className="w-10 p-4">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
                  />
                </th>
                <th className="p-4">タイトル</th>
                <th className="p-4">状態</th>
                <th className="p-4">合計金額</th>
                <th className="p-4">提出日</th>
                <th className="p-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
                    />
                  </td>
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
                  <td className="p-4">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => onOpenReport(r.id)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteOne(r.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline"
                      >
                        削除
                      </button>
                    </div>
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

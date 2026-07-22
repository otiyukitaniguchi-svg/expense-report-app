import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLookups } from '../lib/useLookups'
import { StatusBadge } from '../components/StatusBadge'
import { formatMonthLabel, monthOfDateStr, recentMonths } from '../lib/month'
import { buildSingleReportSlipHtml } from '../lib/pdfExport'
import type { ExpenseItem, ExpenseReport } from '../lib/types'

interface Props {
  userId: string
  userName: string
  onOpenReport: (id: string) => void
}

const statusLabels: Record<ExpenseReport['status'], string> = {
  draft: '下書き',
  submitted: '提出済み',
  approved: '承認済み',
  rejected: '差し戻し'
}

export function ReportStatus({ userId, userName, onOpenReport }: Props): JSX.Element {
  const { categories } = useLookups()
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [departmentName, setDepartmentName] = useState('-')
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState('all')
  const [generatingId, setGeneratingId] = useState<string | null>(null)
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

  useEffect(() => {
    supabase
      .from('profiles')
      .select('department_id, departments(name)')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        const departments = (data as { departments: { name: string } | null } | null)?.departments
        setDepartmentName(departments?.name ?? '-')
      })
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

  async function generatePdf(report: ExpenseReport): Promise<void> {
    // ポップアップブロックを避けるため、非同期処理の前にユーザー操作と同期して開く
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('ポップアップがブロックされました。ブラウザの設定でこのサイトのポップアップを許可してください。')
      return
    }
    setGeneratingId(report.id)
    setError(null)
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from('expense_items')
        .select('*')
        .eq('report_id', report.id)
        .order('date')
      if (itemsError) {
        setError(itemsError.message)
        printWindow.close()
        return
      }
      const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))
      const html = buildSingleReportSlipHtml({
        employeeName: userName,
        departmentName,
        statusLabel: statusLabels[report.status],
        submittedAtLabel: report.submitted_at
          ? new Date(report.submitted_at).toLocaleDateString('ja-JP')
          : '-',
        periodLabel: report.report_month
          ? formatMonthLabel(report.report_month)
          : report.title,
        items: ((itemsData as ExpenseItem[]) ?? []).map((i) => ({
          date: i.date,
          categoryName: (i.category_id && categoryNameById.get(i.category_id)) ?? '-',
          payee: i.payee ?? '',
          description: i.description,
          memo: i.memo ?? '',
          amount: Number(i.amount)
        }))
      })
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } finally {
      setGeneratingId(null)
    }
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
                <th className="p-4">申請者</th>
                <th className="p-4">日付</th>
                <th className="p-4">状態</th>
                <th className="p-4">合計金額</th>
                <th className="p-4">提出日</th>
                <th className="p-4">PDF化</th>
                <th className="p-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="p-4 font-medium text-gray-800">{userName}</td>
                  <td
                    className="cursor-pointer p-4 font-medium text-blue-600 hover:underline"
                    onClick={() => onOpenReport(r.id)}
                  >
                    {r.report_month ? formatMonthLabel(r.report_month) : r.title}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-4 text-gray-700">{r.total_amount.toLocaleString()} 円</td>
                  <td className="p-4 text-gray-500">
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('ja-JP') : '-'}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => generatePdf(r)}
                      disabled={generatingId === r.id}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                    >
                      {generatingId === r.id ? '作成中…' : 'PDF化'}
                    </button>
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

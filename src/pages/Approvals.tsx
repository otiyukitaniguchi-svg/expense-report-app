import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { StatusBadge } from '../components/StatusBadge'
import { useLookups } from '../lib/useLookups'
import { buildExpenseListHtml, type PdfListRow } from '../lib/pdfExport'
import type { ExpenseItem, ExpenseReport } from '../lib/types'

interface ReportWithOwner extends ExpenseReport {
  profiles: { name: string } | null
}

interface Props {
  managerId: string
  onOpenReport: (id: string) => void
}

export function Approvals({ managerId, onOpenReport }: Props): JSX.Element {
  const { categories, taxCategories } = useLookups()
  const [reports, setReports] = useState<ReportWithOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    const { data } = await supabase
      .from('expense_reports')
      .select('*, profiles!expense_reports_user_id_fkey(name)')
      .in('status', ['submitted', 'approved', 'rejected'])
      .order('submitted_at', { ascending: false })
    setReports((data as ReportWithOwner[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [managerId])

  async function decide(reportId: string, approve: boolean): Promise<void> {
    setError(null)
    const { error: updateError } = await supabase
      .from('expense_reports')
      .update({
        status: approve ? 'approved' : 'rejected',
        approved_by: managerId,
        approved_at: new Date().toISOString()
      })
      .eq('id', reportId)
    if (updateError) {
      setError(updateError.message)
      return
    }
    load()
  }

  async function exportPdf(): Promise<void> {
    if (reports.length === 0) return
    // ポップアップブロックを避けるため、非同期処理(await)の前にユーザー操作と同期して開く
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('ポップアップがブロックされました。ブラウザの設定でこのサイトのポップアップを許可してください。')
      return
    }
    setExporting(true)
    setError(null)
    try {
      const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))
      const taxNameById = new Map(taxCategories.map((t) => [t.id, t.name]))
      const reportById = new Map(reports.map((r) => [r.id, r]))

      const { data: items, error: itemsError } = await supabase
        .from('expense_items')
        .select('*')
        .in(
          'report_id',
          reports.map((r) => r.id)
        )
        .order('date')
      if (itemsError) {
        setError(itemsError.message)
        printWindow.close()
        return
      }

      const rows: PdfListRow[] = ((items as ExpenseItem[]) ?? []).map((item) => {
        const report = reportById.get(item.report_id)
        return {
          employeeName: report?.profiles?.name ?? '-',
          reportTitle: report?.title ?? '-',
          date: item.date,
          categoryName: (item.category_id && categoryNameById.get(item.category_id)) ?? '-',
          taxCategoryName: (item.tax_category_id && taxNameById.get(item.tax_category_id)) ?? '-',
          amount: Number(item.amount),
          payee: item.payee ?? '-',
          invoiceNumber: item.invoice_number ?? '-',
          description: item.description
        }
      })

      const html = buildExpenseListHtml(rows, '経費申請 明細一覧')
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">承認</h1>
        <button
          onClick={exportPdf}
          disabled={exporting || reports.length === 0}
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
        >
          {exporting ? '出力中…' : 'PDF出力(明細一覧を印刷)'}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-sm text-gray-400">読み込み中…</p>
        ) : reports.length === 0 ? (
          <p className="p-8 text-sm text-gray-400">対象の申請はありません。</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                <th className="p-4">申請者</th>
                <th className="p-4">タイトル</th>
                <th className="p-4">状態</th>
                <th className="p-4">合計金額</th>
                <th className="p-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="p-4 text-gray-700">{r.profiles?.name ?? '-'}</td>
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
                  <td className="p-4">
                    {r.status === 'submitted' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => decide(r.id, true)}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => decide(r.id, false)}
                          className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-600"
                        >
                          差し戻し
                        </button>
                      </div>
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

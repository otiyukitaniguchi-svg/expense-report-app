import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { StatusBadge } from '../components/StatusBadge'
import { useLookups } from '../lib/useLookups'
import { buildExpenseListHtml, type PdfListRow } from '../lib/pdfExport'
import { formatMonthLabel, monthOfDateStr, recentMonths } from '../lib/month'
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
  const [monthFilter, setMonthFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

  const filteredReports =
    monthFilter === 'all'
      ? reports
      : reports.filter((r) => (r.report_month ?? monthOfDateStr(r.submitted_at)) === monthFilter)

  async function decideSelected(approve: boolean): Promise<void> {
    const targetIds = approve
      ? filteredReports.filter((r) => selectedIds.has(r.id) && r.status === 'submitted').map((r) => r.id)
      : Array.from(selectedIds)
    if (targetIds.length === 0) return
    setError(null)
    const { error: updateError } = await supabase
      .from('expense_reports')
      .update({
        status: approve ? 'approved' : 'rejected',
        approved_by: managerId,
        approved_at: new Date().toISOString()
      })
      .in('id', targetIds)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSelectedIds(new Set())
    load()
  }

  async function removeSelected(): Promise<void> {
    if (selectedIds.size === 0) return
    if (!window.confirm(`選択した${selectedIds.size}件の申請を削除しますか?この操作は取り消せません。`)) return
    setError(null)
    const { error: deleteError } = await supabase
      .from('expense_reports')
      .delete()
      .in('id', Array.from(selectedIds))
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setSelectedIds(new Set())
    load()
  }

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll(): void {
    setSelectedIds((prev) =>
      prev.size === filteredReports.length ? new Set() : new Set(filteredReports.map((r) => r.id))
    )
  }

  async function exportPdf(): Promise<void> {
    if (filteredReports.length === 0) return
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
      const reportById = new Map(filteredReports.map((r) => [r.id, r]))

      const { data: items, error: itemsError } = await supabase
        .from('expense_items')
        .select('*')
        .in(
          'report_id',
          filteredReports.map((r) => r.id)
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
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">承認</h1>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-md border-2 border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700"
          >
            <option value="all">すべて</option>
            {recentMonths(12).map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleSelectAll}
            disabled={filteredReports.length === 0}
            className="rounded-md border-2 border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            全選択
          </button>
          <button
            onClick={() => decideSelected(true)}
            disabled={selectedIds.size === 0}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            選択承認{selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
          <button
            onClick={removeSelected}
            disabled={selectedIds.size === 0}
            className="rounded-md border-2 border-red-300 px-3 py-1.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            選択削除{selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
          <button
            onClick={exportPdf}
            disabled={exporting || filteredReports.length === 0}
            className="rounded-md border-2 border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            {exporting ? '出力中…' : 'PDF出力(明細一覧を印刷)'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border-2 border-gray-300 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-sm text-gray-500">読み込み中…</p>
        ) : filteredReports.length === 0 ? (
          <p className="p-8 text-sm text-gray-500">対象の申請はありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-base">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-100 text-sm font-bold text-gray-700">
                  <th className="w-8 p-4">
                    <input
                      type="checkbox"
                      checked={filteredReports.length > 0 && selectedIds.size === filteredReports.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-200"
                    />
                  </th>
                  <th className="p-4">申請者</th>
                  <th className="p-4">タイトル</th>
                  <th className="p-4">状態</th>
                  <th className="p-4">合計金額</th>
                  <th className="p-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((r) => (
                  <tr key={r.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelected(r.id)}
                        className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-200"
                      />
                    </td>
                    <td className="p-4 font-bold text-gray-900">{r.profiles?.name ?? '-'}</td>
                    <td
                      className="cursor-pointer p-4 font-bold text-blue-600 hover:underline"
                      onClick={() => onOpenReport(r.id)}
                    >
                      {r.title}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-4 font-bold text-gray-900">{r.total_amount.toLocaleString()} 円</td>
                    <td className="p-4">
                      {(r.status === 'submitted' || r.status === 'approved') && (
                        <div className="flex gap-2">
                          {r.status === 'submitted' && (
                            <button
                              onClick={() => decide(r.id, true)}
                              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                            >
                              承認
                            </button>
                          )}
                          <button
                            onClick={() => decide(r.id, false)}
                            className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-600"
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
          </div>
        )}
      </div>
    </div>
  )
}

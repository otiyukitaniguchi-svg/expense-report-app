import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLookups } from '../lib/useLookups'
import { useAppSettings } from '../lib/useAppSettings'
import { StatusBadge } from '../components/StatusBadge'
import { buildReportsPreviewHtml, type PdfReportSection } from '../lib/pdfExport'
import type { ExpenseItem, ExpenseReport } from '../lib/types'

interface Props {
  userId: string
  userName: string
  onOpenReport: (id: string) => void
}

export function Drafts({ userId, userName, onOpenReport }: Props): JSX.Element {
  const { categories, taxCategories } = useLookups()
  const { settings } = useAppSettings()
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [confirmCount, setConfirmCount] = useState(0)
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
    setAwaitingConfirm(false)
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
    setAwaitingConfirm(false)
  }

  function toggleAll(): void {
    setSelectedIds((prev) => (prev.size === reports.length ? new Set() : new Set(reports.map((r) => r.id))))
    setAwaitingConfirm(false)
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

  async function fetchSelectedItems(): Promise<ExpenseItem[] | null> {
    const { data, error: itemsError } = await supabase
      .from('expense_items')
      .select('*')
      .in('report_id', Array.from(selectedIds))
      .order('date')
    if (itemsError) {
      setError(itemsError.message)
      return null
    }
    return (data as ExpenseItem[]) ?? []
  }

  async function openPreview(): Promise<void> {
    if (selectedIds.size === 0) return
    // ポップアップブロックを避けるため、非同期処理の前にユーザー操作と同期して開く
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('ポップアップがブロックされました。ブラウザの設定でこのサイトのポップアップを許可してください。')
      return
    }
    setPreviewing(true)
    setError(null)
    try {
      const items = await fetchSelectedItems()
      if (!items) {
        printWindow.close()
        return
      }
      const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))
      const taxNameById = new Map(taxCategories.map((t) => [t.id, t.name]))
      const reportById = new Map(reports.map((r) => [r.id, r]))

      const sections: PdfReportSection[] = Array.from(selectedIds)
        .map((reportId) => reportById.get(reportId))
        .filter((r): r is ExpenseReport => !!r)
        .map((report) => ({
          reportTitle: report.title,
          employeeName: userName,
          items: items
            .filter((i) => i.report_id === report.id)
            .map((i) => ({
              date: i.date,
              categoryName: (i.category_id && categoryNameById.get(i.category_id)) ?? '-',
              taxCategoryName: (i.tax_category_id && taxNameById.get(i.tax_category_id)) ?? '-',
              amount: Number(i.amount),
              payee: i.payee ?? '-',
              invoiceNumber: i.invoice_number ?? '-',
              description: i.description
            }))
        }))

      const html = buildReportsPreviewHtml(sections)
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()

      setConfirmCount(selectedIds.size)
      setAwaitingConfirm(true)
    } finally {
      setPreviewing(false)
    }
  }

  async function confirmSubmit(): Promise<void> {
    if (selectedIds.size === 0) return
    setError(null)

    const dayOfMonth = new Date().getDate()
    if (settings && (dayOfMonth < settings.submission_start_day || dayOfMonth > settings.submission_end_day)) {
      setError(
        `提出可能期間(${settings.submission_start_day}日〜${settings.submission_end_day}日)外のため、提出できません。`
      )
      return
    }

    setSubmitting(true)
    try {
      const items = await fetchSelectedItems()
      if (!items) return

      const reportIds = Array.from(selectedIds)
      for (const reportId of reportIds) {
        const reportItems = items.filter((i) => i.report_id === reportId)
        const report = reports.find((r) => r.id === reportId)
        if (
          reportItems.length === 0 ||
          reportItems.some((i) => !i.category_id || !i.tax_category_id || i.amount <= 0)
        ) {
          setError(
            `「${report?.title ?? reportId}」の明細が未入力、または経費科目・税区分・金額が未設定の行があります。`
          )
          return
        }
      }

      const submittedAt = new Date().toISOString()
      for (const reportId of reportIds) {
        const total = items
          .filter((i) => i.report_id === reportId)
          .reduce((sum, i) => sum + Number(i.amount), 0)
        const { error: updateError } = await supabase
          .from('expense_reports')
          .update({ status: 'submitted', submitted_at: submittedAt, total_amount: total })
          .eq('id', reportId)
        if (updateError) {
          setError(updateError.message)
          return
        }
      }

      load()
    } finally {
      setSubmitting(false)
    }
  }

  const allSelected = reports.length > 0 && selectedIds.size === reports.length

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">申請</h1>
        {selectedIds.size > 0 && (
          <div className="flex gap-2">
            <button
              onClick={openPreview}
              disabled={previewing}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
            >
              {previewing ? '準備中…' : `申請確認(選択した${selectedIds.size}件をPDFプレビュー)`}
            </button>
            <button
              onClick={deleteSelected}
              disabled={deleting}
              className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-600 disabled:opacity-50"
            >
              {deleting ? '削除中…' : `選択した${selectedIds.size}件を削除`}
            </button>
          </div>
        )}
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {awaitingConfirm && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-800">
            選択した{confirmCount}件の内容を確認しましたか？よろしければ承認者へ申請してください。
          </p>
          <button
            onClick={confirmSubmit}
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '申請中…' : '申請する'}
          </button>
        </div>
      )}

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

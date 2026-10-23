import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLookups } from '../lib/useLookups'
import { StatusBadge } from '../components/StatusBadge'
import { formatMonthLabel, monthOfDateStr, recentMonths } from '../lib/month'
import { buildSingleReportSlipHtml, buildTransportationListHtml } from '../lib/pdfExport'
import type { ExpenseItem, ExpenseReport, Profile, ReportType, TransportationRoute } from '../lib/types'

interface Props {
  userId: string
  userName: string
  isAdmin: boolean
  onOpenReport: (id: string) => void
}

const statusLabels: Record<ExpenseReport['status'], string> = {
  draft: '下書き',
  submitted: '提出済み',
  approved: '承認済み',
  rejected: '差し戻し'
}

export function ReportStatus({ userId, userName, isAdmin, onOpenReport }: Props): JSX.Element {
  const { categories } = useLookups()
  const [employees, setEmployees] = useState<Profile[]>([])
  const [viewingUserId, setViewingUserId] = useState(userId)
  const [reports, setReports] = useState<ExpenseReport[]>([])
  const [departmentName, setDepartmentName] = useState('-')
  const [loading, setLoading] = useState(true)
  const [reportTypeFilter, setReportTypeFilter] = useState<ReportType>('expense')
  const [monthFilter, setMonthFilter] = useState('all')
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const viewingUserName =
    isAdmin && viewingUserId !== userId
      ? (employees.find((e) => e.id === viewingUserId)?.name ?? userName)
      : userName

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('profiles')
      .select('*')
      .order('name')
      .then(({ data }) => setEmployees((data as Profile[]) ?? []))
  }, [isAdmin])

  async function load(): Promise<void> {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('expense_reports')
      .select('*')
      .eq('user_id', viewingUserId)
      .eq('report_type', reportTypeFilter)
      .in('status', ['submitted', 'approved', 'rejected'])
      .order('submitted_at', { ascending: false })
    if (loadError) {
      setError(loadError.message)
      setReports([])
      setLoading(false)
      return
    }
    setReports((data as ExpenseReport[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    setSelectedIds(new Set())
  }, [viewingUserId, reportTypeFilter])

  useEffect(() => {
    supabase
      .from('profiles')
      .select('department_id, departments(name)')
      .eq('id', viewingUserId)
      .single()
      .then(({ data }) => {
        const departments = (data as { departments: { name: string } | null } | null)?.departments
        setDepartmentName(departments?.name ?? '-')
      })
  }, [viewingUserId])

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
      if (report.report_type === 'transportation') {
        const { data: routesData, error: routesError } = await supabase
          .from('transportation_routes')
          .select('*')
          .eq('report_id', report.id)
          .order('date')
        if (routesError) {
          setError(routesError.message)
          printWindow.close()
          return
        }
        const html = buildTransportationListHtml(
          ((routesData as TransportationRoute[]) ?? []).map((r) => ({
            date: r.date,
            departure: r.departure,
            arrival: r.arrival,
            distanceKm: r.distance_km,
            amount: Number(r.amount),
            projectName: r.project_name ?? '',
            memo: r.memo ?? ''
          })),
          viewingUserName,
          report.title
        )
        printWindow.document.open()
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
        return
      }

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
        employeeName: viewingUserName,
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

  const deletableReports = isAdmin ? filteredReports : filteredReports.filter((r) => r.status === 'rejected')

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
      prev.size === deletableReports.length ? new Set() : new Set(deletableReports.map((r) => r.id))
    )
  }

  return (
    <div className="w-full p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">申請状況</h1>
          {isAdmin && (
            <select
              value={viewingUserId}
              onChange={(e) => setViewingUserId(e.target.value)}
              className="rounded-md border-2 border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800"
            >
              <option value={userId}>自分({userName})</option>
              {employees
                .filter((e) => e.id !== userId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          )}
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
          <div className="flex rounded-md border-2 border-gray-300 bg-white p-0.5">
            <button
              onClick={() => setReportTypeFilter('expense')}
              className={`rounded px-3 py-1 text-sm font-bold transition ${
                reportTypeFilter === 'expense'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              経費精算
            </button>
            <button
              onClick={() => setReportTypeFilter('transportation')}
              className={`rounded px-3 py-1 text-sm font-bold transition ${
                reportTypeFilter === 'transportation'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              交通費詳細
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleSelectAll}
            disabled={deletableReports.length === 0}
            className="rounded-md border-2 border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            全選択
          </button>
          <button
            onClick={removeSelected}
            disabled={selectedIds.size === 0}
            className="rounded-md border-2 border-red-300 px-3 py-1.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            選択削除{selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
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
          <p className="p-8 text-sm text-gray-500">提出済みの申請はまだありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-base">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-100 text-sm font-bold text-gray-700">
                  <th className="w-8 p-4">
                    <input
                      type="checkbox"
                      checked={deletableReports.length > 0 && selectedIds.size === deletableReports.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-200"
                    />
                  </th>
                  <th className="whitespace-nowrap p-4">申請者</th>
                  <th className="whitespace-nowrap p-4">日付</th>
                  <th className="whitespace-nowrap p-4">状態</th>
                  <th className="whitespace-nowrap p-4">合計金額</th>
                  <th className="whitespace-nowrap p-4">提出日</th>
                  <th className="whitespace-nowrap p-4">PDF化</th>
                  <th className="whitespace-nowrap p-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((r) => (
                  <tr key={r.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                    <td className="p-4">
                      {(r.status === 'rejected' || isAdmin) && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelected(r.id)}
                          className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-200"
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap p-4 font-bold text-gray-900">{viewingUserName}</td>
                    <td
                      className={
                        r.report_type === 'expense'
                          ? 'cursor-pointer whitespace-nowrap p-4 font-bold text-blue-600 hover:underline'
                          : 'whitespace-nowrap p-4 font-bold text-gray-900'
                      }
                      onClick={r.report_type === 'expense' ? () => onOpenReport(r.id) : undefined}
                    >
                      {r.report_month ? formatMonthLabel(r.report_month) : r.title}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="whitespace-nowrap p-4 font-bold text-gray-900">
                      {r.total_amount.toLocaleString()} 円
                    </td>
                    <td className="whitespace-nowrap p-4 text-gray-700">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('ja-JP') : '-'}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      <button
                        onClick={() => generatePdf(r)}
                        disabled={generatingId === r.id}
                        className="rounded-md border-2 border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                      >
                        {generatingId === r.id ? '作成中…' : 'PDF化'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      {(r.status === 'rejected' || isAdmin) && (
                        <button
                          onClick={() => deleteReport(r.id)}
                          className="text-sm font-bold text-red-600 hover:text-red-700 hover:underline"
                        >
                          削除
                        </button>
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

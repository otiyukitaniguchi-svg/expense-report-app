import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLookups } from '../lib/useLookups'
import { useAppSettings } from '../lib/useAppSettings'
import { StatusBadge } from '../components/StatusBadge'
import { ExpenseItemModal } from '../components/ExpenseItemModal'
import { currentMonthStr, formatMonthLabel, recentMonths } from '../lib/month'
import { buildSingleReportSlipHtml } from '../lib/pdfExport'
import type { ExpenseItem, ExpenseReport } from '../lib/types'

const statusLabels: Record<ExpenseReport['status'], string> = {
  draft: '下書き',
  submitted: '提出済み',
  approved: '承認済み',
  rejected: '差し戻し'
}

interface Props {
  userId: string
  reportId: string | null
  month?: string
  onDone: () => void
}

type ModalState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; item: ExpenseItem }

export function ReportForm({ userId, reportId: fixedReportId, month, onDone }: Props): JSX.Element {
  const { categories, taxCategories } = useLookups()
  const { settings } = useAppSettings()
  const [selectedMonth, setSelectedMonth] = useState(month ?? currentMonthStr())
  const [reportId, setReportId] = useState<string | null>(fixedReportId)
  const [report, setReport] = useState<ExpenseReport | null>(null)
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState<ModalState>({ mode: 'closed' })
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [ownerDepartment, setOwnerDepartment] = useState('-')
  const [exporting, setExporting] = useState(false)

  const isMonthMode = !fixedReportId

  // 月モード(新規登録)の場合、選択した月の下書きをfind-or-create
  useEffect(() => {
    if (fixedReportId) {
      setReportId(fixedReportId)
      return
    }
    let active = true
    async function resolveMonthReport(): Promise<void> {
      const { data: existing, error: selectError } = await supabase
        .from('expense_reports')
        .select('id')
        .eq('user_id', userId)
        .eq('report_month', selectedMonth)
        .eq('status', 'draft')
        .maybeSingle()
      if (selectError) {
        if (active) {
          setError(selectError.message)
          setLoading(false)
        }
        return
      }
      if (existing) {
        if (active) setReportId(existing.id)
        return
      }
      const { data: created, error: insertError } = await supabase
        .from('expense_reports')
        .insert({
          user_id: userId,
          title: formatMonthLabel(selectedMonth),
          status: 'draft',
          report_month: selectedMonth
        })
        .select('id')
        .single()
      if (insertError) {
        if (active) {
          setError(insertError.message)
          setLoading(false)
        }
        return
      }
      if (active) setReportId(created.id)
    }
    resolveMonthReport()
    return () => {
      active = false
    }
  }, [fixedReportId, selectedMonth, userId])

  async function loadItems(id: string): Promise<void> {
    const { data } = await supabase.from('expense_items').select('*').eq('report_id', id).order('date')
    setItems((data as ExpenseItem[]) ?? [])
    setSelectedItemIds(new Set())
  }

  function toggleItemSelected(id: string): void {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll(): void {
    setSelectedItemIds((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))))
  }

  useEffect(() => {
    if (!reportId) return
    let active = true
    async function load(): Promise<void> {
      setLoading(true)
      const [{ data: reportData }, { data: itemsData }] = await Promise.all([
        supabase.from('expense_reports').select('*').eq('id', reportId).single(),
        supabase.from('expense_items').select('*').eq('report_id', reportId).order('date')
      ])
      if (!active) return
      setReport(reportData as ExpenseReport)
      setTitle((reportData as ExpenseReport)?.title ?? '')
      setItems((itemsData as ExpenseItem[]) ?? [])
      setLoading(false)

      const ownerId = (reportData as ExpenseReport)?.user_id
      if (ownerId) {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('name, departments(name)')
          .eq('id', ownerId)
          .single()
        if (!active) return
        const owner = ownerData as { name: string; departments: { name: string } | null } | null
        setOwnerName(owner?.name ?? '')
        setOwnerDepartment(owner?.departments?.name ?? '-')
      }
    }
    load()
    return () => {
      active = false
    }
  }, [reportId])

  const readOnly = report?.status === 'submitted' || report?.status === 'approved'
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const dayOfMonth = new Date().getDate()
  const withinSubmissionPeriod =
    !settings || (dayOfMonth >= settings.submission_start_day && dayOfMonth <= settings.submission_end_day)

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))
  const taxNameById = new Map(taxCategories.map((t) => [t.id, t.name]))

  async function saveTitle(): Promise<void> {
    if (!report) return
    await supabase.from('expense_reports').update({ title }).eq('id', report.id)
  }

  function exportPdf(): void {
    if (!report) return
    // ポップアップブロックを避けるため、非同期処理の前にユーザー操作と同期して開く
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('ポップアップがブロックされました。ブラウザの設定でこのサイトのポップアップを許可してください。')
      return
    }
    setExporting(true)
    try {
      const html = buildSingleReportSlipHtml({
        employeeName: ownerName,
        departmentName: ownerDepartment,
        statusLabel: statusLabels[report.status],
        submittedAtLabel: report.submitted_at
          ? new Date(report.submitted_at).toLocaleDateString('ja-JP')
          : '-',
        periodLabel: report.report_month ? formatMonthLabel(report.report_month) : report.title,
        items: items.map((i) => ({
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
      setExporting(false)
    }
  }

  async function saveItem(fields: Omit<ExpenseItem, 'id' | 'report_id'>): Promise<void> {
    if (!report) return
    setError(null)
    if (modalState.mode === 'create') {
      const newItem: ExpenseItem = { id: crypto.randomUUID(), report_id: report.id, ...fields }
      const { error: insertError } = await supabase.from('expense_items').insert(newItem)
      if (insertError) {
        setError(insertError.message)
        return
      }
    } else if (modalState.mode === 'edit') {
      const { error: updateError } = await supabase
        .from('expense_items')
        .update(fields)
        .eq('id', modalState.item.id)
      if (updateError) {
        setError(updateError.message)
        return
      }
    }
    setModalState({ mode: 'closed' })
    loadItems(report.id)
  }

  async function removeItem(id: string): Promise<void> {
    if (!window.confirm('この明細を削除しますか?')) return
    if (!report) return
    await supabase.from('expense_items').delete().eq('id', id)
    loadItems(report.id)
  }

  async function submitReport(): Promise<void> {
    if (!report) return
    setError(null)
    setSuccessMessage(null)
    if (!withinSubmissionPeriod && settings) {
      setError(
        `提出可能期間(${settings.submission_start_day}日〜${settings.submission_end_day}日)外のため、提出できません。`
      )
      return
    }

    if (isMonthMode) {
      if (selectedItemIds.size === 0) {
        setError('提出する明細をチェックボックスで選択してください。')
        return
      }
      const selectedItems = items.filter((i) => selectedItemIds.has(i.id))
      if (selectedItems.some((i) => !i.category_id || !i.tax_category_id || i.amount <= 0)) {
        setError('選択した明細に経費科目・税区分・金額が未設定のものがあります。')
        return
      }
      setSubmitting(true)
      const { error: rpcError } = await supabase.rpc('submit_selected_items', {
        p_item_ids: Array.from(selectedItemIds)
      })
      setSubmitting(false)
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      setSuccessMessage(`${selectedItems.length}件を提出しました。`)
      loadItems(report.id)
      return
    }

    if (items.length === 0) {
      setError('明細を1件以上追加してください。')
      return
    }
    if (items.some((i) => !i.category_id || !i.tax_category_id || i.amount <= 0)) {
      setError('すべての明細の経費科目・税区分・金額を入力してください。')
      return
    }
    setSubmitting(true)
    const { error: updateError } = await supabase
      .from('expense_reports')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        total_amount: total,
        approved_by: null,
        approved_at: null
      })
      .eq('id', report.id)
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onDone()
  }

  const canSubmit = withinSubmissionPeriod && (!isMonthMode || selectedItemIds.size > 0)

  if (error && !report) {
    return (
      <div className="p-8">
        <button onClick={onDone} className="mb-4 text-sm text-blue-600 hover:underline">
          &lt; 一覧に戻る
        </button>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      </div>
    )
  }
  if (loading || !report) return <p className="p-8 text-sm text-gray-400">読み込み中…</p>

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <button
        onClick={onDone}
        className="mb-4 text-sm text-blue-600 hover:text-blue-700 hover:underline"
      >
        &lt; 一覧に戻る
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {isMonthMode ? (
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">経費登録</h1>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={title}
              disabled={readOnly}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              className="w-full rounded-md border-2 border-transparent bg-transparent px-1 text-2xl font-bold text-gray-900 transition focus:border-blue-300 focus:bg-blue-50/40 focus:outline-none disabled:text-gray-900 md:w-80 md:text-3xl"
            />
            <StatusBadge status={report.status} />
          </div>
        )}
        {isMonthMode && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-md border-2 border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700"
          >
            {recentMonths(12).map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        )}
        {!isMonthMode && (
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="rounded-md border-2 border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            {exporting ? '出力中…' : 'PDF出力・印刷'}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-md border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="mb-4 rounded-md border-2 border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {successMessage}
        </p>
      )}

      <div className="rounded-xl border-2 border-gray-300 bg-white p-6 shadow-sm">
        {!readOnly && (
          <div className="mb-4 flex justify-end gap-2">
            {isMonthMode && (
              <button
                onClick={toggleSelectAll}
                className="rounded-md border-2 border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                全選択
              </button>
            )}
            <button
              onClick={() => setModalState({ mode: 'create' })}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              + 明細を追加
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-base">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-100 text-sm font-bold text-gray-700">
                {isMonthMode && !readOnly && (
                  <th className="w-8 p-2">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedItemIds.size === items.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-200"
                    />
                  </th>
                )}
                <th className="whitespace-nowrap p-2">日付</th>
                <th className="whitespace-nowrap p-2">経費科目</th>
                <th className="p-2">摘要</th>
                <th className="whitespace-nowrap p-2 text-right">金額</th>
                <th className="p-2">支払先</th>
                <th className="whitespace-nowrap p-2">税区分</th>
                <th className="p-2">備考</th>
                <th className="p-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                  {isMonthMode && !readOnly && (
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => toggleItemSelected(item.id)}
                        className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-200"
                      />
                    </td>
                  )}
                  <td className="whitespace-nowrap p-3 font-medium text-gray-900">{item.date}</td>
                  <td className="whitespace-nowrap p-3 text-gray-900">
                    {(item.category_id && categoryNameById.get(item.category_id)) ?? '-'}
                  </td>
                  <td className="p-3 text-gray-900">{item.description || '-'}</td>
                  <td className="whitespace-nowrap p-3 text-right font-bold text-gray-900">
                    {Number(item.amount).toLocaleString()} 円
                  </td>
                  <td className="p-3 text-gray-900">{item.payee ?? '-'}</td>
                  <td className="whitespace-nowrap p-3 text-gray-900">
                    {(item.tax_category_id && taxNameById.get(item.tax_category_id)) ?? '-'}
                  </td>
                  <td className="p-3 text-gray-900">{item.memo ?? '-'}</td>
                  <td className="p-3">
                    {!readOnly && (
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setModalState({ mode: 'edit', item })}
                          className="text-sm font-bold text-blue-600 hover:underline"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-sm font-bold text-red-600 hover:text-red-700 hover:underline"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-gray-500">
                    明細がまだありません。「+ 明細を追加」から入力してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between border-t-2 border-gray-300 pt-4">
          <p className="text-sm font-semibold text-gray-500">件数: {items.length}</p>
          <p className="text-xl font-bold text-gray-900">
            合計 <span className="ml-1">{total.toLocaleString()}</span>
            <span className="ml-0.5 text-sm font-semibold text-gray-500">円</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onDone}
          className="rounded-md border-2 border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
        >
          一覧に戻る
        </button>
        {!readOnly && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={submitReport}
              disabled={!canSubmit || submitting}
              title={
                withinSubmissionPeriod || !settings
                  ? undefined
                  : `提出可能期間: ${settings.submission_start_day}日〜${settings.submission_end_day}日`
              }
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {submitting
                ? '提出中…'
                : isMonthMode
                  ? `選択した${selectedItemIds.size}件を提出する`
                  : '提出する'}
            </button>
            {!withinSubmissionPeriod && settings && (
              <p className="text-xs font-semibold text-gray-500">
                提出可能期間: {settings.submission_start_day}日〜{settings.submission_end_day}日
              </p>
            )}
          </div>
        )}
      </div>

      {modalState.mode !== 'closed' && (
        <ExpenseItemModal
          initialItem={modalState.mode === 'edit' ? modalState.item : null}
          categories={categories.filter((c) => c.is_active)}
          onSave={saveItem}
          onClose={() => setModalState({ mode: 'closed' })}
        />
      )}
    </div>
  )
}

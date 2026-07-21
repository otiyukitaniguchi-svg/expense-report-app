import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLookups } from '../lib/useLookups'
import { ExpenseItemRow } from '../components/ExpenseItemRow'
import { StatusBadge } from '../components/StatusBadge'
import type { ExpenseItem, ExpenseReport } from '../lib/types'

interface Props {
  userId: string
  reportId: string | null
  onDone: () => void
}

function emptyItem(reportId: string): ExpenseItem {
  return {
    id: crypto.randomUUID(),
    report_id: reportId,
    date: new Date().toISOString().slice(0, 10),
    category_id: null,
    tax_category_id: null,
    amount: 0,
    description: '',
    payee: null,
    invoice_number: null
  }
}

export function ReportForm({ userId, reportId, onDone }: Props): JSX.Element {
  const { categories, taxCategories } = useLookups()
  const [report, setReport] = useState<ExpenseReport | null>(null)
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load(): Promise<void> {
      if (reportId) {
        const [{ data: reportData }, { data: itemsData }] = await Promise.all([
          supabase.from('expense_reports').select('*').eq('id', reportId).single(),
          supabase.from('expense_items').select('*').eq('report_id', reportId).order('date')
        ])
        setReport(reportData as ExpenseReport)
        setTitle((reportData as ExpenseReport)?.title ?? '')
        setItems((itemsData as ExpenseItem[]) ?? [])
      } else {
        const { data, error: insertError } = await supabase
          .from('expense_reports')
          .insert({ user_id: userId, title: '新規申請', status: 'draft' })
          .select()
          .single()
        if (insertError) {
          setError(insertError.message)
        } else {
          setReport(data as ExpenseReport)
          setTitle((data as ExpenseReport).title)
        }
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId])

  const readOnly = report?.status !== 'draft'
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  async function saveTitle(): Promise<void> {
    if (!report) return
    await supabase.from('expense_reports').update({ title }).eq('id', report.id)
  }

  async function addItem(): Promise<void> {
    if (!report) return
    const item = emptyItem(report.id)
    const { error: insertError } = await supabase.from('expense_items').insert(item)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setItems((prev) => [...prev, item])
  }

  async function updateItem(updated: ExpenseItem): Promise<void> {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    const { id, ...fields } = updated
    await supabase.from('expense_items').update(fields).eq('id', id)
  }

  async function removeItem(id: string): Promise<void> {
    await supabase.from('expense_items').delete().eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function submitReport(): Promise<void> {
    if (!report) return
    if (items.length === 0) {
      setError('明細を1件以上追加してください。')
      return
    }
    if (items.some((i) => !i.category_id || !i.tax_category_id || i.amount <= 0)) {
      setError('すべての明細の経費科目・税区分・金額を入力してください。')
      return
    }
    const { error: updateError } = await supabase
      .from('expense_reports')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        total_amount: total
      })
      .eq('id', report.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onDone()
  }

  if (loading) return <p className="p-8 text-sm text-gray-400">読み込み中…</p>
  if (!report) return <p className="p-8 text-sm text-red-600">{error ?? '申請が見つかりません'}</p>

  return (
    <div className="mx-auto max-w-6xl p-8">
      <button
        onClick={onDone}
        className="mb-4 text-sm text-blue-600 hover:text-blue-700 hover:underline"
      >
        &lt; 一覧に戻る
      </button>

      <div className="mb-6 flex items-center gap-3">
        <input
          value={title}
          disabled={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          className="w-80 rounded-md border border-transparent bg-transparent px-1 text-2xl font-bold text-gray-900 transition focus:border-blue-300 focus:bg-blue-50/40 focus:outline-none disabled:text-gray-900"
        />
        <StatusBadge status={report.status} />
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                <th className="p-2">日付</th>
                <th className="p-2">経費科目</th>
                <th className="p-2">税区分</th>
                <th className="p-2">金額</th>
                <th className="p-2">支払先</th>
                <th className="p-2">インボイス登録番号</th>
                <th className="p-2">摘要</th>
                {!readOnly && <th className="p-2" />}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ExpenseItemRow
                  key={item.id}
                  item={item}
                  categories={categories.filter((c) => c.is_active)}
                  taxCategories={taxCategories}
                  readOnly={readOnly}
                  onChange={updateItem}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-sm text-gray-400">
                    明細がまだありません。「+ 明細を追加」から入力してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <button
            onClick={addItem}
            className="mt-4 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            + 明細を追加
          </button>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-400">件数: {items.length}</p>
          <p className="text-lg font-bold text-gray-900">
            合計 <span className="ml-1">{total.toLocaleString()}</span>
            <span className="ml-0.5 text-sm font-medium text-gray-400">円</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onDone}
          className="rounded-md border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          一覧に戻る
        </button>
        {!readOnly && (
          <button
            onClick={submitReport}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            提出する
          </button>
        )}
      </div>
    </div>
  )
}

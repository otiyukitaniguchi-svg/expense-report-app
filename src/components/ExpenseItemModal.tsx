import { useEffect, useState } from 'react'
import type { ExpenseCategory, ExpenseItem } from '../lib/types'

interface Props {
  initialItem: ExpenseItem | null
  categories: ExpenseCategory[]
  onSave: (item: Omit<ExpenseItem, 'id' | 'report_id'>) => Promise<void>
  onClose: () => void
}

const fieldClass =
  'w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700'

export function ExpenseItemModal({ initialItem, categories, onSave, onClose }: Props): JSX.Element {
  const [date, setDate] = useState(initialItem?.date ?? new Date().toISOString().slice(0, 10))
  const [categoryId, setCategoryId] = useState(initialItem?.category_id ?? '')
  const [amount, setAmount] = useState(initialItem?.amount ?? 0)
  const [description, setDescription] = useState(initialItem?.description ?? '')
  const [payee, setPayee] = useState(initialItem?.payee ?? '')
  const [projectName, setProjectName] = useState(initialItem?.project_name ?? '')
  const [memo, setMemo] = useState(initialItem?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit(): Promise<void> {
    setError(null)
    if (!categoryId || amount <= 0) {
      setError('科目名と金額(0より大きい値)は必須です')
      return
    }
    const category = categories.find((c) => c.id === categoryId)
    if (!category?.default_tax_category_id) {
      setError('選択した経費科目にデフォルト税区分が設定されていません。「勘定科目一覧」で設定してください。')
      return
    }
    setSaving(true)
    await onSave({
      date,
      category_id: categoryId,
      tax_category_id: category.default_tax_category_id,
      amount,
      description,
      payee: payee.trim() || null,
      project_name: projectName.trim() || null,
      invoice_number: initialItem?.invoice_number ?? null,
      memo: memo.trim() || null
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-6 pb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {initialItem ? '経費の編集' : '経費を新規追加'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          {error && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="space-y-4">
          <div>
            <label className={labelClass}>日付</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>科目名</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={fieldClass}
            >
              <option value="">選択してください</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>摘要</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>金額</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={amount ? amount.toLocaleString() : ''}
                onChange={(e) => setAmount(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                className={`${fieldClass} pr-10 text-right`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                円
              </span>
            </div>
          </div>
          <div>
            <label className={labelClass}>支払先</label>
            <input
              type="text"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>案件名</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="例: ○○ → ○○"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>備考</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className={fieldClass}
            />
          </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 p-6 pt-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : initialItem ? '更新する' : '登録する'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { ExpenseCategory, ExpenseItem, TaxCategory } from '../lib/types'

interface Props {
  initialItem: ExpenseItem | null
  categories: ExpenseCategory[]
  taxCategories: TaxCategory[]
  onSave: (item: Omit<ExpenseItem, 'id' | 'report_id'>) => Promise<void>
  onClose: () => void
}

const fieldClass =
  'w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700'

export function ExpenseItemModal({
  initialItem,
  categories,
  taxCategories,
  onSave,
  onClose
}: Props): JSX.Element {
  const [date, setDate] = useState(initialItem?.date ?? new Date().toISOString().slice(0, 10))
  const [categoryId, setCategoryId] = useState(initialItem?.category_id ?? '')
  const [taxCategoryId, setTaxCategoryId] = useState(initialItem?.tax_category_id ?? '')
  const [amount, setAmount] = useState(initialItem?.amount ?? 0)
  const [payee, setPayee] = useState(initialItem?.payee ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState(initialItem?.invoice_number ?? '')
  const [description, setDescription] = useState(initialItem?.description ?? '')
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
    if (!categoryId || !taxCategoryId || amount <= 0) {
      setError('経費科目・税区分・金額(0より大きい値)は必須です')
      return
    }
    setSaving(true)
    await onSave({
      date,
      category_id: categoryId,
      tax_category_id: taxCategoryId,
      amount,
      payee: payee.trim() || null,
      invoice_number: invoiceNumber.trim() || null,
      description
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
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

        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

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
            <label className={labelClass}>税区分</label>
            <select
              value={taxCategoryId}
              onChange={(e) => setTaxCategoryId(e.target.value)}
              className={fieldClass}
            >
              <option value="">選択してください</option>
              {taxCategories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>金額</label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className={fieldClass}
            />
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
            <label className={labelClass}>インボイス登録番号</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="T1234567890123"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>備考</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
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

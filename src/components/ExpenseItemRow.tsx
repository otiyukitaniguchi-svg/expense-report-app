import type { ExpenseCategory, ExpenseItem, TaxCategory } from '../lib/types'

interface Props {
  item: ExpenseItem
  categories: ExpenseCategory[]
  taxCategories: TaxCategory[]
  readOnly: boolean
  onChange: (item: ExpenseItem) => void
  onRemove: () => void
}

const fieldClass =
  'w-full rounded-md border border-transparent bg-gray-50 px-2.5 py-1.5 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-500'

export function ExpenseItemRow({
  item,
  categories,
  taxCategories,
  readOnly,
  onChange,
  onRemove
}: Props): JSX.Element {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="p-2">
        <input
          type="date"
          value={item.date}
          disabled={readOnly}
          onChange={(e) => onChange({ ...item, date: e.target.value })}
          className={`${fieldClass} w-36`}
        />
      </td>
      <td className="p-2">
        <select
          value={item.category_id ?? ''}
          disabled={readOnly}
          onChange={(e) => onChange({ ...item, category_id: e.target.value })}
          className={`${fieldClass} w-32`}
        >
          <option value="" disabled>
            選択
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <select
          value={item.tax_category_id ?? ''}
          disabled={readOnly}
          onChange={(e) => onChange({ ...item, tax_category_id: e.target.value })}
          className={`${fieldClass} w-32`}
        >
          <option value="" disabled>
            選択
          </option>
          {taxCategories.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <input
          type="number"
          min={0}
          value={item.amount}
          disabled={readOnly}
          onChange={(e) => onChange({ ...item, amount: Number(e.target.value) })}
          className={`${fieldClass} w-28 text-right`}
        />
      </td>
      <td className="p-2">
        <input
          type="text"
          value={item.payee ?? ''}
          disabled={readOnly}
          onChange={(e) => onChange({ ...item, payee: e.target.value })}
          placeholder="支払先"
          className={`${fieldClass} w-36`}
        />
      </td>
      <td className="p-2">
        <input
          type="text"
          value={item.invoice_number ?? ''}
          disabled={readOnly}
          onChange={(e) => onChange({ ...item, invoice_number: e.target.value })}
          placeholder="T1234567890123"
          className={`${fieldClass} w-40`}
        />
      </td>
      <td className="p-2">
        <input
          type="text"
          value={item.description}
          disabled={readOnly}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
          placeholder="摘要"
          className={`${fieldClass} w-48`}
        />
      </td>
      {!readOnly && (
        <td className="p-2">
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline"
          >
            削除
          </button>
        </td>
      )}
    </tr>
  )
}

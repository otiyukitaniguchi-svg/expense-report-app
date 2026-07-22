import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLookups } from '../lib/useLookups'

const inputClass =
  'rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'

export function AdminSettings(): JSX.Element {
  const { categories, taxCategories, loading, refresh } = useLookups()
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newTaxName, setNewTaxName] = useState('')
  const [newTaxRate, setNewTaxRate] = useState('10')
  const [error, setError] = useState<string | null>(null)

  async function addCategory(): Promise<void> {
    if (!newCategoryName.trim()) return
    const { error: insertError } = await supabase
      .from('expense_categories')
      .insert({ name: newCategoryName.trim() })
    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewCategoryName('')
    refresh()
  }

  async function toggleCategoryActive(id: string, isActive: boolean): Promise<void> {
    await supabase.from('expense_categories').update({ is_active: !isActive }).eq('id', id)
    refresh()
  }

  async function addTaxCategory(): Promise<void> {
    if (!newTaxName.trim()) return
    const rate = Number(newTaxRate) / 100
    const { error: insertError } = await supabase
      .from('tax_categories')
      .insert({ name: newTaxName.trim(), rate })
    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewTaxName('')
    setNewTaxRate('10')
    refresh()
  }

  async function deleteTaxCategory(id: string): Promise<void> {
    await supabase.from('tax_categories').delete().eq('id', id)
    refresh()
  }

  if (loading) return <p className="p-8 text-sm text-gray-400">読み込み中…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <h1 className="text-2xl font-bold text-gray-900">勘定科目一覧</h1>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800">経費科目マスタ</h2>
          <div className="flex gap-2">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="新しい経費科目名"
              className={`${inputClass} w-52`}
            />
            <button
              onClick={addCategory}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              + 追加
            </button>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-blue-50/60 text-xs font-medium text-blue-700">
              <th className="p-4">経費科目</th>
              <th className="p-4 text-right">状態</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="p-4 text-gray-700">{c.name}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => toggleCategoryActive(c.id, c.is_active)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      c.is_active
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {c.is_active ? '有効' : '無効'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800">税区分マスタ</h2>
          <div className="flex items-center gap-2">
            <input
              value={newTaxName}
              onChange={(e) => setNewTaxName(e.target.value)}
              placeholder="税区分名"
              className={`${inputClass} w-40`}
            />
            <input
              type="number"
              value={newTaxRate}
              onChange={(e) => setNewTaxRate(e.target.value)}
              className={`${inputClass} w-20 text-right`}
            />
            <span className="text-sm text-gray-400">%</span>
            <button
              onClick={addTaxCategory}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              + 追加
            </button>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-blue-50/60 text-xs font-medium text-blue-700">
              <th className="p-4">税区分</th>
              <th className="p-4 text-right">税率</th>
              <th className="p-4 text-right">削除</th>
            </tr>
          </thead>
          <tbody>
            {taxCategories.map((t) => (
              <tr key={t.id} className="border-b border-gray-50 last:border-0">
                <td className="p-4 text-gray-700">{t.name}</td>
                <td className="p-4 text-right text-gray-700">{(t.rate * 100).toFixed(0)}%</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => deleteTaxCategory(t.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

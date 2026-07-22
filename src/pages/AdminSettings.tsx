import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLookups } from '../lib/useLookups'

const inputClass =
  'rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

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
    setError(null)
    const { error: updateError } = await supabase
      .from('expense_categories')
      .update({ is_active: !isActive })
      .eq('id', id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    refresh()
  }

  async function setDefaultTax(id: string, taxCategoryId: string): Promise<void> {
    setError(null)
    const { error: updateError } = await supabase
      .from('expense_categories')
      .update({ default_tax_category_id: taxCategoryId || null })
      .eq('id', id)
    if (updateError) {
      setError(updateError.message)
      return
    }
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

  async function deleteCategory(id: string): Promise<void> {
    if (!window.confirm('この経費科目を削除しますか?')) return
    setError(null)
    const { error: deleteError } = await supabase.from('expense_categories').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    refresh()
  }

  if (loading) return <p className="p-8 text-sm text-gray-500">読み込み中…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <h1 className="text-3xl font-bold text-gray-900">勘定科目一覧</h1>
      {error && (
        <p className="rounded-md border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-xl border-2 border-gray-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-gray-300 p-5">
          <h2 className="text-lg font-bold text-gray-900">経費科目マスタ</h2>
          <div className="flex gap-2">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="新しい経費科目名"
              className={`${inputClass} w-52`}
            />
            <button
              onClick={addCategory}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              + 追加
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-base">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-blue-50 text-sm font-bold text-blue-800">
                <th className="p-4">経費科目</th>
                <th className="p-4">デフォルト税区分</th>
                <th className="p-4 text-right">状態</th>
                <th className="p-4 text-right">削除</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-gray-200 last:border-0">
                  <td className="p-4 font-semibold text-gray-900">{c.name}</td>
                  <td className="p-4">
                    <select
                      value={c.default_tax_category_id ?? ''}
                      onChange={(e) => setDefaultTax(c.id, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">未設定</option>
                      {taxCategories.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => toggleCategoryActive(c.id, c.is_active)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        c.is_active
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {c.is_active ? '有効' : '無効'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => deleteCategory(c.id)}
                      className="text-sm font-bold text-red-600 hover:text-red-700 hover:underline"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border-2 border-gray-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-gray-300 p-5">
          <h2 className="text-lg font-bold text-gray-900">税区分マスタ</h2>
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
            <span className="text-sm font-semibold text-gray-600">%</span>
            <button
              onClick={addTaxCategory}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              + 追加
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-base">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-blue-50 text-sm font-bold text-blue-800">
                <th className="p-4">税区分</th>
                <th className="p-4 text-right">税率</th>
                <th className="p-4 text-right">削除</th>
              </tr>
            </thead>
            <tbody>
              {taxCategories.map((t) => (
                <tr key={t.id} className="border-b border-gray-200 last:border-0">
                  <td className="p-4 font-semibold text-gray-900">{t.name}</td>
                  <td className="p-4 text-right font-bold text-gray-900">{(t.rate * 100).toFixed(0)}%</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => deleteTaxCategory(t.id)}
                      className="text-sm font-bold text-red-600 hover:text-red-700 hover:underline"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

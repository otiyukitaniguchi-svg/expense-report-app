import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAppSettings } from '../lib/useAppSettings'

interface Props {
  isAdmin: boolean
}

export function ExpenseRules({ isAdmin }: Props): JSX.Element {
  const { settings, loading, refresh } = useAppSettings()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (settings) setDraft(settings.expense_rules)
  }, [settings])

  function startEdit(): void {
    setDraft(settings?.expense_rules ?? '')
    setEditing(true)
  }

  async function save(): Promise<void> {
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('app_settings')
      .update({ expense_rules: draft })
      .eq('id', true)
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setEditing(false)
    refresh()
  }

  if (loading) return <p className="p-8 text-sm text-gray-500">読み込み中…</p>

  return (
    <div className="w-full space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">経費精算ルール</h1>
        {isAdmin && !editing && (
          <button
            onClick={startEdit}
            className="rounded-md border-2 border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            編集
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-md border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-xl border-2 border-gray-300 bg-white p-6 shadow-sm">
        {editing ? (
          <div className="space-y-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={16}
              className="w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-base font-medium text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="経費精算に関するルールを入力してください"
            />
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border-2 border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : settings?.expense_rules ? (
          <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-gray-900">
            {settings.expense_rules}
          </p>
        ) : (
          <p className="text-sm font-semibold text-gray-500">
            まだルールが設定されていません。{isAdmin ? '「編集」から入力してください。' : ''}
          </p>
        )}
      </section>
    </div>
  )
}

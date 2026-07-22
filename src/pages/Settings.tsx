import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAppSettings } from '../lib/useAppSettings'

const inputClass =
  'w-24 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'

export function Settings(): JSX.Element {
  const { settings, loading, refresh } = useAppSettings()
  const [startDay, setStartDay] = useState(1)
  const [endDay, setEndDay] = useState(31)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      setStartDay(settings.submission_start_day)
      setEndDay(settings.submission_end_day)
    }
  }, [settings])

  async function save(): Promise<void> {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('app_settings')
      .update({ submission_start_day: startDay, submission_end_day: endDay })
      .eq('id', true)
    setSaving(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('保存しました')
    refresh()
  }

  if (loading) return <p className="p-8 text-sm text-gray-400">読み込み中…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <h1 className="text-2xl font-bold text-gray-900">設定</h1>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-gray-800">申請可能期間</h2>
        <p className="mb-4 text-sm text-gray-400">
          毎月この日付の範囲内のみ、申請の提出ができます(明細の入力・下書き保存はいつでも可能です)。
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={31}
            value={startDay}
            onChange={(e) => setStartDay(Number(e.target.value))}
            className={inputClass}
          />
          <span className="text-sm text-gray-500">日 〜</span>
          <input
            type="number"
            min={1}
            max={31}
            value={endDay}
            onChange={(e) => setEndDay(Number(e.target.value))}
            className={inputClass}
          />
          <span className="text-sm text-gray-500">日</span>
        </div>
        {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </section>

      <p className="text-sm text-gray-400">その他の詳細設定(締め日など)は今後追加予定です。</p>
    </div>
  )
}

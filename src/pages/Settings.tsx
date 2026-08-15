import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAppSettings } from '../lib/useAppSettings'

const inputClass =
  'w-24 rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

export function Settings(): JSX.Element {
  const { settings, loading, refresh } = useAppSettings()
  const [startDay, setStartDay] = useState(1)
  const [endDay, setEndDay] = useState(31)
  const [deadlineDay, setDeadlineDay] = useState(31)
  const [fuelPrice, setFuelPrice] = useState(170)
  const [fuelEfficiency, setFuelEfficiency] = useState(15)
  const [seasonalIndexSummer, setSeasonalIndexSummer] = useState(1)
  const [seasonalIndexWinter, setSeasonalIndexWinter] = useState(1)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      setStartDay(settings.submission_start_day)
      setEndDay(settings.submission_end_day)
      setDeadlineDay(settings.submission_deadline_day)
      setFuelPrice(settings.fuel_price_per_liter)
      setFuelEfficiency(settings.fuel_efficiency_km_per_liter)
      setSeasonalIndexSummer(settings.seasonal_index_summer)
      setSeasonalIndexWinter(settings.seasonal_index_winter)
    }
  }, [settings])

  async function save(): Promise<void> {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('app_settings')
      .update({
        submission_start_day: startDay,
        submission_end_day: endDay,
        submission_deadline_day: deadlineDay,
        fuel_price_per_liter: fuelPrice,
        fuel_efficiency_km_per_liter: fuelEfficiency,
        seasonal_index_summer: seasonalIndexSummer,
        seasonal_index_winter: seasonalIndexWinter
      })
      .eq('id', true)
    setSaving(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('保存しました')
    refresh()
  }

  if (loading) return <p className="p-8 text-sm text-gray-500">読み込み中…</p>

  return (
    <div className="w-full space-y-8 p-4 md:p-8">
      <h1 className="text-3xl font-bold text-gray-900">設定</h1>

      <section className="rounded-xl border-2 border-gray-300 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-gray-900">申請可能期間</h2>
        <p className="mb-4 text-sm font-medium text-gray-600">
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
          <span className="text-sm font-bold text-gray-700">日 〜</span>
          <input
            type="number"
            min={1}
            max={31}
            value={endDay}
            onChange={(e) => setEndDay(Number(e.target.value))}
            className={inputClass}
          />
          <span className="text-sm font-bold text-gray-700">日</span>
        </div>

        <h2 className="mb-1 mt-6 text-lg font-bold text-gray-900">締め切り日</h2>
        <p className="mb-4 text-sm font-medium text-gray-600">
          毎月この日までに申請を提出してください、という締め切りの目安日です。
        </p>
        <div className="flex items-center gap-3">
          <select
            value={deadlineDay}
            onChange={(e) => setDeadlineDay(Number(e.target.value))}
            className={inputClass}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
          <span className="text-sm font-bold text-gray-700">日</span>
        </div>
      </section>

      <section className="rounded-xl border-2 border-gray-300 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-bold text-gray-900">交通費(ガソリン代)自動計算</h2>
        <p className="mb-4 text-sm font-medium text-gray-600">
          「交通費詳細」の距離(km)から、距離×単価÷(燃費×季節指数) で金額を自動計算します。
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-gray-700">単価(円/L)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={fuelPrice}
              onChange={(e) => setFuelPrice(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-gray-700">燃費(Km/L)</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={fuelEfficiency}
              onChange={(e) => setFuelEfficiency(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-gray-700">
              季節指数(夏場: 4〜10月)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={seasonalIndexSummer}
              onChange={(e) => setSeasonalIndexSummer(Number(e.target.value))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-gray-700">
              季節指数(冬場: 11〜3月)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={seasonalIndexWinter}
              onChange={(e) => setSeasonalIndexWinter(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {message && <p className="text-sm font-bold text-emerald-700">{message}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? '保存中…' : '保存'}
      </button>

      <p className="text-sm font-medium text-gray-500">その他の詳細設定は今後追加予定です。</p>
    </div>
  )
}

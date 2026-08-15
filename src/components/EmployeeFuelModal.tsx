import { useState } from 'react'
import type { Profile } from '../lib/types'

interface Props {
  profile: Profile
  onSave: (fields: {
    fuel_price_per_liter: number | null
    fuel_efficiency_km_per_liter: number | null
    seasonal_index_summer: number | null
    seasonal_index_winter: number | null
  }) => Promise<void>
  onClose: () => void
}

const fieldClass =
  'w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700'

function toInputValue(value: number | null): string {
  return value === null ? '' : String(value)
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : Number(trimmed)
}

export function EmployeeFuelModal({ profile, onSave, onClose }: Props): JSX.Element {
  const [fuelPrice, setFuelPrice] = useState(toInputValue(profile.fuel_price_per_liter))
  const [fuelEfficiency, setFuelEfficiency] = useState(toInputValue(profile.fuel_efficiency_km_per_liter))
  const [seasonalSummer, setSeasonalSummer] = useState(toInputValue(profile.seasonal_index_summer))
  const [seasonalWinter, setSeasonalWinter] = useState(toInputValue(profile.seasonal_index_winter))
  const [saving, setSaving] = useState(false)

  async function handleSubmit(): Promise<void> {
    setSaving(true)
    await onSave({
      fuel_price_per_liter: toNumberOrNull(fuelPrice),
      fuel_efficiency_km_per_liter: toNumberOrNull(fuelEfficiency),
      seasonal_index_summer: toNumberOrNull(seasonalSummer),
      seasonal_index_winter: toNumberOrNull(seasonalWinter)
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-6 pb-4">
          <h2 className="text-lg font-bold text-gray-900">{profile.name} さんの燃費設定</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          <p className="mb-4 text-sm text-gray-500">
            空欄の項目は「設定」ページの全社共通の値が使われます。
          </p>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>単価(円/L)</label>
              <input
                type="number"
                value={fuelPrice}
                onChange={(e) => setFuelPrice(e.target.value)}
                placeholder="全社共通の値を使用"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>燃費(Km/L)</label>
              <input
                type="number"
                value={fuelEfficiency}
                onChange={(e) => setFuelEfficiency(e.target.value)}
                placeholder="全社共通の値を使用"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>季節指数(夏場: 4〜10月)</label>
              <input
                type="number"
                value={seasonalSummer}
                onChange={(e) => setSeasonalSummer(e.target.value)}
                placeholder="全社共通の値を使用"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>季節指数(冬場: 11〜3月)</label>
              <input
                type="number"
                value={seasonalWinter}
                onChange={(e) => setSeasonalWinter(e.target.value)}
                placeholder="全社共通の値を使用"
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
            {saving ? '保存中…' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { TransportationRoute } from '../lib/types'

interface Props {
  initialItem: TransportationRoute | null
  fuelPricePerLiter: number
  fuelEfficiencyKmPerLiter: number
  seasonalIndex: number
  onSave: (fields: Omit<TransportationRoute, 'id' | 'user_id' | 'created_at'>) => Promise<void>
  onClose: () => void
}

const fieldClass =
  'w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700'

export function TransportationRouteModal({
  initialItem,
  fuelPricePerLiter,
  fuelEfficiencyKmPerLiter,
  seasonalIndex,
  onSave,
  onClose
}: Props): JSX.Element {
  const [date, setDate] = useState(initialItem?.date ?? new Date().toISOString().slice(0, 10))
  const [departure, setDeparture] = useState(initialItem?.departure ?? '')
  const [arrival, setArrival] = useState(initialItem?.arrival ?? '')
  const [route, setRoute] = useState(initialItem?.route ?? '')
  const [distanceKm, setDistanceKm] = useState(initialItem?.distance_km ?? 0)
  const [memo, setMemo] = useState(initialItem?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const computedAmount =
    fuelEfficiencyKmPerLiter > 0
      ? Math.round((distanceKm * fuelPricePerLiter * seasonalIndex) / fuelEfficiencyKmPerLiter)
      : 0

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSubmit(): Promise<void> {
    setError(null)
    if (!departure.trim() || !arrival.trim() || distanceKm <= 0) {
      setError('出発地・到着地・距離(0より大きい値)は必須です')
      return
    }
    setSaving(true)
    await onSave({
      date,
      departure: departure.trim(),
      arrival: arrival.trim(),
      route: route.trim() || null,
      distance_km: distanceKm,
      amount: computedAmount,
      memo: memo.trim() || null
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {initialItem ? '交通費詳細の編集' : '交通費詳細を追加'}
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
            <label className={labelClass}>出発地</label>
            <input
              type="text"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>到着地</label>
            <input
              type="text"
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>路線</label>
            <input
              type="text"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="例: JR山手線"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>距離(km)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={distanceKm}
              onChange={(e) => setDistanceKm(Number(e.target.value) || 0)}
              className={fieldClass}
            />
          </div>
          <div className="rounded-md bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
            交通費(自動計算): <span className="font-bold">{computedAmount.toLocaleString()} 円</span>
            <span className="ml-1 text-xs text-blue-500">
              ({distanceKm}km × {fuelPricePerLiter}円/L ÷ {fuelEfficiencyKmPerLiter}km/L ×{' '}
              {seasonalIndex})
            </span>
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

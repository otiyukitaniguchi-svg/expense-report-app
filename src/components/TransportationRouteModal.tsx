import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { seasonalIndexForDate, type AppSettings } from '../lib/useAppSettings'
import type { TransportationRoute } from '../lib/types'

interface Props {
  initialItem: TransportationRoute | null
  settings: AppSettings
  onSave: (fields: Omit<TransportationRoute, 'id' | 'user_id' | 'created_at'>) => Promise<void>
  onClose: () => void
}

interface GeoCandidate {
  label: string
  placeId: string
  lat: number
  lon: number
}

const fieldClass =
  'w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700'

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export function TransportationRouteModal({ initialItem, settings, onSave, onClose }: Props): JSX.Element {
  const [date, setDate] = useState(initialItem?.date ?? new Date().toISOString().slice(0, 10))
  const [departure, setDeparture] = useState(initialItem?.departure ?? '')
  const [arrival, setArrival] = useState(initialItem?.arrival ?? '')
  const [distanceKm, setDistanceKm] = useState(initialItem?.distance_km ?? 0)
  const [memo, setMemo] = useState(initialItem?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [departureCandidates, setDepartureCandidates] = useState<GeoCandidate[]>([])
  const [arrivalCandidates, setArrivalCandidates] = useState<GeoCandidate[]>([])
  const [selectedDepartureIdx, setSelectedDepartureIdx] = useState(0)
  const [selectedArrivalIdx, setSelectedArrivalIdx] = useState(0)

  const activeSeasonalIndex = seasonalIndexForDate(date, settings)
  const denominator = settings.fuel_efficiency_km_per_liter * activeSeasonalIndex
  const computedAmount =
    denominator > 0 ? Math.ceil((distanceKm * settings.fuel_price_per_liter) / denominator) : 0

  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function geocode(query: string): Promise<GeoCandidate[]> {
    const accessToken = await getAccessToken()
    if (!accessToken) throw new Error('セッションが切れています。再ログインしてください。')
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ query })
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? '地名検索に失敗しました')
    return body.candidates as GeoCandidate[]
  }

  async function searchCandidates(): Promise<void> {
    setError(null)
    setDepartureCandidates([])
    setArrivalCandidates([])
    if (!departure.trim() || !arrival.trim()) {
      setError('候補を検索するには、出発地・到着地を入力してください')
      return
    }
    setSearching(true)
    try {
      const [fromResults, toResults] = await Promise.all([geocode(departure), geocode(arrival)])
      if (fromResults.length === 0) {
        setError(`出発地「${departure}」の候補が見つかりませんでした。より具体的に入力してください。`)
        return
      }
      if (toResults.length === 0) {
        setError(`到着地「${arrival}」の候補が見つかりませんでした。より具体的に入力してください。`)
        return
      }
      setDepartureCandidates(fromResults)
      setArrivalCandidates(toResults)
      setSelectedDepartureIdx(0)
      setSelectedArrivalIdx(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '候補の検索に失敗しました')
    } finally {
      setSearching(false)
    }
  }

  async function calculateDistance(): Promise<void> {
    setError(null)
    const from = departureCandidates[selectedDepartureIdx]
    const to = arrivalCandidates[selectedArrivalIdx]
    if (!from || !to) return
    setCalculating(true)
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) {
        setError('セッションが切れています。再ログインしてください。')
        return
      }
      const res = await fetch('/api/calculate-distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fromPlaceId: from.placeId, toPlaceId: to.placeId })
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? '距離の自動計算に失敗しました')
        return
      }
      setDistanceKm(body.distanceKm)
    } catch {
      setError('距離の自動計算に失敗しました。距離を手動で入力してください。')
    } finally {
      setCalculating(false)
    }
  }

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
              placeholder="例: 那覇市役所"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>到着地</label>
            <input
              type="text"
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
              placeholder="例: 沖縄県庁"
              className={fieldClass}
            />
          </div>

          <button
            type="button"
            onClick={searchCandidates}
            disabled={searching}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            {searching ? '検索中…' : '候補を検索'}
          </button>

          {departureCandidates.length > 0 && (
            <div>
              <label className={labelClass}>出発地の候補</label>
              <select
                value={selectedDepartureIdx}
                onChange={(e) => setSelectedDepartureIdx(Number(e.target.value))}
                className={fieldClass}
              >
                {departureCandidates.map((c, i) => (
                  <option key={i} value={i}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {arrivalCandidates.length > 0 && (
            <div>
              <label className={labelClass}>到着地の候補</label>
              <select
                value={selectedArrivalIdx}
                onChange={(e) => setSelectedArrivalIdx(Number(e.target.value))}
                className={fieldClass}
              >
                {arrivalCandidates.map((c, i) => (
                  <option key={i} value={i}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {departureCandidates.length > 0 && arrivalCandidates.length > 0 && (
            <button
              type="button"
              onClick={calculateDistance}
              disabled={calculating}
              className="w-full rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
            >
              {calculating ? '計算中…' : 'この地点で距離を計算'}
            </button>
          )}

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
              ({distanceKm}km × {settings.fuel_price_per_liter}円/L ÷ ({settings.fuel_efficiency_km_per_liter}
              km/L × {activeSeasonalIndex})
              {Number(date.slice(5, 7)) >= 4 && Number(date.slice(5, 7)) <= 10 ? '・夏場' : '・冬場'})
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

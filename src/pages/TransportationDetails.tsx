import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAppSettings } from '../lib/useAppSettings'
import { TransportationRouteModal } from '../components/TransportationRouteModal'
import { buildTransportationListHtml } from '../lib/pdfExport'
import { formatMonthLabel, recentMonths } from '../lib/month'
import type { TransportationRoute } from '../lib/types'

interface Props {
  userId: string
  userName: string
}

type ModalState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; item: TransportationRoute }

export function TransportationDetails({ userId, userName }: Props): JSX.Element {
  const { settings } = useAppSettings()
  const [routes, setRoutes] = useState<TransportationRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState<ModalState>({ mode: 'closed' })
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  async function load(): Promise<void> {
    setLoading(true)
    const { data } = await supabase
      .from('transportation_routes')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
    setRoutes((data as TransportationRoute[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [userId])

  async function saveRoute(
    fields: Omit<TransportationRoute, 'id' | 'user_id' | 'created_at'>
  ): Promise<void> {
    setError(null)
    if (modalState.mode === 'create') {
      const { error: insertError } = await supabase
        .from('transportation_routes')
        .insert({ user_id: userId, ...fields })
      if (insertError) {
        setError(insertError.message)
        return
      }
    } else if (modalState.mode === 'edit') {
      const { error: updateError } = await supabase
        .from('transportation_routes')
        .update(fields)
        .eq('id', modalState.item.id)
      if (updateError) {
        setError(updateError.message)
        return
      }
    }
    setModalState({ mode: 'closed' })
    load()
  }

  async function removeRoute(id: string): Promise<void> {
    if (!window.confirm('この交通費詳細を削除しますか?')) return
    await supabase.from('transportation_routes').delete().eq('id', id)
    load()
  }

  async function removeSelected(): Promise<void> {
    if (selectedIds.size === 0) return
    if (!window.confirm(`選択した${selectedIds.size}件の交通費詳細を削除しますか?`)) return
    setError(null)
    const { error: deleteError } = await supabase
      .from('transportation_routes')
      .delete()
      .in('id', Array.from(selectedIds))
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setSelectedIds(new Set())
    load()
  }

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll(): void {
    setSelectedIds((prev) =>
      prev.size === filteredRoutes.length ? new Set() : new Set(filteredRoutes.map((r) => r.id))
    )
  }

  const filteredRoutes =
    monthFilter === 'all' ? routes : routes.filter((r) => r.date.slice(0, 7) === monthFilter)

  function exportPdf(): void {
    if (filteredRoutes.length === 0) return
    // ポップアップブロックを避けるため、非同期処理の前にユーザー操作と同期して開く
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('ポップアップがブロックされました。ブラウザの設定でこのサイトのポップアップを許可してください。')
      return
    }
    setExporting(true)
    try {
      const html = buildTransportationListHtml(
        filteredRoutes.map((r) => ({
          date: r.date,
          departure: r.departure,
          arrival: r.arrival,
          distanceKm: r.distance_km,
          amount: Number(r.amount),
          memo: r.memo ?? ''
        })),
        userName,
        '交通費詳細'
      )
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } finally {
      setExporting(false)
    }
  }

  const total = filteredRoutes.reduce((sum, r) => sum + Number(r.amount), 0)

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">交通費詳細</h1>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-md border-2 border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700"
          >
            <option value="all">すべて</option>
            {recentMonths(12).map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleSelectAll}
            className="rounded-md border-2 border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            全選択
          </button>
          <button
            onClick={removeSelected}
            disabled={selectedIds.size === 0}
            className="rounded-md border-2 border-red-300 px-3 py-1.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            選択削除{selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
          <button
            onClick={exportPdf}
            disabled={exporting || routes.length === 0}
            className="rounded-md border-2 border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            {exporting ? '出力中…' : 'PDF出力'}
          </button>
          <button
            onClick={() => setModalState({ mode: 'create' })}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            + 交通費詳細を追加
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border-2 border-gray-300 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-base">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-100 text-sm font-bold text-gray-700">
                <th className="w-8 p-3">
                  <input
                    type="checkbox"
                    checked={filteredRoutes.length > 0 && selectedIds.size === filteredRoutes.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-200"
                  />
                </th>
                <th className="p-3">日付</th>
                <th className="p-3">出発地</th>
                <th className="p-3">到着地</th>
                <th className="p-3">距離(km)</th>
                <th className="p-3">金額</th>
                <th className="p-3">備考</th>
                <th className="p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-sm text-gray-500">
                    読み込み中…
                  </td>
                </tr>
              ) : filteredRoutes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-sm text-gray-500">
                    交通費詳細がまだありません。「+ 交通費詳細を追加」から入力してください。
                  </td>
                </tr>
              ) : (
                filteredRoutes.map((r) => (
                  <tr key={r.id} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelected(r.id)}
                        className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-200"
                      />
                    </td>
                    <td className="p-3 font-medium text-gray-900">{r.date}</td>
                    <td className="p-3 text-gray-900">{r.departure}</td>
                    <td className="p-3 text-gray-900">{r.arrival}</td>
                    <td className="p-3 text-gray-900">{r.distance_km}</td>
                    <td className="p-3 font-bold text-gray-900">{Number(r.amount).toLocaleString()} 円</td>
                    <td className="p-3 text-gray-900">{r.memo ?? '-'}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setModalState({ mode: 'edit', item: r })}
                          className="text-sm font-bold text-blue-600 hover:underline"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => removeRoute(r.id)}
                          className="text-sm font-bold text-red-600 hover:text-red-700 hover:underline"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between border-t-2 border-gray-300 pt-4">
          <p className="text-sm font-semibold text-gray-500">件数: {filteredRoutes.length}</p>
          <p className="text-xl font-bold text-gray-900">
            合計 <span className="ml-1">{total.toLocaleString()}</span>
            <span className="ml-0.5 text-sm font-semibold text-gray-500">円</span>
          </p>
        </div>
      </div>

      {modalState.mode !== 'closed' && settings && (
        <TransportationRouteModal
          initialItem={modalState.mode === 'edit' ? modalState.item : null}
          settings={settings}
          onSave={saveRoute}
          onClose={() => setModalState({ mode: 'closed' })}
        />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAppSettings } from '../lib/useAppSettings'
import { TransportationRouteModal } from '../components/TransportationRouteModal'
import type { TransportationRoute } from '../lib/types'

interface Props {
  userId: string
}

type ModalState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; item: TransportationRoute }

export function TransportationDetails({ userId }: Props): JSX.Element {
  const { settings } = useAppSettings()
  const [routes, setRoutes] = useState<TransportationRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState<ModalState>({ mode: 'closed' })
  const [error, setError] = useState<string | null>(null)

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

  const total = routes.reduce((sum, r) => sum + Number(r.amount), 0)

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">交通費詳細</h1>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setModalState({ mode: 'create' })}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            + 交通費詳細を追加
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
                <th className="p-2">日付</th>
                <th className="p-2">出発地</th>
                <th className="p-2">到着地</th>
                <th className="p-2">距離(km)</th>
                <th className="p-2">金額</th>
                <th className="p-2">備考</th>
                <th className="p-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-gray-400">
                    読み込み中…
                  </td>
                </tr>
              ) : routes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-gray-400">
                    交通費詳細がまだありません。「+ 交通費詳細を追加」から入力してください。
                  </td>
                </tr>
              ) : (
                routes.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="p-3 text-gray-700">{r.date}</td>
                    <td className="p-3 text-gray-700">{r.departure}</td>
                    <td className="p-3 text-gray-700">{r.arrival}</td>
                    <td className="p-3 text-gray-700">{r.distance_km}</td>
                    <td className="p-3 text-gray-700">{Number(r.amount).toLocaleString()} 円</td>
                    <td className="p-3 text-gray-700">{r.memo ?? '-'}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setModalState({ mode: 'edit', item: r })}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => removeRoute(r.id)}
                          className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline"
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

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-400">件数: {routes.length}</p>
          <p className="text-lg font-bold text-gray-900">
            合計 <span className="ml-1">{total.toLocaleString()}</span>
            <span className="ml-0.5 text-sm font-medium text-gray-400">円</span>
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

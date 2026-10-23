import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAppSettings, resolveEffectiveFuelSettings } from '../lib/useAppSettings'
import { TransportationRouteModal } from '../components/TransportationRouteModal'
import { buildTransportationListHtml } from '../lib/pdfExport'
import { formatMonthLabel, recentMonths } from '../lib/month'
import type { Profile, TransportationRoute } from '../lib/types'

interface Props {
  userId: string
  userName: string
  profile: Profile
  isAdmin: boolean
  onBack: () => void
}

type ModalState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; item: TransportationRoute }

export function TransportationDetails({
  userId,
  userName,
  profile,
  isAdmin,
  onBack
}: Props): JSX.Element {
  const { settings: globalSettings } = useAppSettings()
  const [employees, setEmployees] = useState<Profile[]>([])
  const [viewingUserId, setViewingUserId] = useState(userId)
  const [routes, setRoutes] = useState<TransportationRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState<ModalState>({ mode: 'closed' })
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('profiles')
      .select('*')
      .order('name')
      .then(({ data }) => setEmployees((data as Profile[]) ?? []))
  }, [isAdmin])

  const viewingProfile = isAdmin ? (employees.find((e) => e.id === viewingUserId) ?? profile) : profile
  const viewingUserName =
    isAdmin && viewingUserId !== userId
      ? (employees.find((e) => e.id === viewingUserId)?.name ?? userName)
      : userName
  const settings = globalSettings ? resolveEffectiveFuelSettings(globalSettings, viewingProfile) : null

  async function load(): Promise<void> {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('transportation_routes')
      .select('*')
      .eq('user_id', viewingUserId)
      .is('report_id', null)
      .order('date', { ascending: false })
    if (loadError) {
      setError(loadError.message)
      setRoutes([])
      setLoading(false)
      return
    }
    setRoutes((data as TransportationRoute[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    setSelectedIds(new Set())
  }, [viewingUserId])

  async function saveRoute(
    fields: Omit<TransportationRoute, 'id' | 'user_id' | 'created_at' | 'report_id'>
  ): Promise<void> {
    setError(null)
    if (modalState.mode === 'create') {
      const { error: insertError } = await supabase
        .from('transportation_routes')
        .insert({ user_id: viewingUserId, report_id: null, ...fields })
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

  async function submitSelected(): Promise<void> {
    const selectedRoutes = filteredRoutes.filter((r) => selectedIds.has(r.id))
    if (selectedRoutes.length === 0) {
      setError('申請する交通費詳細をチェックボックスで選択してください。')
      return
    }
    if (!window.confirm(`選択した${selectedRoutes.length}件を交通費として申請しますか?`)) return
    setError(null)
    setSubmitting(true)
    const total = selectedRoutes.reduce((sum, r) => sum + Number(r.amount), 0)
    const { data: newReport, error: insertError } = await supabase
      .from('expense_reports')
      .insert({
        user_id: viewingUserId,
        title: `${new Date().toLocaleDateString('ja-JP')} 交通費申請`,
        report_type: 'transportation',
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        total_amount: total
      })
      .select('id')
      .single()
    if (insertError || !newReport) {
      setSubmitting(false)
      setError(insertError?.message ?? '申請の作成に失敗しました')
      return
    }
    const { error: updateError } = await supabase
      .from('transportation_routes')
      .update({ report_id: newReport.id })
      .in('id', selectedRoutes.map((r) => r.id))
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSelectedIds(new Set())
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
    const selectedRoutes = filteredRoutes.filter((r) => selectedIds.has(r.id))
    if (selectedRoutes.length === 0) {
      setError('PDFに出力する交通費詳細をチェックボックスで選択してください。')
      return
    }
    setError(null)
    // ポップアップブロックを避けるため、非同期処理の前にユーザー操作と同期して開く
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('ポップアップがブロックされました。ブラウザの設定でこのサイトのポップアップを許可してください。')
      return
    }
    setExporting(true)
    try {
      const html = buildTransportationListHtml(
        selectedRoutes.map((r) => ({
          date: r.date,
          departure: r.departure,
          arrival: r.arrival,
          distanceKm: r.distance_km,
          amount: Number(r.amount),
          projectName: r.project_name ?? '',
          memo: r.memo ?? ''
        })),
        viewingUserName,
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
    <div className="w-full p-4 md:p-8">
      <button
        onClick={onBack}
        className="mb-4 text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline"
      >
        &lt; 戻る
      </button>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">交通費詳細</h1>
          {isAdmin && (
            <select
              value={viewingUserId}
              onChange={(e) => setViewingUserId(e.target.value)}
              className="rounded-md border-2 border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800"
            >
              <option value={userId}>自分({userName})</option>
              {employees
                .filter((e) => e.id !== userId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          )}
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
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          <button
            onClick={toggleSelectAll}
            className="rounded-md border-2 border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            全選択
          </button>
          <button
            onClick={removeSelected}
            disabled={selectedIds.size === 0}
            className="rounded-md border-2 border-red-300 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            選択削除{selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
          {viewingUserId === userId && (
            <button
              onClick={submitSelected}
              disabled={submitting || selectedIds.size === 0}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? '申請中…' : `申請する${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
            </button>
          )}
          <button
            onClick={exportPdf}
            disabled={exporting || selectedIds.size === 0}
            className="rounded-md border-2 border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            {exporting ? '出力中…' : `PDF出力${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
          </button>
          <button
            onClick={() => setModalState({ mode: 'create' })}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            + 追加
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-md border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border-2 border-gray-300 bg-white p-4 shadow-sm md:p-6">
        {/* スマホ表示: 縦スクロールのカード形式 */}
        <div className="space-y-3 md:hidden">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-500">読み込み中…</p>
          ) : filteredRoutes.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              交通費詳細がまだありません。「+ 追加」から入力してください。
            </p>
          ) : (
            filteredRoutes.map((r) => (
              <div key={r.id} className="rounded-lg border-2 border-gray-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelected(r.id)}
                      className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-200"
                    />
                    <span className="font-bold text-gray-900">{r.date}</span>
                  </label>
                  <span className="font-bold text-gray-900">
                    {Number(r.amount).toLocaleString()} 円
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800">
                  {r.departure} → {r.arrival}
                </p>
                <p className="mt-1 text-sm text-gray-500">距離: {r.distance_km} km</p>
                {r.project_name && (
                  <p className="mt-1 text-sm text-gray-500">案件名: {r.project_name}</p>
                )}
                {r.memo && <p className="mt-1 text-sm text-gray-500">備考: {r.memo}</p>}
                <div className="mt-3 flex justify-end gap-4 border-t border-gray-100 pt-3">
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
              </div>
            ))
          )}
        </div>

        {/* PC表示: 表形式 */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[840px] text-left text-base">
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
                <th className="whitespace-nowrap p-3">日付</th>
                <th className="p-3">出発地</th>
                <th className="p-3">到着地</th>
                <th className="whitespace-nowrap p-3">距離(km)</th>
                <th className="whitespace-nowrap p-3">金額</th>
                <th className="p-3">案件名</th>
                <th className="p-3">備考</th>
                <th className="whitespace-nowrap p-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-gray-500">
                    読み込み中…
                  </td>
                </tr>
              ) : filteredRoutes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-sm text-gray-500">
                    交通費詳細がまだありません。「+ 追加」から入力してください。
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
                    <td className="whitespace-nowrap p-3 font-medium text-gray-900">{r.date}</td>
                    <td className="p-3 text-gray-900">{r.departure}</td>
                    <td className="p-3 text-gray-900">{r.arrival}</td>
                    <td className="whitespace-nowrap p-3 text-gray-900">{r.distance_km}</td>
                    <td className="whitespace-nowrap p-3 font-bold text-gray-900">
                      {Number(r.amount).toLocaleString()} 円
                    </td>
                    <td className="p-3 text-gray-900">{r.project_name ?? '-'}</td>
                    <td className="p-3 text-gray-900">{r.memo ?? '-'}</td>
                    <td className="whitespace-nowrap p-3">
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

        <div className="mt-6 flex flex-col gap-2 border-t-2 border-gray-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
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

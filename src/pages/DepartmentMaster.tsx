import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDepartments } from '../lib/useDepartments'
import { useDepartmentApprovers } from '../lib/useDepartmentApprovers'
import type { Profile } from '../lib/types'

const inputClass =
  'rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

export function DepartmentMaster(): JSX.Element {
  const { departments, loading, refresh } = useDepartments()
  const { entries: approverEntries, refresh: refreshApprovers } = useDepartmentApprovers()
  const [approvers, setApprovers] = useState<Profile[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .in('role', ['manager', 'admin'])
      .order('name')
      .then(({ data }) => setApprovers((data as Profile[]) ?? []))
  }, [])

  async function addDepartment(): Promise<void> {
    if (!newName.trim()) return
    const { error: insertError } = await supabase.from('departments').insert({ name: newName.trim() })
    if (insertError) {
      setError(insertError.message)
      return
    }
    setNewName('')
    refresh()
  }

  async function addApprover(departmentId: string, approverId: string): Promise<void> {
    if (!approverId) return
    setError(null)
    const { error: insertError } = await supabase
      .from('department_approvers')
      .insert({ department_id: departmentId, approver_id: approverId })
    if (insertError) {
      setError(insertError.message)
      return
    }
    refreshApprovers()
  }

  async function removeApprover(departmentId: string, approverId: string): Promise<void> {
    setError(null)
    const { error: deleteError } = await supabase
      .from('department_approvers')
      .delete()
      .eq('department_id', departmentId)
      .eq('approver_id', approverId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    refreshApprovers()
  }

  async function removeDepartment(id: string): Promise<void> {
    await supabase.from('departments').delete().eq('id', id)
    refresh()
  }

  if (loading) return <p className="p-8 text-sm text-gray-500">読み込み中…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <h1 className="text-3xl font-bold text-gray-900">部署一覧</h1>
      {error && (
        <p className="rounded-md border-2 border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-xl border-2 border-gray-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-gray-300 p-5">
          <h2 className="text-lg font-bold text-gray-900">部署一覧</h2>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新しい部署名"
              className={`${inputClass} w-52`}
            />
            <button
              onClick={addDepartment}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              + 部署を追加
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-base">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-blue-50 text-sm font-bold text-blue-800">
                <th className="p-4">部署名</th>
                <th className="p-4">承認者(複数選択可)</th>
                <th className="p-4 text-right">削除</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-sm text-gray-500">
                    部署がまだありません。
                  </td>
                </tr>
              )}
              {departments.map((d) => {
                const current = approverEntries.filter((a) => a.department_id === d.id)
                const currentIds = new Set(current.map((a) => a.approver_id))
                const candidates = approvers.filter((a) => !currentIds.has(a.id))
                return (
                  <tr key={d.id} className="border-b border-gray-200 last:border-0">
                    <td className="p-4 font-semibold text-gray-900">{d.name}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {current.map((a) => (
                          <span
                            key={a.approver_id}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800"
                          >
                            {a.approver_name}
                            <button
                              onClick={() => removeApprover(d.id, a.approver_id)}
                              className="text-blue-500 hover:text-red-600"
                              aria-label={`${a.approver_name}を承認者から外す`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <select
                          value=""
                          onChange={(e) => addApprover(d.id, e.target.value)}
                          className={`${inputClass} w-32 text-xs`}
                        >
                          <option value="">+ 追加</option>
                          {candidates.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => removeDepartment(d.id)}
                        className="text-sm font-bold text-red-600 hover:text-red-700 hover:underline"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDepartments } from '../lib/useDepartments'
import type { Profile } from '../lib/types'

const inputClass =
  'rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'

export function DepartmentMaster(): JSX.Element {
  const { departments, loading, refresh } = useDepartments()
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

  async function setApprover(departmentId: string, approverId: string): Promise<void> {
    await supabase
      .from('departments')
      .update({ approver_id: approverId || null })
      .eq('id', departmentId)
    refresh()
  }

  async function removeDepartment(id: string): Promise<void> {
    await supabase.from('departments').delete().eq('id', id)
    refresh()
  }

  if (loading) return <p className="p-8 text-sm text-gray-400">読み込み中…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <h1 className="text-2xl font-bold text-gray-900">部署マスタ</h1>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800">部署一覧</h2>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新しい部署名"
              className={`${inputClass} w-52`}
            />
            <button
              onClick={addDepartment}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              + 部署を追加
            </button>
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-blue-50/60 text-xs font-medium text-blue-700">
              <th className="p-4">部署名</th>
              <th className="p-4">承認者</th>
              <th className="p-4 text-right">削除</th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-sm text-gray-400">
                  部署がまだありません。
                </td>
              </tr>
            )}
            {departments.map((d) => (
              <tr key={d.id} className="border-b border-gray-50 last:border-0">
                <td className="p-4 text-gray-700">{d.name}</td>
                <td className="p-4">
                  <select
                    value={d.approver_id ?? ''}
                    onChange={(e) => setApprover(d.id, e.target.value)}
                    className={inputClass}
                  >
                    <option value="">未設定</option>
                    {approvers.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => removeDepartment(d.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

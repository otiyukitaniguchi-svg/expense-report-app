import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDepartments } from '../lib/useDepartments'
import type { Profile, Role } from '../lib/types'

const inputClass =
  'rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'

const roleLabels: Record<Role, string> = {
  employee: '一般ユーザー',
  manager: '承認者',
  admin: '管理者'
}

export function EmployeeMaster(): JSX.Element {
  const { departments } = useDepartments()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function load(): Promise<void> {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('name')
    setProfiles((data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const departmentById = new Map(departments.map((d) => [d.id, d]))
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  async function updateRole(id: string, role: Role): Promise<void> {
    await supabase.from('profiles').update({ role }).eq('id', id)
    load()
  }

  async function updateDepartment(id: string, departmentId: string): Promise<void> {
    const department = departmentId ? departmentById.get(departmentId) : null
    await supabase
      .from('profiles')
      .update({
        department_id: departmentId || null,
        manager_id: department?.approver_id ?? null
      })
      .eq('id', id)
    load()
  }

  if (loading) return <p className="p-8 text-sm text-gray-400">読み込み中…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <h1 className="text-2xl font-bold text-gray-900">社員マスタ</h1>
      <p className="text-sm text-gray-500">
        新しい社員の追加はSupabaseダッシュボードの Authentication 画面から行ってください。ここでは役割・所属部署の編集ができます。
      </p>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-blue-50/60 text-xs font-medium text-blue-700">
              <th className="p-4">氏名</th>
              <th className="p-4">役割</th>
              <th className="p-4">部署</th>
              <th className="p-4">承認者</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const manager = p.manager_id ? profileById.get(p.manager_id) : null
              return (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="p-4 font-medium text-gray-800">{p.name}</td>
                  <td className="p-4">
                    <select
                      value={p.role}
                      onChange={(e) => updateRole(p.id, e.target.value as Role)}
                      className={inputClass}
                    >
                      {(Object.keys(roleLabels) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {roleLabels[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    <select
                      value={p.department_id ?? ''}
                      onChange={(e) => updateDepartment(p.id, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">未設定</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-gray-500">{manager?.name ?? '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

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

interface NewEmployeeForm {
  email: string
  password: string
  name: string
  role: Role
  departmentId: string
}

const emptyForm: NewEmployeeForm = {
  email: '',
  password: '',
  name: '',
  role: 'employee',
  departmentId: ''
}

export function EmployeeMaster(): JSX.Element {
  const { departments } = useDepartments()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<NewEmployeeForm>(emptyForm)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('name')
    const list = (data as Profile[]) ?? []
    setProfiles(list)
    setNames(Object.fromEntries(list.map((p) => [p.id, p.name])))
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

  async function saveName(id: string): Promise<void> {
    const name = names[id]?.trim()
    if (!name) return
    await supabase.from('profiles').update({ name }).eq('id', id)
    load()
  }

  async function createEmployee(): Promise<void> {
    setError(null)
    if (!form.email.trim() || !form.password || !form.name.trim()) {
      setError('メールアドレス・パスワード・氏名は必須です')
      return
    }
    setCreating(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setError('セッションが切れています。再ログインしてください。')
        return
      }
      const res = await fetch('/api/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim(),
          role: form.role,
          departmentId: form.departmentId || null
        })
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? '社員の追加に失敗しました')
        return
      }
      setForm(emptyForm)
      load()
    } catch {
      setError('社員の追加に失敗しました。しばらくしてから再度お試しください。')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <p className="p-8 text-sm text-gray-400">読み込み中…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <h1 className="text-2xl font-bold text-gray-900">社員マスタ</h1>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">社員を追加</h2>
        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="氏名"
            className={inputClass}
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="ログイン用メールアドレス"
            className={inputClass}
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="パスワード(6文字以上)"
            className={inputClass}
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className={inputClass}
          >
            {(Object.keys(roleLabels) as Role[]).map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
          <select
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            className={inputClass}
          >
            <option value="">部署未設定</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={createEmployee}
          disabled={creating}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? '追加中…' : '+ 社員を追加'}
        </button>
      </section>

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
                  <td className="p-4">
                    <input
                      value={names[p.id] ?? ''}
                      onChange={(e) => setNames({ ...names, [p.id]: e.target.value })}
                      onBlur={() => saveName(p.id)}
                      className={`${inputClass} w-40 font-medium text-gray-800`}
                    />
                  </td>
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

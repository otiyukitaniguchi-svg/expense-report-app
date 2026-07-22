import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDepartments } from '../lib/useDepartments'
import { PasswordInput } from '../components/PasswordInput'
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

async function callAdminApi(path: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    return { ok: false, error: 'セッションが切れています。再ログインしてください。' }
  }
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body)
    })
    const responseBody = await res.json()
    if (!res.ok) return { ok: false, error: responseBody.error ?? '処理に失敗しました' }
    return { ok: true }
  } catch {
    return { ok: false, error: '通信に失敗しました。しばらくしてから再度お試しください。' }
  }
}

export function EmployeeMaster(): JSX.Element {
  const { departments } = useDepartments()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({})
  const [changingPasswordFor, setChangingPasswordFor] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<Record<string, string>>({})
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
    const result = await callAdminApi('/api/create-employee', {
      email: form.email.trim(),
      password: form.password,
      name: form.name.trim(),
      role: form.role,
      departmentId: form.departmentId || null
    })
    setCreating(false)
    if (!result.ok) {
      setError(result.error ?? '社員の追加に失敗しました')
      return
    }
    setForm(emptyForm)
    load()
  }

  async function changePassword(id: string): Promise<void> {
    const password = newPasswords[id]
    if (!password) return
    setChangingPasswordFor(id)
    setPasswordMessage((prev) => ({ ...prev, [id]: '' }))
    const result = await callAdminApi('/api/update-employee-password', { userId: id, password })
    setChangingPasswordFor(null)
    setPasswordMessage((prev) => ({
      ...prev,
      [id]: result.ok ? '変更しました' : (result.error ?? '変更に失敗しました')
    }))
    if (result.ok) {
      setNewPasswords((prev) => ({ ...prev, [id]: '' }))
    }
  }

  if (loading) return <p className="p-8 text-sm text-gray-400">読み込み中…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <h1 className="text-2xl font-bold text-gray-900">社員一覧</h1>

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
            placeholder="メールアドレス(社内管理用。ログインは氏名で行います)"
            className={inputClass}
          />
          <PasswordInput
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
              <th className="p-4">パスワード変更</th>
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
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <PasswordInput
                        value={newPasswords[p.id] ?? ''}
                        onChange={(e) =>
                          setNewPasswords({ ...newPasswords, [p.id]: e.target.value })
                        }
                        placeholder="新しいパスワード"
                        className={`${inputClass} w-36`}
                      />
                      <button
                        onClick={() => changePassword(p.id)}
                        disabled={changingPasswordFor === p.id || !newPasswords[p.id]}
                        className="whitespace-nowrap rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                      >
                        {changingPasswordFor === p.id ? '変更中…' : '変更'}
                      </button>
                    </div>
                    {passwordMessage[p.id] && (
                      <p
                        className={`mt-1 text-xs ${
                          passwordMessage[p.id] === '変更しました' ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {passwordMessage[p.id]}
                      </p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

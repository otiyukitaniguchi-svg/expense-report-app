import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDepartments } from '../lib/useDepartments'
import { PasswordInput } from '../components/PasswordInput'
import { EmployeeFormModal } from '../components/EmployeeFormModal'
import type { Profile, Role } from '../lib/types'

const inputClass =
  'rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

const roleLabels: Record<Role, string> = {
  employee: '一般ユーザー',
  manager: '承認者',
  admin: '管理者'
}

async function callAdminApi(
  path: string,
  body: unknown
): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
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
    return { ok: true, data: responseBody }
  } catch {
    return { ok: false, error: '通信に失敗しました。しばらくしてから再度お試しください。' }
  }
}

export function EmployeeMaster(): JSX.Element {
  const { departments } = useDepartments()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({})
  const [emailMessage, setEmailMessage] = useState<Record<string, string>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({})
  const [changingPasswordFor, setChangingPasswordFor] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('name')
    const list = (data as Profile[]) ?? []
    setProfiles(list)
    setNames(Object.fromEntries(list.map((p) => [p.id, p.name])))
    setLoading(false)

    const result = await callAdminApi('/api/list-employee-emails', {})
    if (result.ok) {
      const emailMap = (result.data?.emails as Record<string, string>) ?? {}
      setEmails(emailMap)
      setEmailDrafts(emailMap)
    }
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

  async function saveEmail(id: string): Promise<void> {
    const email = emailDrafts[id]?.trim()
    if (!email || email === emails[id]) return
    setEmailMessage((prev) => ({ ...prev, [id]: '' }))
    const result = await callAdminApi('/api/update-employee-email', { userId: id, email })
    setEmailMessage((prev) => ({
      ...prev,
      [id]: result.ok ? '変更しました' : (result.error ?? '変更に失敗しました')
    }))
    if (result.ok) {
      setEmails((prev) => ({ ...prev, [id]: email }))
    }
  }

  async function createEmployee(fields: {
    name: string
    email: string
    password: string
    role: Role
    departmentId: string
  }): Promise<string | null> {
    const result = await callAdminApi('/api/create-employee', {
      email: fields.email,
      password: fields.password,
      name: fields.name,
      role: fields.role,
      departmentId: fields.departmentId || null
    })
    if (!result.ok) return result.error ?? '社員の追加に失敗しました'
    setShowAddModal(false)
    load()
    return null
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

  if (loading) return <p className="p-8 text-sm text-gray-500">読み込み中…</p>

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">社員一覧</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          + 社員を追加
        </button>
      </div>

      <section className="rounded-xl border-2 border-gray-300 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-base">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-blue-50 text-sm font-bold text-blue-800">
                <th className="p-4">氏名</th>
                <th className="p-4">メールアドレス</th>
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
                  <tr key={p.id} className="border-b border-gray-200 last:border-0">
                    <td className="p-4">
                      <input
                        value={names[p.id] ?? ''}
                        onChange={(e) => setNames({ ...names, [p.id]: e.target.value })}
                        onBlur={() => saveName(p.id)}
                        className={`${inputClass} w-40 font-bold text-gray-900`}
                      />
                    </td>
                    <td className="p-4">
                      <input
                        type="email"
                        value={emailDrafts[p.id] ?? ''}
                        onChange={(e) => setEmailDrafts({ ...emailDrafts, [p.id]: e.target.value })}
                        onBlur={() => saveEmail(p.id)}
                        className={`${inputClass} w-52`}
                      />
                      {emailMessage[p.id] && (
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            emailMessage[p.id] === '変更しました' ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {emailMessage[p.id]}
                        </p>
                      )}
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
                  <td className="p-4 font-semibold text-gray-700">{manager?.name ?? '-'}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <PasswordInput
                        value={newPasswords[p.id] ?? ''}
                        onChange={(e) =>
                          setNewPasswords({ ...newPasswords, [p.id]: e.target.value })
                        }
                        placeholder="新しいパスワード"
                        autoComplete="new-password"
                        className={`${inputClass} w-36`}
                      />
                      <button
                        onClick={() => changePassword(p.id)}
                        disabled={changingPasswordFor === p.id || !newPasswords[p.id]}
                        className="whitespace-nowrap rounded-md border-2 border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                      >
                        {changingPasswordFor === p.id ? '変更中…' : '変更'}
                      </button>
                    </div>
                    {passwordMessage[p.id] && (
                      <p
                        className={`mt-1 text-xs font-semibold ${
                          passwordMessage[p.id] === '変更しました' ? 'text-emerald-600' : 'text-red-600'
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
        </div>
      </section>

      {showAddModal && (
        <EmployeeFormModal
          departments={departments}
          roleLabels={roleLabels}
          onSave={createEmployee}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}

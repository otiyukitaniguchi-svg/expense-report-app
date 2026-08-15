import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDepartments } from '../lib/useDepartments'
import { useDepartmentApprovers } from '../lib/useDepartmentApprovers'
import { PasswordInput } from '../components/PasswordInput'
import { EmployeeFormModal } from '../components/EmployeeFormModal'
import { EmployeeFuelModal } from '../components/EmployeeFuelModal'
import type { Profile, Role } from '../lib/types'

const inputClass =
  'w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const fieldLabelClass = 'mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500'

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
  const { entries: approverEntries } = useDepartmentApprovers()
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
  const [fuelModalFor, setFuelModalFor] = useState<Profile | null>(null)

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

  async function updateRole(id: string, role: Role): Promise<void> {
    await supabase.from('profiles').update({ role }).eq('id', id)
    load()
  }

  async function updateDepartment(id: string, departmentId: string): Promise<void> {
    await supabase
      .from('profiles')
      .update({ department_id: departmentId || null })
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

  async function saveFuelSettings(fields: {
    fuel_price_per_liter: number | null
    fuel_efficiency_km_per_liter: number | null
    seasonal_index_summer: number | null
    seasonal_index_winter: number | null
  }): Promise<void> {
    if (!fuelModalFor) return
    await supabase.from('profiles').update(fields).eq('id', fuelModalFor.id)
    setFuelModalFor(null)
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

  if (loading) return <p className="p-8 text-sm text-gray-500">読み込み中…</p>

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">社員一覧</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          + 社員を追加
        </button>
      </div>

      <div className="space-y-4">
        {profiles.map((p) => {
          const approverNames = approverEntries
            .filter((a) => a.department_id === p.department_id)
            .map((a) => a.approver_name)
          const hasFuelOverride =
            p.fuel_price_per_liter !== null ||
            p.fuel_efficiency_km_per_liter !== null ||
            p.seasonal_index_summer !== null ||
            p.seasonal_index_winter !== null

          return (
            <section
              key={p.id}
              className="rounded-xl border-2 border-gray-300 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-center gap-3 border-b-2 border-gray-100 pb-4">
                <input
                  value={names[p.id] ?? ''}
                  onChange={(e) => setNames({ ...names, [p.id]: e.target.value })}
                  onBlur={() => saveName(p.id)}
                  className="w-52 rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-lg font-bold text-gray-900 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <select
                  value={p.role}
                  onChange={(e) => updateRole(p.id, e.target.value as Role)}
                  className="rounded-full border-2 border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800"
                >
                  {(Object.keys(roleLabels) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={fieldLabelClass}>メールアドレス</label>
                  <input
                    type="email"
                    value={emailDrafts[p.id] ?? ''}
                    onChange={(e) => setEmailDrafts({ ...emailDrafts, [p.id]: e.target.value })}
                    onBlur={() => saveEmail(p.id)}
                    className={inputClass}
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
                </div>

                <div>
                  <label className={fieldLabelClass}>部署</label>
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
                </div>

                <div>
                  <label className={fieldLabelClass}>承認者</label>
                  <p className="rounded-md border-2 border-transparent px-3 py-2 text-sm font-semibold text-gray-700">
                    {approverNames.length > 0 ? approverNames.join('、') : '-'}
                  </p>
                </div>

                <div>
                  <label className={fieldLabelClass}>燃費設定</label>
                  <button
                    onClick={() => setFuelModalFor(p)}
                    className="w-full rounded-md border-2 border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {hasFuelOverride ? '個別設定あり' : '会社共通設定'}
                    {hasFuelOverride && <span className="ml-1.5 text-emerald-600">●</span>}
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t-2 border-gray-100 pt-4">
                <label className={fieldLabelClass}>パスワード変更</label>
                <div className="flex flex-wrap items-center gap-2">
                  <PasswordInput
                    value={newPasswords[p.id] ?? ''}
                    onChange={(e) => setNewPasswords({ ...newPasswords, [p.id]: e.target.value })}
                    placeholder="新しいパスワード"
                    autoComplete="new-password"
                    className={`${inputClass} w-56`}
                  />
                  <button
                    onClick={() => changePassword(p.id)}
                    disabled={changingPasswordFor === p.id || !newPasswords[p.id]}
                    className="whitespace-nowrap rounded-md border-2 border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                  >
                    {changingPasswordFor === p.id ? '変更中…' : '変更'}
                  </button>
                  {passwordMessage[p.id] && (
                    <p
                      className={`text-xs font-semibold ${
                        passwordMessage[p.id] === '変更しました' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {passwordMessage[p.id]}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </div>

      {showAddModal && (
        <EmployeeFormModal
          departments={departments}
          roleLabels={roleLabels}
          onSave={createEmployee}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {fuelModalFor && (
        <EmployeeFuelModal
          profile={fuelModalFor}
          onSave={saveFuelSettings}
          onClose={() => setFuelModalFor(null)}
        />
      )}
    </div>
  )
}

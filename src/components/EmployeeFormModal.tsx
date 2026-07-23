import { useState } from 'react'
import { PasswordInput } from './PasswordInput'
import type { Department } from '../lib/types'
import type { Role } from '../lib/types'

interface Props {
  departments: Department[]
  roleLabels: Record<Role, string>
  onSave: (fields: {
    name: string
    email: string
    password: string
    role: Role
    departmentId: string
  }) => Promise<string | null>
  onClose: () => void
}

const fieldClass =
  'w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700'

export function EmployeeFormModal({ departments, roleLabels, onSave, onClose }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [departmentId, setDepartmentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(): Promise<void> {
    setError(null)
    if (!name.trim() || !email.trim() || !password) {
      setError('氏名・メールアドレス・パスワードは必須です')
      return
    }
    setSaving(true)
    const message = await onSave({ name: name.trim(), email: email.trim(), password, role, departmentId })
    setSaving(false)
    if (message) setError(message)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-6 pb-4">
          <h2 className="text-lg font-bold text-gray-900">社員を追加</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          {error && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="space-y-4">
            <div>
              <label className={labelClass}>氏名</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="社内管理用。ログインは氏名で行います"
                autoComplete="off"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>パスワード</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
                autoComplete="new-password"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>役割</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={fieldClass}>
                {(Object.keys(roleLabels) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>部署</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={fieldClass}
              >
                <option value="">部署未設定</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 p-6 pt-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '追加中…' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}

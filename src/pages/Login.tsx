import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { PasswordInput } from '../components/PasswordInput'

export function Login(): JSX.Element {
  const { signIn } = useAuth()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const message = await signIn(name, password)
    setSubmitting(false)
    if (message) setError(message)
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-10 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-base font-bold text-white">
            経
          </div>
          <h1 className="text-lg font-bold text-gray-900">経費精算システム</h1>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-gray-700">氏名</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-5 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <label className="mb-1.5 block text-sm font-medium text-gray-700">パスワード</label>
        <PasswordInput
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          wrapperClassName="mb-5"
          className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 transition focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        {error && (
          <p className="mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'ログイン中…' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}

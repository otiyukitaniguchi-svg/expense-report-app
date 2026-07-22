import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Login } from './pages/Login'
import { Drafts } from './pages/Drafts'
import { ReportStatus } from './pages/ReportStatus'
import { ReportForm } from './pages/ReportForm'
import { Approvals } from './pages/Approvals'
import { AdminSettings } from './pages/AdminSettings'
import { EmployeeMaster } from './pages/EmployeeMaster'
import { DepartmentMaster } from './pages/DepartmentMaster'
import { Settings } from './pages/Settings'
import otiLogo from './assets/oti-logo.png'

type View =
  | { name: 'drafts' }
  | { name: 'reportStatus' }
  | { name: 'report'; id: string | null }
  | { name: 'approvals' }
  | { name: 'admin' }
  | { name: 'employees' }
  | { name: 'departments' }
  | { name: 'settings' }

const roleLabels = { employee: '一般ユーザー', manager: '承認者', admin: '管理者' } as const

function NavItem({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
        active ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      {label}
    </button>
  )
}

function Shell(): JSX.Element {
  const { session, profile, loading, signOut } = useAuth()
  const [view, setView] = useState<View>({ name: 'drafts' })

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-sm text-gray-400">
        読み込み中…
      </div>
    )
  }

  if (!session || !profile) return <Login />

  const canApprove = profile.role === 'manager' || profile.role === 'admin'
  const isAdmin = profile.role === 'admin'
  const isNewReportView = view.name === 'report' && view.id === null

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="flex w-60 flex-col border-r border-gray-100 bg-white px-4 py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <img src={otiLogo} alt="OTI" className="h-8 w-auto" />
          <span className="text-lg font-bold text-gray-900">経費精算</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          <NavItem
            label="新規登録"
            active={isNewReportView}
            onClick={() => setView({ name: 'report', id: null })}
          />
          <NavItem
            label="申請"
            active={view.name === 'drafts'}
            onClick={() => setView({ name: 'drafts' })}
          />
          <NavItem
            label="申請状況"
            active={view.name === 'reportStatus'}
            onClick={() => setView({ name: 'reportStatus' })}
          />
          {canApprove && (
            <NavItem
              label="承認"
              active={view.name === 'approvals'}
              onClick={() => setView({ name: 'approvals' })}
            />
          )}
          {isAdmin && (
            <>
              <div className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-300">
                管理者設定
              </div>
              <NavItem
                label="社員一覧"
                active={view.name === 'employees'}
                onClick={() => setView({ name: 'employees' })}
              />
              <NavItem
                label="部署一覧"
                active={view.name === 'departments'}
                onClick={() => setView({ name: 'departments' })}
              />
              <NavItem
                label="勘定科目一覧"
                active={view.name === 'admin'}
                onClick={() => setView({ name: 'admin' })}
              />
              <NavItem
                label="設定"
                active={view.name === 'settings'}
                onClick={() => setView({ name: 'settings' })}
              />
            </>
          )}
        </nav>

        <div className="border-t border-gray-100 pt-4">
          <p className="truncate px-2 text-sm font-medium text-gray-800">{profile.name}</p>
          <p className="px-2 text-xs text-gray-400">{roleLabels[profile.role]}</p>
          <button
            onClick={signOut}
            className="mt-3 w-full rounded-lg px-2 py-2 text-left text-sm text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          >
            ログアウト
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {view.name === 'drafts' && (
          <Drafts
            userId={profile.id}
            userName={profile.name}
            onOpenReport={(id) => setView({ name: 'report', id })}
          />
        )}
        {view.name === 'reportStatus' && (
          <ReportStatus userId={profile.id} onOpenReport={(id) => setView({ name: 'report', id })} />
        )}
        {view.name === 'report' && (
          <ReportForm
            userId={profile.id}
            reportId={view.id}
            onDone={() => setView({ name: 'drafts' })}
          />
        )}
        {view.name === 'approvals' && (
          <Approvals managerId={profile.id} onOpenReport={(id) => setView({ name: 'report', id })} />
        )}
        {view.name === 'employees' && <EmployeeMaster />}
        {view.name === 'departments' && <DepartmentMaster />}
        {view.name === 'admin' && <AdminSettings />}
        {view.name === 'settings' && <Settings />}
      </main>
    </div>
  )
}

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}

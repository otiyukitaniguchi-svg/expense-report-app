import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Login } from './pages/Login'
import { ReportStatus } from './pages/ReportStatus'
import { ReportForm } from './pages/ReportForm'
import { Approvals } from './pages/Approvals'
import { AdminSettings } from './pages/AdminSettings'
import { EmployeeMaster } from './pages/EmployeeMaster'
import { DepartmentMaster } from './pages/DepartmentMaster'
import { Settings } from './pages/Settings'
import { TransportationDetails } from './pages/TransportationDetails'
import { ExpenseRules } from './pages/ExpenseRules'
import otiLogo from './assets/oti-logo.png'
import { currentMonthStr } from './lib/month'

type View =
  | { name: 'reportStatus' }
  | { name: 'transportation' }
  | { name: 'rules' }
  | { name: 'report'; id: string | null; month?: string }
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
      className={`w-full rounded-lg px-3 py-2.5 text-left text-base font-bold transition ${
        active
          ? 'border-2 border-blue-300 bg-blue-50 text-blue-800'
          : 'border-2 border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  )
}

function Shell(): JSX.Element {
  const { session, profile, loading, signOut } = useAuth()
  const [view, setView] = useState<View>({ name: 'report', id: null, month: currentMonthStr() })
  const [menuOpen, setMenuOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-50 text-sm font-semibold text-gray-500">
        読み込み中…
      </div>
    )
  }

  if (!session || !profile) return <Login />

  const canApprove = profile.role === 'manager' || profile.role === 'admin'
  const isAdmin = profile.role === 'admin'
  const isNewReportView = view.name === 'report' && view.id === null

  function go(next: View): void {
    setView(next)
    setMenuOpen(false)
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-50 md:flex-row">
      <header className="flex items-center justify-between border-b-2 border-gray-300 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <img src={otiLogo} alt="OTI" className="h-7 w-auto" />
          <span className="text-lg font-bold text-gray-900">経費精算</span>
        </div>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="メニュー"
          className="rounded-md border-2 border-gray-300 p-2 text-gray-700"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </header>

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r-2 border-gray-300 bg-white px-4 py-6 transition-transform duration-200 ease-in-out md:static md:z-auto md:flex md:w-64 md:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 hidden items-center gap-2 px-2 md:flex">
          <img src={otiLogo} alt="OTI" className="h-8 w-auto" />
          <span className="text-xl font-bold text-gray-900">経費精算</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          <NavItem
            label="新規登録"
            active={isNewReportView}
            onClick={() => go({ name: 'report', id: null, month: currentMonthStr() })}
          />
          <NavItem
            label="申請状況"
            active={view.name === 'reportStatus'}
            onClick={() => go({ name: 'reportStatus' })}
          />
          <NavItem
            label="交通費詳細"
            active={view.name === 'transportation'}
            onClick={() => go({ name: 'transportation' })}
          />
          <NavItem
            label="経費精算ルール"
            active={view.name === 'rules'}
            onClick={() => go({ name: 'rules' })}
          />
          {canApprove && (
            <NavItem
              label="承認"
              active={view.name === 'approvals'}
              onClick={() => go({ name: 'approvals' })}
            />
          )}
          {isAdmin && (
            <>
              <div className="mb-1 mt-4 px-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                管理者設定
              </div>
              <NavItem
                label="社員一覧"
                active={view.name === 'employees'}
                onClick={() => go({ name: 'employees' })}
              />
              <NavItem
                label="部署一覧"
                active={view.name === 'departments'}
                onClick={() => go({ name: 'departments' })}
              />
              <NavItem
                label="勘定科目一覧"
                active={view.name === 'admin'}
                onClick={() => go({ name: 'admin' })}
              />
              <NavItem
                label="設定"
                active={view.name === 'settings'}
                onClick={() => go({ name: 'settings' })}
              />
            </>
          )}
        </nav>

        <div className="border-t-2 border-gray-300 pt-4">
          <p className="truncate px-2 text-base font-bold text-gray-900">{profile.name}</p>
          <p className="px-2 text-sm font-semibold text-gray-500">{roleLabels[profile.role]}</p>
          <button
            onClick={signOut}
            className="mt-3 w-full rounded-lg border-2 border-gray-300 px-2 py-2 text-left text-sm font-bold text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
          >
            ログアウト
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {view.name === 'reportStatus' && (
          <ReportStatus
            userId={profile.id}
            userName={profile.name}
            onOpenReport={(id) => setView({ name: 'report', id })}
          />
        )}
        {view.name === 'report' && (
          <ReportForm
            userId={profile.id}
            reportId={view.id}
            month={view.month}
            onDone={() => setView({ name: 'reportStatus' })}
          />
        )}
        {view.name === 'transportation' && (
          <TransportationDetails userId={profile.id} userName={profile.name} />
        )}
        {view.name === 'rules' && <ExpenseRules isAdmin={isAdmin} />}
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

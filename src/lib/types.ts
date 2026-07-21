export type Role = 'employee' | 'manager' | 'admin'

export interface Profile {
  id: string
  name: string
  role: Role
  manager_id: string | null
  department_id: string | null
}

export interface Department {
  id: string
  name: string
  approver_id: string | null
}

export interface ExpenseCategory {
  id: string
  name: string
  is_active: boolean
}

export interface TaxCategory {
  id: string
  name: string
  rate: number
}

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface ExpenseReport {
  id: string
  user_id: string
  title: string
  status: ReportStatus
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  total_amount: number
  created_at: string
}

export interface ExpenseItem {
  id: string
  report_id: string
  date: string
  category_id: string | null
  tax_category_id: string | null
  amount: number
  description: string
  payee: string | null
  invoice_number: string | null
}

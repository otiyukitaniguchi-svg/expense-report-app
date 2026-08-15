export type Role = 'employee' | 'manager' | 'admin'

export interface Profile {
  id: string
  name: string
  role: Role
  department_id: string | null
  fuel_price_per_liter: number | null
  fuel_efficiency_km_per_liter: number | null
  seasonal_index_summer: number | null
  seasonal_index_winter: number | null
}

export interface Department {
  id: string
  name: string
}

export interface DepartmentApprover {
  department_id: string
  approver_id: string
  approver_name: string
}

export interface ExpenseCategory {
  id: string
  name: string
  is_active: boolean
  default_tax_category_id: string | null
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
  report_month: string | null
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
  memo: string | null
  sort_order: number
}

export interface TransportationRoute {
  id: string
  user_id: string
  date: string
  departure: string
  arrival: string
  distance_km: number
  amount: number
  project_name: string | null
  memo: string | null
  created_at: string
}

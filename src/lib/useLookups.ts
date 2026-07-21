import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import type { ExpenseCategory, TaxCategory } from './types'

export function useLookups(): {
  categories: ExpenseCategory[]
  taxCategories: TaxCategory[]
  loading: boolean
  refresh: () => Promise<void>
} {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh(): Promise<void> {
    setLoading(true)
    const [{ data: cats }, { data: taxes }] = await Promise.all([
      supabase.from('expense_categories').select('*').order('name'),
      supabase.from('tax_categories').select('*').order('rate', { ascending: false })
    ])
    setCategories((cats as ExpenseCategory[]) ?? [])
    setTaxCategories((taxes as TaxCategory[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  return { categories, taxCategories, loading, refresh }
}

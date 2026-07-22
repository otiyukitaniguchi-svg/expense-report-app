export function currentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  return `${year}年${Number(month)}月`
}

export function recentMonths(count: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export function monthOfDateStr(dateStr: string | null): string | null {
  if (!dateStr) return null
  return dateStr.slice(0, 7)
}

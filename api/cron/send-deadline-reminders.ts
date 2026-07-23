import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

interface AppSettingsRow {
  submission_deadline_day: number
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

function todayInJst(): Date {
  const now = new Date()
  return new Date(now.getTime() + JST_OFFSET_MS)
}

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function lastDayOfMonth(year: number, month: number): number {
  // month is 0-indexed; day 0 of next month = last day of this month
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

async function fetchJapaneseHolidays(): Promise<Set<string>> {
  const res = await fetch('https://holidays-jp.github.io/api/v1/date.json')
  if (!res.ok) return new Set()
  const data = (await res.json()) as Record<string, string>
  return new Set(Object.keys(data))
}

function isBusinessDay(d: Date, holidays: Set<string>): boolean {
  const day = d.getUTCDay()
  if (day === 0 || day === 6) return false
  return !holidays.has(toDateKey(d))
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: '認証に失敗しました' })
      return
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
    res.status(500).json({ error: 'サーバー環境変数が設定されていません' })
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: settings, error: settingsError } = await adminClient
    .from('app_settings')
    .select('submission_deadline_day')
    .eq('id', true)
    .single()
  if (settingsError || !settings) {
    res.status(500).json({ error: settingsError?.message ?? '設定の取得に失敗しました' })
    return
  }

  const today = todayInJst()
  const deadlineDay = Math.min(
    (settings as AppSettingsRow).submission_deadline_day,
    lastDayOfMonth(today.getUTCFullYear(), today.getUTCMonth())
  )
  const deadlineDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), deadlineDay))

  const holidays = await fetchJapaneseHolidays()

  const reminderDate = new Date(deadlineDate)
  let businessDaysCounted = 0
  while (businessDaysCounted < 3) {
    reminderDate.setUTCDate(reminderDate.getUTCDate() - 1)
    if (isBusinessDay(reminderDate, holidays)) businessDaysCounted++
  }

  if (toDateKey(reminderDate) !== toDateKey(today)) {
    res.status(200).json({ sent: 0, message: '本日はリマインダー送信日ではありません' })
    return
  }

  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, name')
    .eq('notify_enabled', true)
  if (profilesError) {
    res.status(500).json({ error: profilesError.message })
    return
  }

  const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({
    perPage: 1000
  })
  if (usersError) {
    res.status(500).json({ error: usersError.message })
    return
  }
  const emailById = new Map(usersData.users.map((u) => [u.id, u.email]))

  const deadlineLabel = `${today.getUTCFullYear()}年${today.getUTCMonth() + 1}月${deadlineDay}日`
  let sent = 0
  const failures: string[] = []

  for (const profile of (profiles as { id: string; name: string }[]) ?? []) {
    const email = emailById.get(profile.id)
    if (!email) continue
    try {
      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `【経費精算】締め切りのお知らせ(${deadlineLabel})`,
          html: `<p>${profile.name} 様</p><p>経費精算の提出締め切りは <strong>${deadlineLabel}</strong> です。<br />お忘れの場合は早めにご提出ください。</p>`
        })
      })
      if (sendRes.ok) {
        sent++
      } else {
        failures.push(profile.name)
      }
    } catch {
      failures.push(profile.name)
    }
  }

  res.status(200).json({ sent, failures, deadlineLabel })
}

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '認証が必要です' })
    return
  }
  const accessToken = authHeader.slice('Bearer '.length)

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    res.status(500).json({ error: 'サーバー環境変数(SUPABASE_SERVICE_ROLE_KEY等)が設定されていません' })
    return
  }

  const callerClient = createClient(supabaseUrl, anonKey)
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(accessToken)
  if (callerError || !callerData.user) {
    res.status(401).json({ error: '認証に失敗しました' })
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .single()
  if (callerProfileError || callerProfile?.role !== 'admin') {
    res.status(403).json({ error: '管理者権限が必要です' })
    return
  }

  const { email, password, name, role, departmentId } = (req.body ?? {}) as {
    email?: string
    password?: string
    name?: string
    role?: string
    departmentId?: string | null
  }

  if (!email || !password || !name) {
    res.status(400).json({ error: 'email・password・nameは必須です' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'パスワードは6文字以上にしてください' })
    return
  }
  if (role && !['employee', 'manager', 'admin'].includes(role)) {
    res.status(400).json({ error: '不正なroleです' })
    return
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name }
  })
  if (createError || !created.user) {
    res.status(400).json({ error: createError?.message ?? 'ユーザー作成に失敗しました' })
    return
  }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ name, role: role ?? 'employee', department_id: departmentId ?? null })
    .eq('id', created.user.id)
  if (updateError) {
    res.status(400).json({ error: updateError.message })
    return
  }

  res.status(200).json({ id: created.user.id })
}

import type { VercelRequest } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type VerifyResult =
  | { ok: true; adminClient: SupabaseClient; userId: string }
  | { ok: false; status: number; error: string }

export async function verifyAdmin(req: VercelRequest): Promise<VerifyResult> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: '認証が必要です' }
  }
  const accessToken = authHeader.slice('Bearer '.length)

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      ok: false,
      status: 500,
      error: 'サーバー環境変数(SUPABASE_SERVICE_ROLE_KEY等)が設定されていません'
    }
  }

  const callerClient = createClient(supabaseUrl, anonKey)
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(accessToken)
  if (callerError || !callerData.user) {
    return { ok: false, status: 401, error: '認証に失敗しました' }
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
    return { ok: false, status: 403, error: '管理者権限が必要です' }
  }

  return { ok: true, adminClient, userId: callerData.user.id }
}

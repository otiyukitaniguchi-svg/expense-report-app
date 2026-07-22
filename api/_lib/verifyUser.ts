import type { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

type VerifyResult = { ok: true; userId: string } | { ok: false; status: number; error: string }

export async function verifyUser(req: VercelRequest): Promise<VerifyResult> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: '認証が必要です' }
  }
  const accessToken = authHeader.slice('Bearer '.length)

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 500, error: 'サーバー環境変数が設定されていません' }
  }

  const callerClient = createClient(supabaseUrl, anonKey)
  const { data, error } = await callerClient.auth.getUser(accessToken)
  if (error || !data.user) {
    return { ok: false, status: 401, error: '認証に失敗しました' }
  }
  return { ok: true, userId: data.user.id }
}

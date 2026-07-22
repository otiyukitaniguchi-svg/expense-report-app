import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAdmin } from './_lib/verifyAdmin.js'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const auth = await verifyAdmin(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }
  const { adminClient } = auth

  const { userId, password } = (req.body ?? {}) as { userId?: string; password?: string }

  if (!userId || !password) {
    res.status(400).json({ error: 'userId・passwordは必須です' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'パスワードは6文字以上にしてください' })
    return
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password })
  if (updateError) {
    res.status(400).json({ error: updateError.message })
    return
  }

  res.status(200).json({ ok: true })
}

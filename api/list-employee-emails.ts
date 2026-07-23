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

  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (error) {
    res.status(400).json({ error: error.message })
    return
  }

  const emails: Record<string, string> = {}
  for (const user of data.users) {
    if (user.email) emails[user.id] = user.email
  }

  res.status(200).json({ emails })
}

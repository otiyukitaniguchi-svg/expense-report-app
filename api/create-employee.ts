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

  let managerId: string | null = null
  if (departmentId) {
    const { data: department } = await adminClient
      .from('departments')
      .select('approver_id')
      .eq('id', departmentId)
      .single()
    managerId = (department as { approver_id: string | null } | null)?.approver_id ?? null
  }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update({
      name,
      role: role ?? 'employee',
      department_id: departmentId ?? null,
      manager_id: managerId
    })
    .eq('id', created.user.id)
  if (updateError) {
    res.status(400).json({ error: updateError.message })
    return
  }

  res.status(200).json({ id: created.user.id })
}

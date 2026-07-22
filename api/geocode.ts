import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUser } from './_lib/verifyUser.js'

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const auth = await verifyUser(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }

  const { query } = (req.body ?? {}) as { query?: string }
  if (!query?.trim()) {
    res.status(400).json({ error: '検索する地名を入力してください' })
    return
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=jp&accept-language=ja&q=${encodeURIComponent(query)}`
    const geoRes = await fetch(url, {
      headers: { 'User-Agent': 'expense-report-app/1.0 (internal team tool)' }
    })
    if (!geoRes.ok) {
      res.status(502).json({ error: '地名検索サービスへの接続に失敗しました' })
      return
    }
    const results = (await geoRes.json()) as NominatimResult[]
    res.status(200).json({
      candidates: results.map((r) => ({
        label: r.display_name,
        lat: Number(r.lat),
        lon: Number(r.lon)
      }))
    })
  } catch {
    res.status(500).json({ error: '地名検索に失敗しました' })
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUser } from './_lib/verifyUser.js'

interface NominatimResult {
  place_id: number
  osm_type: string
  osm_id: number
  display_name: string
  lat: string
  lon: string
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
  if (typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: '検索する地名を入力してください' })
    return
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query.trim())
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '5')
    url.searchParams.set('countrycodes', 'jp')
    url.searchParams.set('accept-language', 'ja')

    // Nominatim public API is intended for moderate, user-triggered lookups only.
    const geoRes = await fetch(url.toString(), {
      headers: { 'User-Agent': 'OTIExpenseReport/1.0 (transportation expense route lookup)' }
    })
    if (!geoRes.ok) {
      res.status(502).json({ error: `地名検索サービスの応答エラー (${geoRes.status})` })
      return
    }

    const body = (await geoRes.json()) as NominatimResult[]
    const candidates = body.map((item) => ({
      label: item.display_name,
      placeId: `${item.osm_type}:${item.osm_id}`,
      lat: Number(item.lat),
      lon: Number(item.lon)
    })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon))

    res.status(200).json({ candidates })
  } catch {
    res.status(502).json({ error: '地名検索に失敗しました。地名を確認して再試行してください。' })
  }
}

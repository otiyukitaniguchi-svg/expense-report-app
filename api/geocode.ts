import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUser } from './_lib/verifyUser.js'

interface PlacesTextSearchResult {
  place_id: string
  formatted_address: string
  name: string
  geometry: { location: { lat: number; lng: number } }
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

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'サーバー環境変数(GOOGLE_MAPS_API_KEY)が設定されていません' })
    return
  }

  const { query } = (req.body ?? {}) as { query?: string }
  if (!query?.trim()) {
    res.status(400).json({ error: '検索する地名を入力してください' })
    return
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=ja&region=jp&key=${apiKey}`
    const geoRes = await fetch(url)
    if (!geoRes.ok) {
      res.status(502).json({ error: '地名検索サービスへの接続に失敗しました' })
      return
    }
    const body = (await geoRes.json()) as {
      status: string
      results?: PlacesTextSearchResult[]
      error_message?: string
    }
    if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') {
      res.status(502).json({ error: `地名検索に失敗しました(${body.status}) ${body.error_message ?? ''}` })
      return
    }
    const candidates = (body.results ?? []).slice(0, 5).map((r) => ({
      label: r.formatted_address || r.name,
      placeId: r.place_id,
      lat: r.geometry.location.lat,
      lon: r.geometry.location.lng
    }))
    res.status(200).json({ candidates })
  } catch {
    res.status(500).json({ error: '地名検索に失敗しました' })
  }
}

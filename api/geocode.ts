import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUser } from './_lib/verifyUser.js'

interface GeoapifyFeature {
  properties?: {
    place_id?: string
    formatted?: string
    address_line1?: string
    address_line2?: string
    lat?: number
    lon?: number
    rank?: {
      confidence?: number
      confidence_street_level?: number
    }
  }
}

interface GeoapifyResponse {
  features?: GeoapifyFeature[]
}

interface GeocodeCandidate {
  label: string
  placeId: string
  lat: number
  lon: number
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

  const normalizedQuery = query.replace(/[\s　]+/g, ' ').trim()
  if (normalizedQuery.length > 300) {
    res.status(400).json({ error: '検索する地名は300文字以内で入力してください' })
    return
  }

  const apiKey = process.env.GEOAPIFY_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: '地名検索APIの設定がありません。Vercelの環境変数 GEOAPIFY_API_KEY を設定してください。'
    })
    return
  }

  try {
    // Japanese addresses are not always indexed with the same number notation.
    // Retry progressively broader/normalized forms only when the exact query has no hits.
    const queryVariants = Array.from(new Set([
      normalizedQuery,
      normalizedQuery.includes('沖縄県') ? null : `沖縄県${normalizedQuery}`,
      normalizedQuery.replace(/(\\d+)-(\\d+)-(\\d+)/g, '$1丁目$2番$3号'),
      normalizedQuery.replace(/(\\d+)-(\\d+)/g, '$1丁目$2番'),
      normalizedQuery.includes('沖縄県') ? null : `沖縄県 ${normalizedQuery}`
    ].filter((value): value is string => Boolean(value)))).slice(0, 5)

    let candidates: GeocodeCandidate[] = []

    for (const searchQuery of queryVariants) {
      const url = new URL('https://api.geoapify.com/v1/geocode/search')
      url.searchParams.set('text', searchQuery)
      url.searchParams.set('format', 'json')
      url.searchParams.set('lang', 'ja')
      url.searchParams.set('limit', '5')
      url.searchParams.set('filter', 'countrycode:jp')
      url.searchParams.set('apiKey', apiKey)

      const geoRes = await fetch(url.toString(), {
        headers: { Accept: 'application/json' }
      })

      if (!geoRes.ok) {
        if (geoRes.status === 401 || geoRes.status === 403) {
          res.status(502).json({ error: '地名検索APIの認証に失敗しました。APIキーと利用上限を確認してください。' })
          return
        }
        if (geoRes.status === 429) {
          res.status(503).json({ error: '地名検索の利用上限に達しました。少し時間をおいて再試行してください。' })
          return
        }
        res.status(502).json({ error: `地名検索サービスの応答エラー (${geoRes.status})` })
        return
      }

      const body = (await geoRes.json()) as GeoapifyResponse
      candidates = (body.features ?? [])
        .map((feature) => {
          const item = feature.properties
          if (!item) return null

          const lat = Number(item.lat)
          const lon = Number(item.lon)
          const label = item.formatted?.trim() || [item.address_line1, item.address_line2].filter(Boolean).join(', ')

          if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) return null

          return {
            label,
            placeId: item.place_id || `${lat},${lon}`,
            lat,
            lon
          }
        })
        .filter((item): item is GeocodeCandidate => item !== null)

      if (candidates.length > 0) break
    }

    res.status(200).json({ candidates })
  } catch {
    res.status(502).json({ error: '地名検索に失敗しました。地名を確認して再試行してください。' })
  }
}

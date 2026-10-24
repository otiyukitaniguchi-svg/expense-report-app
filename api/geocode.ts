import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUser } from './_lib/verifyUser.js'

interface GooglePlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
}

interface GoogleTextSearchResponse {
  places?: GooglePlace[]
}

interface GeocodeCandidate {
  label: string
  placeId: string
  lat: number
  lon: number
}

// Bias results toward Okinawa (where the team operates) without excluding the rest of Japan.
const OKINAWA_BIAS = {
  circle: { center: { latitude: 26.3344, longitude: 127.8056 }, radius: 50000 }
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

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: '地名検索APIの設定がありません。Vercelの環境変数 GOOGLE_MAPS_API_KEY を設定してください。'
    })
    return
  }

  try {
    // Places API (New) Text Search handles both street addresses and place/building names.
    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
      },
      body: JSON.stringify({
        textQuery: normalizedQuery,
        languageCode: 'ja',
        regionCode: 'JP',
        pageSize: 5,
        locationBias: OKINAWA_BIAS
      })
    })

    if (!placesRes.ok) {
      const errorBody = (await placesRes.text()).slice(0, 1000)
      console.error('[Google Places] Request failed', {
        status: placesRes.status,
        statusText: placesRes.statusText,
        body: errorBody
      })

      if (placesRes.status === 401 || placesRes.status === 403) {
        res.status(502).json({ error: '地名検索APIの認証に失敗しました。APIキーと利用制限を確認してください。' })
        return
      }
      if (placesRes.status === 429) {
        res.status(503).json({ error: '地名検索の利用上限に達しました。少し時間をおいて再試行してください。' })
        return
      }
      res.status(502).json({ error: `地名検索サービスの応答エラー (${placesRes.status})` })
      return
    }

    const body = (await placesRes.json()) as GoogleTextSearchResponse
    const candidates: GeocodeCandidate[] = []
    for (const place of body.places ?? []) {
      const lat = Number(place.location?.latitude)
      const lon = Number(place.location?.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

      const name = place.displayName?.text?.trim()
      const address = place.formattedAddress?.trim().replace(/^日本、\s*/, '')
      const label = name && address && !address.includes(name) ? `${name}(${address})` : address || name
      if (!label) continue

      candidates.push({ label, placeId: place.id || `${lat},${lon}`, lat, lon })
    }

    res.status(200).json({ candidates })
  } catch (error) {
    console.error('[Geocode] Unexpected error', error instanceof Error ? error.message : 'Unknown error')
    res.status(502).json({ error: '地名検索に失敗しました。地名を確認して再試行してください。' })
  }
}

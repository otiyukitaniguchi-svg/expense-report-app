import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUser } from './_lib/verifyUser.js'

// App travel modes → Google Routes API travel modes.
// Google does not offer bicycle routing in Japan, so bicycling stays manual entry.
const ROUTES_TRAVEL_MODES: Record<string, string> = {
  driving: 'DRIVE',
  walking: 'WALK',
  transit: 'TRANSIT'
}

interface ComputeRoutesResponse {
  routes?: { distanceMeters?: number }[]
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

  const { fromLat, fromLon, toLat, toLon, travelMode = 'driving', avoidTolls = false } = (req.body ?? {}) as {
    fromLat?: number
    fromLon?: number
    toLat?: number
    toLon?: number
    travelMode?: string
    avoidTolls?: boolean
  }
  const values = [fromLat, fromLon, toLat, toLon]
  if (
    values.some((value) => typeof value !== 'number' || !Number.isFinite(value)) ||
    fromLat! < -90 || fromLat! > 90 ||
    toLat! < -90 || toLat! > 90 ||
    fromLon! < -180 || fromLon! > 180 ||
    toLon! < -180 || toLon! > 180
  ) {
    res.status(400).json({ error: '出発地・到着地の座標が不正です' })
    return
  }

  const routesTravelMode = ROUTES_TRAVEL_MODES[travelMode]
  if (!routesTravelMode) {
    res.status(400).json({ error: 'この交通手段は距離を自動計算できません。距離を手入力してください。' })
    return
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: '経路APIの設定がありません。Vercelの環境変数 GOOGLE_MAPS_API_KEY を設定してください。'
    })
    return
  }

  try {
    const routeRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters'
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: fromLat, longitude: fromLon } } },
        destination: { location: { latLng: { latitude: toLat, longitude: toLon } } },
        travelMode: routesTravelMode,
        // Route modifiers are only valid for driving.
        ...(routesTravelMode === 'DRIVE' ? { routeModifiers: { avoidTolls: Boolean(avoidTolls) } } : {}),
        languageCode: 'ja',
        regionCode: 'JP',
        units: 'METRIC'
      })
    })

    if (!routeRes.ok) {
      console.error('[Google Routes] Request failed', {
        status: routeRes.status,
        body: (await routeRes.text()).slice(0, 1000)
      })
      res.status(502).json({ error: '経路サービスが利用できません。距離を手入力してください。' })
      return
    }

    const body = (await routeRes.json()) as ComputeRoutesResponse
    const meters = body.routes?.[0]?.distanceMeters
    if (typeof meters !== 'number' || !Number.isFinite(meters)) {
      res.status(400).json({ error: '経路が見つかりません。距離を手入力してください。' })
      return
    }

    res.status(200).json({ distanceKm: Math.round((meters / 1000) * 10) / 10 })
  } catch {
    res.status(502).json({ error: '距離の自動計算に失敗しました。距離を手入力してください。' })
  }
}

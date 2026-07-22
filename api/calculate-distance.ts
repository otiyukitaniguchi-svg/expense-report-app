import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUser } from './_lib/verifyUser.js'

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

async function geocode(query: string): Promise<NominatimResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=jp&accept-language=ja&q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'expense-report-app/1.0 (internal team tool)'
    }
  })
  if (!res.ok) return null
  const results = (await res.json()) as NominatimResult[]
  return results[0] ?? null
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

  const { departure, arrival } = (req.body ?? {}) as { departure?: string; arrival?: string }
  if (!departure?.trim() || !arrival?.trim()) {
    res.status(400).json({ error: '出発地・到着地を入力してください' })
    return
  }

  try {
    const [from, to] = await Promise.all([geocode(departure), geocode(arrival)])

    if (!from) {
      res.status(400).json({ error: `出発地「${departure}」の場所が見つかりませんでした。より具体的な住所や施設名を入力してください。` })
      return
    }
    if (!to) {
      res.status(400).json({ error: `到着地「${arrival}」の場所が見つかりませんでした。より具体的な住所や施設名を入力してください。` })
      return
    }

    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`
    const routeRes = await fetch(routeUrl)
    if (!routeRes.ok) {
      res.status(502).json({ error: '経路計算サービスへの接続に失敗しました' })
      return
    }
    const routeData = (await routeRes.json()) as {
      code: string
      routes?: { distance: number }[]
    }
    if (routeData.code !== 'Ok' || !routeData.routes?.[0]) {
      res.status(400).json({ error: '経路が見つかりませんでした。距離を手動で入力してください。' })
      return
    }

    const distanceKm = Math.round((routeData.routes[0].distance / 1000) * 10) / 10
    res.status(200).json({
      distanceKm,
      departureResolved: from.display_name,
      arrivalResolved: to.display_name
    })
  } catch {
    res.status(500).json({ error: '距離の自動計算に失敗しました。距離を手動で入力してください。' })
  }
}

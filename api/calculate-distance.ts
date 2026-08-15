import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUser } from './_lib/verifyUser.js'

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

  const { fromPlaceId, toPlaceId, mode, avoidTolls } = (req.body ?? {}) as {
    fromPlaceId?: string
    toPlaceId?: string
    mode?: string
    avoidTolls?: boolean
  }
  if (!fromPlaceId || !toPlaceId) {
    res.status(400).json({ error: '出発地・到着地を指定してください' })
    return
  }
  const allowedModes = ['driving', 'walking', 'bicycling', 'transit']
  const travelMode = allowedModes.includes(mode ?? '') ? mode : 'driving'

  try {
    let url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=place_id:${encodeURIComponent(fromPlaceId)}&destinations=place_id:${encodeURIComponent(toPlaceId)}&mode=${travelMode}&language=ja&key=${apiKey}`
    if (travelMode === 'driving' && avoidTolls) {
      url += '&avoid=tolls'
    }
    const routeRes = await fetch(url)
    if (!routeRes.ok) {
      res.status(502).json({ error: '経路計算サービスへの接続に失敗しました' })
      return
    }
    const body = (await routeRes.json()) as {
      status: string
      error_message?: string
      rows?: { elements: { status: string; distance?: { value: number } }[] }[]
    }
    if (body.status !== 'OK') {
      res.status(502).json({ error: `経路計算に失敗しました(${body.status}) ${body.error_message ?? ''}` })
      return
    }
    const element = body.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK' || !element.distance) {
      res.status(400).json({ error: '経路が見つかりませんでした。距離を手動で入力してください。' })
      return
    }

    const distanceKm = Math.round((element.distance.value / 1000) * 10) / 10
    res.status(200).json({ distanceKm })
  } catch {
    res.status(500).json({ error: '距離の自動計算に失敗しました。距離を手動で入力してください。' })
  }
}

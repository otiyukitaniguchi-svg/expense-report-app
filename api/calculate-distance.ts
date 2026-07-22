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

  const { fromLat, fromLon, toLat, toLon } = (req.body ?? {}) as {
    fromLat?: number
    fromLon?: number
    toLat?: number
    toLon?: number
  }
  if (
    typeof fromLat !== 'number' ||
    typeof fromLon !== 'number' ||
    typeof toLat !== 'number' ||
    typeof toLon !== 'number'
  ) {
    res.status(400).json({ error: '出発地・到着地の座標を指定してください' })
    return
  }

  try {
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`
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
    res.status(200).json({ distanceKm })
  } catch {
    res.status(500).json({ error: '距離の自動計算に失敗しました。距離を手動で入力してください。' })
  }
}

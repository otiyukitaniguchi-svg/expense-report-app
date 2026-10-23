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

  try {
    const coordinates = `${fromLon},${fromLat};${toLon},${toLat}`
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`
    const routeRes = await fetch(url)
    if (!routeRes.ok) {
      res.status(502).json({ error: '経路サービスが利用できません。距離を手入力してください。' })
      return
    }

    const body = (await routeRes.json()) as {
      code: string
      routes?: { distance: number }[]
    }
    const meters = body.routes?.[0]?.distance
    if (body.code !== 'Ok' || typeof meters !== 'number' || !Number.isFinite(meters)) {
      res.status(400).json({ error: '車の経路が見つかりません。距離を手入力してください。' })
      return
    }

    res.status(200).json({ distanceKm: Math.round((meters / 1000) * 10) / 10 })
  } catch {
    res.status(502).json({ error: '距離の自動計算に失敗しました。距離を手入力してください。' })
  }
}

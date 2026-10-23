import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUser } from './_lib/verifyUser.js'

interface GeoapifyProperties {
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

interface GeoapifyFeature {
  properties?: GeoapifyProperties
}

interface GeoapifyResult extends GeoapifyProperties {}

interface GeoapifyResponse {
  // format=json returns a "results" array with properties at the top level.
  results?: GeoapifyResult[]
  // GeoJSON responses use "features[].properties".
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
      normalizedQuery.includes('沖縄県') ? null : `沖縄県 ${normalizedQuery}`,
      normalizedQuery.replace(/(\d+)-(\d+)-(\d+)/g, '$1丁目$2番$3号'),
      normalizedQuery.replace(/(\d+)-(\d+)/g, '$1丁目$2番'),
      normalizedQuery.includes('沖縄県') ? null : `沖縄県 ${normalizedQuery.replace(/(\d+)-(\d+)-(\d+)/g, '$1丁目$2番$3号')}`
    ].filter((value): value is string => Boolean(value)))).slice(0, 5)

    const candidateMap = new Map<string, GeocodeCandidate & { score: number }>()
    const queryDigits = normalizedQuery.match(/\d+/g) ?? []
    const queryText = normalizedQuery.replace(/[\s　,，、-]/g, '').toLowerCase()
    // Japanese address strings often have no spaces, so split common admin/address markers too.
    const queryTokens = normalizedQuery
      .replace(/^(沖縄県)?/, '')
      .replace(/(都|道|府|県|市|区|町|村|丁目|番地?|号)/g, '$1 ')
      .replace(/[0-9０-９-]/g, ' ')
      .split(/[\s　,，、]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2 && !['沖縄県', '日本'].includes(part))

    for (const searchQuery of queryVariants) {
      const url = new URL('https://api.geoapify.com/v1/geocode/search')
      url.searchParams.set('text', searchQuery)
      url.searchParams.set('format', 'json')
      url.searchParams.set('lang', 'ja')
      url.searchParams.set('limit', '10')
      url.searchParams.set('filter', 'countrycode:jp')
      url.searchParams.set('apiKey', apiKey)

      const geoRes = await fetch(url.toString(), {
        headers: { Accept: 'application/json' }
      })

      if (!geoRes.ok) {
        const errorBody = (await geoRes.text()).slice(0, 1000)
        console.error('[Geoapify] Request failed', {
          status: geoRes.status,
          statusText: geoRes.statusText,
          body: errorBody.replace(/(apiKey=)[^&\\s]+/gi, '$1[REDACTED]')
        })

        if (geoRes.status === 401 || geoRes.status === 403) {
          res.status(502).json({ error: '地名検索APIの認証に失敗しました。APIキーと利用制限を確認してください。' })
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
      const items: GeoapifyProperties[] = body.results ?? (body.features ?? [])
        .map((feature) => feature.properties)
        .filter((item): item is GeoapifyProperties => Boolean(item))

      for (const item of items) {
        const lat = Number(item.lat)
        const lon = Number(item.lon)
        const label = item.formatted?.trim() || [item.address_line1, item.address_line2].filter(Boolean).join(', ')
        if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) continue

        const labelText = label.replace(/[\s　,，、-]/g, '').toLowerCase()
        const matchedTokens = queryTokens.filter((token) => label.includes(token)).length
        const matchedDigits = queryDigits.filter((digit) => labelText.includes(digit)).length
        const confidence = Number(item.rank?.confidence ?? 0)
        const streetConfidence = Number(item.rank?.confidence_street_level ?? 0)

        // Use the provider's relevance and address components; avoid discarding
        // every result just because Japanese compound place names have no spaces.
        let score = matchedTokens * 10 + matchedDigits * 3 + confidence + streetConfidence
        if (labelText.includes(queryText)) score += 100
        if (matchedTokens === 0) score -= 15
        if (queryDigits.length > 0 && matchedDigits === 0) score -= 10

        const candidate = {
          label,
          placeId: item.place_id || `${lat},${lon}`,
          lat,
          lon,
          score
        }
        const key = candidate.placeId
        const previous = candidateMap.get(key)
        if (!previous || candidate.score > previous.score) candidateMap.set(key, candidate)
      }
    }

    const candidates = Array.from(candidateMap.values())
      .filter((candidate) => candidate.score > -5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score: _score, ...candidate }) => candidate)

    res.status(200).json({ candidates })
  } catch (error) {
    console.error('[Geocode] Unexpected error', error instanceof Error ? error.message : 'Unknown error')
    res.status(502).json({ error: '地名検索に失敗しました。地名を確認して再試行してください。' })
  }
}

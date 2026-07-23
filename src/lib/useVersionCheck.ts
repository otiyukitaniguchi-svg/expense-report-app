import { useEffect } from 'react'

async function checkForNewVersion(): Promise<void> {
  const currentBuildId = document
    .querySelector('meta[name="build-id"]')
    ?.getAttribute('content')
  if (!currentBuildId) return
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return
    const { buildId } = (await res.json()) as { buildId: string }
    if (buildId && buildId !== currentBuildId) {
      window.location.reload()
    }
  } catch {
    // オフライン等は無視。次回のチェックで再試行される
  }
}

// タブを開いた直後・再びアクティブになった際に新しいバージョンを検知して自動リロードする
export function useVersionCheck(): void {
  useEffect(() => {
    checkForNewVersion()
    function handleVisibility(): void {
      if (document.visibilityState === 'visible') checkForNewVersion()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])
}

import { useEffect, useState } from 'react'

export function useResource<T>(loader: () => Promise<T>) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<{ loader: typeof loader; version: number; data?: T; error?: unknown }>()
  useEffect(() => {
    let active = true
    loader().then(
      data => { if (active) setState({ loader, version, data }) },
      error => { if (active) setState({ loader, version, error }) },
    )
    return () => { active = false }
  }, [loader, version])
  const current = state?.loader === loader && state.version === version
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current,
    retry: () => setVersion(value => value + 1),
  }
}

import { useState, useEffect, useCallback } from 'react'

interface UseFetchResult<T> {
  data: T
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook genérico para cargar datos desde la API.
 * Reemplaza los arrays hardcodeados en cada página.
 *
 * Uso:
 *   const { data: riesgos, loading, error, refetch } = useFetch(
 *     riesgosService.getAll,
 *     []   // valor inicial mientras carga
 *   )
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  initialValue: T
): UseFetchResult<T> {
  const [data, setData]       = useState<T>(initialValue)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (e: any) {
      setError(e.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => { fetch_() }, [fetch_])

  return { data, loading, error, refetch: fetch_ }
}

import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

/** Active top-level service categories, from the API (managed by admins). */
export function useCategories() {
  const query = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/jobs/categories').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })
  return { ...query, categories: (query.data || []).filter(c => !c.parent_id) }
}

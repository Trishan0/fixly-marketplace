import { useEffect } from 'react'

const SUFFIX = 'Fixly'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : `${SUFFIX} - Find trusted local workers`
  }, [title])
}

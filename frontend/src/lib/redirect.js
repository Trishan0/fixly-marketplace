// Only same-origin, in-app paths are allowed as post-login destinations, so a
// crafted ?next= link cannot bounce users to another site.
export function safeNextPath(value) {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  if (value.startsWith('/auth')) return null
  return value
}

export function currentPath() {
  return `${window.location.pathname}${window.location.search}`
}

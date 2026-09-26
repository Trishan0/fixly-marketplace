import { useEffect } from 'react'

const SUFFIX = 'Fixly'
const HOME_TITLE = 'Fixly - Find trusted local workers in Sri Lanka'
export const DEFAULT_DESCRIPTION = 'Post a job, compare quotes from ID-checked local plumbers, electricians, carpenters and cleaners, and hire with confidence. Fixly is Sri Lanka’s local services marketplace.'

// Pages search engines may index. Everything else sits behind sign-in or is a
// one-off link (password reset, email verification) and is marked noindex.
const INDEXABLE_PATHS = [/^\/$/, /^\/workers(\/[^/]+)?$/, /^\/(how-it-works|blog|contact|terms|privacy|safety)$/]

function setMeta(attribute, key, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

/**
 * Sets the document title plus the description, canonical URL and robots
 * tags that search engines read after rendering. Link-preview bots don't run
 * JavaScript; they read the static tags in index.html.
 *
 * Pass '' for the home page title, or null to leave the title to another
 * component on the same screen.
 * @param {string | null} title
 * @param {{ description?: string }} [options]
 */
export function usePageTitle(title, { description } = {}) {
  useEffect(() => {
    if (title === null) return
    const fullTitle = title ? `${title} · ${SUFFIX}` : HOME_TITLE
    const text = description || DEFAULT_DESCRIPTION
    const { origin, pathname } = window.location
    document.title = fullTitle
    setMeta('name', 'description', text)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', text)
    setMeta('name', 'robots', INDEXABLE_PATHS.some(pattern => pattern.test(pathname)) ? 'index, follow' : 'noindex, nofollow')
    setCanonical(`${origin}${pathname}`)
  }, [title, description])
}

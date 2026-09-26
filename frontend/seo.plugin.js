// Build-time SEO: fills the absolute site URL into index.html's share tags
// (link-preview bots need absolute URLs and don't run JavaScript) and
// generates robots.txt and sitemap.xml.

const PUBLIC_ROUTES = ['/', '/workers', '/how-it-works', '/blog', '/contact', '/safety', '/terms', '/privacy']

// Paths behind sign-in, or one-off links, that crawlers should skip.
const PRIVATE_PREFIXES = [
  '/admin', '/auth', '/customer-dashboard', '/worker-dashboard', '/dashboard', '/jobs', '/find-workers',
  '/invites', '/proposals', '/earnings', '/messages', '/notifications', '/profile', '/settings',
  '/customers', '/forgot-password', '/reset-password', '/verify-email',
]

/**
 * VITE_SITE_URL wins; on Vercel the production domain is used automatically.
 * @param {Record<string, string | undefined>} env
 */
export function resolveSiteUrl(env) {
  const configured = env.VITE_SITE_URL
    || (env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`)
    || 'https://fixly-seven-ivory.vercel.app'
  return configured.replace(/\/+$/, '')
}

export function robotsTxt(siteUrl) {
  return [
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_PREFIXES.map(prefix => `Disallow: ${prefix}`),
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
}

export function sitemapXml(siteUrl, lastmod = new Date().toISOString().slice(0, 10)) {
  const urls = PUBLIC_ROUTES.map(route => [
    '  <url>',
    `    <loc>${siteUrl}${route === '/' ? '/' : route}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${route === '/' || route === '/workers' ? 'daily' : 'monthly'}</changefreq>`,
    `    <priority>${route === '/' ? '1.0' : route === '/workers' ? '0.9' : '0.6'}</priority>`,
    '  </url>',
  ].join('\n'))
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

/** @param {Record<string, string | undefined>} env */
export function seoPlugin(env) {
  const siteUrl = resolveSiteUrl(env)
  return {
    name: 'fixly-seo',
    // 'pre' so the URLs are absolute before Vite parses the HTML's links.
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replaceAll('%SITE_URL%', siteUrl),
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) })
    },
  }
}

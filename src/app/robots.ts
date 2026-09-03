import type { MetadataRoute } from 'next'

const siteUrl = 'https://paypilot-mu.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/buyer/', '/seller/', '/api/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}

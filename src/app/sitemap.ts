import type { MetadataRoute } from 'next'

const siteUrl = 'https://paypilot-mu.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/shop`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/assistant`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]
}

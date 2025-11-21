/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['supabase.co'],
  },
  // Katalog sayfalarını dynamic yap
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
}

module.exports = nextConfig

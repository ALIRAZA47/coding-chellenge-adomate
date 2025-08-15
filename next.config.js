/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_FONTS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY,
  },
  images: {
    domains: ['fonts.googleapis.com', 'fonts.gstatic.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https', 
        hostname: '**.supabase.com',
        pathname: '/storage/v1/object/public/**',
      }
    ],
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
}

module.exports = nextConfig

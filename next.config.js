/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_FONTS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY,
  },
  images: {
    domains: ['fonts.googleapis.com', 'fonts.gstatic.com'],
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
}

module.exports = nextConfig

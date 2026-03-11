/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep output as default (Node.js server) for DigitalOcean Droplet deployment
  // Images from FB Marketplace CDN (expired after ~72h, shown as placeholders after that)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.facebook.com',
      },
    ],
  },
}

export default nextConfig

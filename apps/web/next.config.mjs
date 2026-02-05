/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@skillbound/database',
    '@skillbound/domain',
    '@skillbound/hiscores',
  ],
  serverExternalPackages: ['@neondatabase/serverless'],
  allowedDevOrigins: ['http://127.0.0.1:3000', 'http://localhost:3000'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oldschool.runescape.wiki',
        pathname: '/images/**',
      },
    ],
  },
};

export default nextConfig;

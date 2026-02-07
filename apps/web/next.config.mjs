/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@skillbound/database',
    '@skillbound/domain',
    '@skillbound/hiscores',
  ],
  serverExternalPackages: ['@neondatabase/serverless'],
  allowedDevOrigins: [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://0.0.0.0:3000',
    '127.0.0.1',
    'localhost',
    '0.0.0.0',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oldschool.runescape.wiki',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'oldschool.tools',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'general-543f.kxcdn.com',
        pathname: '/**/**',
      },
    ],
  },
};

export default nextConfig;

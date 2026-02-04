/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@skillbound/database',
    '@skillbound/domain',
    '@skillbound/hiscores',
  ],
  serverExternalPackages: ['@neondatabase/serverless'],
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

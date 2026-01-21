/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@skillbound/database',
    '@skillbound/domain',
    '@skillbound/hiscores',
  ],
  experimental: {
    serverComponentsExternalPackages: ['@neondatabase/serverless'],
  },
};

export default nextConfig;

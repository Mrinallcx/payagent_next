/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/agent',
        destination: '/docs',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;

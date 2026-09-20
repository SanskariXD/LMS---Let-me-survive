import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow HTTP requests to the university API from server-side
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
  },
};

export default nextConfig;

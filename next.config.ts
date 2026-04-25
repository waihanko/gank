import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.loca.lt', '*.ngrok-free.dev'],
  experimental: {
    serverActions: {
      allowedOrigins: ['*.loca.lt', '*.ngrok-free.dev'],
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
};

export default nextConfig;

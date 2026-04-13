import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.52.145'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",         // Spotify album art CDN
        pathname: "/image/**",
      },
      {
        protocol: "https",
        hostname: "mosaic.scdn.co",    // Spotify mosaic art
      },
      {
        protocol: "https",
        hostname: "**.spotifycdn.com", // Other Spotify CDN variants
      },
    ],
  },
};

export default nextConfig;

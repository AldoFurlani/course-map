import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    // react-pdf needs the canvas module excluded in the browser bundle
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;

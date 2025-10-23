/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React Strict Mode for better development
  reactStrictMode: true,
  
  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['@anthropic-ai/sdk'],
  },
  
  // Runtime optimizations
  poweredByHeader: false,
};

module.exports = nextConfig;
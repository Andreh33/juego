import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Los packages internos se sirven como TS y los transpila Next (patron de monorepo).
  transpilePackages: ['@umbral/shared', '@umbral/engine', '@umbral/content'],
};

export default nextConfig;

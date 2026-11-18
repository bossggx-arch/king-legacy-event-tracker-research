import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true" ? { output: "standalone" as const } : {}),
  serverExternalPackages: ["@electric-sql/pglite", "pglite-prisma-adapter", "bullmq", "ioredis"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

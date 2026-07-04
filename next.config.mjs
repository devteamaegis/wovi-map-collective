/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Standalone output is for the Docker/persistent-disk deploy; on Vercel let the
  // platform handle the build output natively.
  output: process.env.VERCEL ? undefined : "standalone",
  // Ensure the raw SQL schema is traced into the serverless function bundle
  // (db.ts reads it with fs at runtime). The seed .mjs files are traced
  // automatically via the static import in lib/db.ts.
  outputFileTracingIncludes: {
    "/**": ["./lib/schema.sql"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

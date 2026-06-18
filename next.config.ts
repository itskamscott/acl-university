import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Brand Vault logos are admin-uploaded to arbitrary hosts (Supabase Storage,
  // a brand's own CDN, etc.). Allow any https host for next/image optimization.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;

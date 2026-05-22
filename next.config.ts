import type { NextConfig } from "next";

const allowedDevOrigins = [
  "10.0.0.194",
  ...(process.env.ALLOWED_DEV_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) || []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins,
};

export default nextConfig;

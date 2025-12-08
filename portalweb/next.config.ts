import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Explicitly expose environment variables
  env: {
    NEXT_PUBLIC_CAMERA_STREAM_URL: process.env.NEXT_PUBLIC_CAMERA_STREAM_URL,
    NEXT_PUBLIC_POCKETBASE_URL: process.env.NEXT_PUBLIC_POCKETBASE_URL,
    NEXT_PUBLIC_PIN_CODE: process.env.NEXT_PUBLIC_PIN_CODE,
  },
};

// Debug logging during config load
console.log('[NEXT CONFIG DEBUG] ===== NEXT CONFIG LOADED =====');
console.log('[NEXT CONFIG DEBUG] NEXT_PUBLIC_CAMERA_STREAM_URL:', process.env.NEXT_PUBLIC_CAMERA_STREAM_URL ? 'SET' : 'NOT SET');
console.log('[NEXT CONFIG DEBUG] NEXT_PUBLIC_POCKETBASE_URL:', process.env.NEXT_PUBLIC_POCKETBASE_URL ? 'SET' : 'NOT SET');
console.log('[NEXT CONFIG DEBUG] NEXT_PUBLIC_PIN_CODE:', process.env.NEXT_PUBLIC_PIN_CODE ? 'SET' : 'NOT SET');
console.log('[NEXT CONFIG DEBUG] nextConfig.env:', nextConfig.env);

export default nextConfig;

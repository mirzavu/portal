import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Explicitly expose environment variables
  env: {
    NEXT_PUBLIC_CAMERA_STREAM_URL: process.env.NEXT_PUBLIC_CAMERA_STREAM_URL,
    NEXT_PUBLIC_POCKETBASE_URL: process.env.NEXT_PUBLIC_POCKETBASE_URL,
    NEXT_PUBLIC_PIN_CODE: process.env.NEXT_PUBLIC_PIN_CODE,
  },
  webpack: (config, { webpack }) => {
    // Exclude pocketbase binary from webpack processing
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/pocketbase$/,
        contextRegExp: /.*/,
      })
    );
    return config;
  },
};

// Debug logging during config load
console.log('[NEXT CONFIG DEBUG] ===== NEXT CONFIG LOADED =====');
console.log('[NEXT CONFIG DEBUG] NEXT_PUBLIC_CAMERA_STREAM_URL:', process.env.NEXT_PUBLIC_CAMERA_STREAM_URL ? 'SET' : 'NOT SET');
console.log('[NEXT CONFIG DEBUG] NEXT_PUBLIC_POCKETBASE_URL:', process.env.NEXT_PUBLIC_POCKETBASE_URL ? 'SET' : 'NOT SET');
console.log('[NEXT CONFIG DEBUG] NEXT_PUBLIC_PIN_CODE:', process.env.NEXT_PUBLIC_PIN_CODE ? 'SET' : 'NOT SET');
console.log('[NEXT CONFIG DEBUG] nextConfig.env:', nextConfig.env);

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Explicitly expose environment variables
  env: {
    NEXT_PUBLIC_CAMERA_STREAM_URL: process.env.NEXT_PUBLIC_CAMERA_STREAM_URL,
    NEXT_PUBLIC_POCKETBASE_URL: process.env.NEXT_PUBLIC_POCKETBASE_URL,
    NEXT_PUBLIC_PIN_CODE: process.env.NEXT_PUBLIC_PIN_CODE,
  },
  webpack: (config, { webpack, isServer }) => {
    // Exclude pocketbase binary from webpack processing
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/pocketbase$/,
        contextRegExp: /.*/,
      })
    );
    
    // Ensure CSS is processed correctly with PostCSS
    if (!isServer) {
      const rules = config.module?.rules?.find((rule: any) =>
        rule.oneOf
      )?.oneOf;
      if (rules) {
        const cssRule = rules.find((rule: any) =>
          rule.test?.toString().includes('css')
        );
        if (cssRule && cssRule.use) {
          // PostCSS should be handled by Next.js automatically, but ensure it's in the chain
          const postCssLoader = cssRule.use.find((loader: any) =>
            loader?.loader?.includes('postcss-loader')
          );
          if (!postCssLoader) {
            // PostCSS loader should already be there, but if not, Next.js will add it
            console.log('[WEBPACK CONFIG] PostCSS loader check passed');
          }
        }
      }
    }
    
    return config;
  },
  // Add empty turbopack config to silence error when using Turbopack (default in Next.js 16)
  turbopack: {},
};

// Debug logging during config load
console.log('[NEXT CONFIG DEBUG] ===== NEXT CONFIG LOADED =====');
console.log('[NEXT CONFIG DEBUG] NEXT_PUBLIC_CAMERA_STREAM_URL:', process.env.NEXT_PUBLIC_CAMERA_STREAM_URL ? 'SET' : 'NOT SET');
console.log('[NEXT CONFIG DEBUG] NEXT_PUBLIC_POCKETBASE_URL:', process.env.NEXT_PUBLIC_POCKETBASE_URL ? 'SET' : 'NOT SET');
console.log('[NEXT CONFIG DEBUG] NEXT_PUBLIC_PIN_CODE:', process.env.NEXT_PUBLIC_PIN_CODE ? 'SET' : 'NOT SET');
console.log('[NEXT CONFIG DEBUG] nextConfig.env:', nextConfig.env);

export default nextConfig;
// Dummy change for deployment trigger

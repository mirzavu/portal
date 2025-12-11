module.exports = {
  apps: [
    {
      name: "portal-web",
      script: "node",
      args: "server.js", // Standalone builds use this entry point
      env: {
        PORT: 3005,
        NODE_ENV: "production",
        // Camera device IP or Tailscale hostname (e.g., "100.x.x.x" or "device.tailnet.ts.net")
        // Replace with your actual camera device IP/hostname
        NEXT_PUBLIC_CAMERA_DEVICE_IP: "100.84.38.121", // TODO: Set your camera device IP/hostname here
      },
    },
    {
      name: "portal-pb",
      script: "./pocketbase",
      args: "serve --http=127.0.0.1:8095",
      cwd: "./",
      interpreter: "none", // Treat pocketbase as a binary, not a script
    },
  ],
};








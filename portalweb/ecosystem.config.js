module.exports = {
  apps: [
    {
      name: "portal-web",
      script: "node",
      args: "server.js", // Standalone builds use this entry point
      env: {
        PORT: 3005,
        NODE_ENV: "production",
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







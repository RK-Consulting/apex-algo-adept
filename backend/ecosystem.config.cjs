/**
 * PM2 process configuration for AlphaForge Backend
 * ------------------------------------------------
 * Commands:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 restart alphaforge-api --update-env
 *   pm2 logs alphaforge-api
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: "alphaforge-api",

      // Run the compiled ESM server directly
      script: "dist/server.js",
      cwd: "/var/www/apex-algo-adept/backend",

      exec_mode: "fork",
      instances: 1,

      // NO load-env, NO double dotenv
      node_args: "",

      env: {
        NODE_ENV: "development",
        PORT: 3000,
        DOTENV_CONFIG_PATH: "/var/www/apex-algo-adept/backend/.env"
      },

      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        DOTENV_CONFIG_PATH: "/var/www/apex-algo-adept/backend/.env"
      },

      autorestart: true,
      watch: false,
      max_memory_restart: "300M",

      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      time: true
    }
  ]
};

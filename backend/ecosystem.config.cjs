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

      // Load .env BEFORE loading server.js
      script: "load-env.js",
      cwd: "/var/www/apex-algo-adept/backend",

      exec_mode: "fork",   // Breeze WS requires non-cluster mode
      instances: 1,

      node_args: "--require dotenv/config",

      // What environment to load
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

      log_date_format: "YYYY-MM-DD HH:mm:ss",

      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      time: true
    }
  ]
};

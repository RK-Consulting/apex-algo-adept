/**
 * PM2 process configuration for AlphaForge Backend
 * ------------------------------------------------
 * Commands:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 restart alphaforge-api
 *   pm2 logs alphaforge-api
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: "alphaforge-api",
      script: "./dist/server.js",            // built backend entry
      cwd: "/var/www/apex-algo-adept/backend",

      exec_mode: "fork",                     // ❗ Breeze cannot run in cluster mode
      instances: 1,

      // Load environment variables from .env
      // (PM2 automatically loads them)
      env: {
        NODE_ENV: "development",
        //PORT: 8080
        PORT: 3000
      },

      env_production: {
        NODE_ENV: "production",
        //PORT: 8080
        PORT: 3000
        DOTENV_CONFIG_PATH: "/var/www/apex-algo-adept/backend/.env"
      },

      autorestart: true,
      watch: false,                          // Do NOT watch dist in production
      max_memory_restart: "300M",

      log_date_format: "YYYY-MM-DD HH:mm:ss",

      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      time: true
    }
  ]
};

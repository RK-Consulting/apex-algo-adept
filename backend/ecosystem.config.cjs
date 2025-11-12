/**
 * PM2 process configuration for AlphaForge / Apex Algo Adept backend
 * ---------------------------------------------------------------
 * Run commands:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 logs apex-backend
 *   pm2 restart apex-backend
 *   pm2 monit
 */
module.exports = {
  apps: [
    {
      name: 'alphaforge-api',
      script: 'dist/server.js',
      cwd: '/var/www/apex-algo-adept/backend',
      exec_mode: 'fork',        // ✅ force single-process mode
      instances: 1,
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};

/* module.exports = {
  apps: [
    {
      name: "apex-backend",
      script: "./dist/server.js", // compiled output (after tsc build)
      instances: "max",            // use all CPU cores (cluster mode)
      exec_mode: "cluster",
      autorestart: true,
      watch: false,                // set to true for dev mode only
      max_memory_restart: "1G",

      env: {
        NODE_ENV: "development",
        PORT: 8080,
        DATABASE_URL: "postgresql://user:password@localhost:5432/apexdb",
        JWT_SECRET: "your_jwt_secret_here",
        ALLOWED_ORIGINS: "http://localhost:5173,https://skillsifter.in,https://www.skillsifter.in",
      },

      env_production: {
        NODE_ENV: "production",
        PORT: 8080,
        DATABASE_URL: "postgresql://user:password@localhost:5432/apexdb",
        JWT_SECRET: "your_production_jwt_secret",
        ALLOWED_ORIGINS: "https://skillsifter.in,https://www.skillsifter.in",
        LOG_LEVEL: "info",
      },

      error_file: "./logs/apex-backend-error.log",
      out_file: "./logs/apex-backend-out.log",
      time: true, // add timestamp to logs
    },
  ],
}; */

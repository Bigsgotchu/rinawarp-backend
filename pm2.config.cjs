// pm2.config.cjs
module.exports = {
  apps: [
    {
      name: "rina-ollama-bridge",
      script: "server.py",
      interpreter: "python3",
      cwd: __dirname,
      env: {
        PYTHONUNBUFFERED: "1",
        OLLAMA_API: "http://localhost:11434",
        HOST: "0.0.0.0",
        PORT: "7071",
        // Security
        ADMIN_API_KEY: process.env.ADMIN_API_KEY,
        REQUIRE_VALID_LICENSE: process.env.REQUIRE_VALID_LICENSE || "false",
        LICENSE_PUBLIC_KEY_PATH: process.env.LICENSE_PUBLIC_KEY_PATH,
        // CORS
        CORS_ORIGINS: process.env.CORS_ORIGINS,
        // Logging
        LOG_LEVEL: process.env.LOG_LEVEL || "INFO",
      },
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      restart_delay: 2000,
      // Production optimizations
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        LOG_LEVEL: "WARNING",
      },
    },
  ],
};